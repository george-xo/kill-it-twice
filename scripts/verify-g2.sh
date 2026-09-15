#!/usr/bin/env bash

set -euo pipefail

RECORD_COUNT=10
MAXIMUM_WAIT_ATTEMPTS=60

POSTGRES_USER_NAME=app_user
POSTGRES_DATABASE_NAME=kill_it_twice
RABBITMQ_QUEUE_NAME=customer.events.consumer
CONSUMER_NAME=customer-event-consumer

pass() {
  echo "G2 no duplicate processing ...... PASS"
  echo "Same event publications ......... 3"
  echo "Unique processed events ......... ${processed_event_count}"
  echo "Duplicate events detected ....... ${duplicate_event_count}"
  echo "Duplicate processed rows ........ ${duplicate_processing_count}"
  echo "Elasticsearch documents ......... ${elasticsearch_count}"
  echo "Latest customer version ......... ${elasticsearch_version}"
  echo "RabbitMQ pending messages ....... ${rabbitmq_message_count}"
}

fail() {
  echo "G2 no duplicate processing ...... FAIL"
  echo "$1"
  exit 1
}

query_postgres() {
  docker compose exec -T postgres psql \
    -U "${POSTGRES_USER_NAME}" \
    -d "${POSTGRES_DATABASE_NAME}" \
    -Atc "$1"
}

read_processed_event_count() {
  query_postgres "
    SELECT COUNT(*)
    FROM consumer_processed_events
    WHERE consumer_name = '${CONSUMER_NAME}';
  " | tr -d '[:space:]'
}

read_metric_value() {
  local metric_name="$1"

  query_postgres "
    SELECT COALESCE(
      (
        SELECT value
        FROM pipeline_metrics
        WHERE metric_name = '${metric_name}'
      ),
      0
    );
  " | tr -d '[:space:]'
}

read_rabbitmq_message_count() {
  docker compose exec -T rabbitmq \
    rabbitmqctl list_queues name messages_ready 2>/dev/null |
    awk -v queue="${RABBITMQ_QUEUE_NAME}" \
      '$1 == queue { print $2 }' |
    tr -d '[:space:]'
}

wait_for_processed_event_count() {
  local expected_count="$1"
  local actual_count=""

  for ((attempt = 1; attempt <= MAXIMUM_WAIT_ATTEMPTS; attempt += 1)); do
    actual_count="$(read_processed_event_count)"

    if [[ "${actual_count}" == "${expected_count}" ]]; then
      return
    fi

    sleep 0.25
  done

  fail "Expected ${expected_count} processed events, got ${actual_count}"
}

wait_for_empty_queue() {
  local message_count=""

  for ((attempt = 1; attempt <= MAXIMUM_WAIT_ATTEMPTS; attempt += 1)); do
    message_count="$(read_rabbitmq_message_count)"

    if [[ "${message_count}" == "0" ]]; then
      return
    fi

    sleep 0.25
  done

  fail "RabbitMQ queue did not become empty"
}

publish_first_event() {
  docker compose run --rm \
    -e DELIVERY_AFTER_ID=0 \
    -e DELIVERY_BATCH_SIZE=1 \
    backend \
    node dist/pipeline/deliver-changes.js \
    >/dev/null
}

echo "Preparing G2 verification environment..."

docker compose stop \
  consumer \
  incremental-sync \
  backfill \
  >/dev/null 2>&1 || true

docker compose up -d --wait \
  postgres \
  rabbitmq \
  elasticsearch

docker compose build \
  migrate \
  backend \
  destination-setup \
  consumer

docker compose run --rm migrate >/dev/null

docker compose run --rm \
  -e SEED_COUNT="${RECORD_COUNT}" \
  backend \
  node dist/seed/seed.js \
  >/dev/null

curl -sS \
  -X DELETE \
  http://localhost:9200/customers \
  >/dev/null || true

docker compose run --rm destination-setup >/dev/null

docker compose exec -T rabbitmq \
  rabbitmqctl purge_queue "${RABBITMQ_QUEUE_NAME}" \
  >/dev/null

echo "Publishing the same event twice..."

publish_first_event
publish_first_event

docker compose up \
  -d \
  --no-deps \
  --force-recreate \
  consumer \
  >/dev/null

wait_for_processed_event_count 1
wait_for_empty_queue

first_run_logs="$(
  docker compose logs --no-color consumer
)"

processed_log_count="$(
  printf '%s\n' "${first_run_logs}" |
    grep -F '"event":"consumer_event_processed"' |
    grep -c '"eventId":"customer:1:1"' || true
)"

duplicate_log_count="$(
  printf '%s\n' "${first_run_logs}" |
    grep -F '"event":"consumer_duplicate_event_ignored"' |
    grep -c '"eventId":"customer:1:1"' || true
)"

if [[ "${processed_log_count}" != "1" ]]; then
  fail "The first event was not processed exactly once"
fi

if [[ "${duplicate_log_count}" != "1" ]]; then
  fail "The duplicate event was not ignored"
fi

echo "Restarting Consumer and publishing the duplicate again..."

docker compose stop consumer >/dev/null

publish_first_event

docker compose up \
  -d \
  --no-deps \
  --force-recreate \
  consumer \
  >/dev/null

wait_for_empty_queue

processed_event_count="$(read_processed_event_count)"

if [[ "${processed_event_count}" != "1" ]]; then
  fail "Consumer restart lost the idempotency state"
fi

restart_logs="$(
  docker compose logs --no-color consumer
)"

restart_duplicate_log_count="$(
  printf '%s\n' "${restart_logs}" |
    grep -F '"event":"consumer_duplicate_event_ignored"' |
    grep -c '"eventId":"customer:1:1"' || true
)"

if [[ "${restart_duplicate_log_count}" != "1" ]]; then
  fail "Duplicate event was not ignored after Consumer restart"
fi

echo "Publishing a new version of the same customer..."

query_postgres "
  UPDATE customers
  SET status = 'inactive'
  WHERE id = 1;
" >/dev/null

docker compose run --rm \
  -e DELIVERY_AFTER_ID="${RECORD_COUNT}" \
  -e DELIVERY_BATCH_SIZE=1 \
  backend \
  node dist/pipeline/deliver-changes.js \
  >/dev/null

wait_for_processed_event_count 2
wait_for_empty_queue

second_version_count="$(
  query_postgres "
    SELECT COUNT(*)
    FROM consumer_processed_events
    WHERE consumer_name = '${CONSUMER_NAME}'
      AND event_id = 'customer:1:2';
  " | tr -d '[:space:]'
)"

if [[ "${second_version_count}" != "1" ]]; then
  fail "The new customer version was not processed"
fi

curl -fsS \
  -X POST \
  http://localhost:9200/customers/_refresh \
  >/dev/null

elasticsearch_count="$(
  curl -fsS \
    'http://localhost:9200/_cat/count/customers?h=count' |
    tr -d '[:space:]'
)"

elasticsearch_document="$(
  curl -fsS \
    http://localhost:9200/customers/_doc/1
)"

elasticsearch_version="$(
  printf '%s\n' "${elasticsearch_document}" |
    sed -n 's/.*"_version":\([0-9][0-9]*\).*/\1/p'
)"

processed_event_count="$(read_processed_event_count)"

duplicate_event_count="$(
  read_metric_value "consumer_duplicate_events_total"
)"

processed_metric_count="$(
  read_metric_value "consumer_processed_events_total"
)"

duplicate_processing_count="$(
  query_postgres "
    SELECT COUNT(*)
    FROM (
      SELECT
        consumer_name,
        event_id
      FROM consumer_processed_events
      GROUP BY
        consumer_name,
        event_id
      HAVING COUNT(*) > 1
    ) AS duplicate_rows;
  " | tr -d '[:space:]'
)"

rabbitmq_message_count="$(read_rabbitmq_message_count)"

if [[ "${processed_event_count}" != "2" ]]; then
  fail "Expected 2 unique processed events"
fi

if [[ "${processed_metric_count}" != "2" ]]; then
  fail "Processed event metric does not match the database state"
fi

if [[ "${duplicate_event_count}" != "2" ]]; then
  fail "Expected 2 detected duplicate events"
fi

if [[ "${duplicate_processing_count}" != "0" ]]; then
  fail "Duplicate consumer processing was detected"
fi

if [[ "${elasticsearch_count}" != "1" ]]; then
  fail "Duplicate delivery created an unexpected Elasticsearch document"
fi

if [[ "${elasticsearch_version}" != "2" ]]; then
  fail "Elasticsearch does not contain customer version 2"
fi

if [[ "${rabbitmq_message_count}" != "0" ]]; then
  fail "RabbitMQ still contains pending messages"
fi

pass