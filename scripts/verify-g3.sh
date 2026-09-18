#!/usr/bin/env bash

set -euo pipefail

RECORD_COUNT=10
OUTAGE_DURATION_SECONDS="${G3_OUTAGE_SECONDS:-60}"
MAXIMUM_WAIT_ATTEMPTS=240

POSTGRES_USER_NAME=app_user
POSTGRES_DATABASE_NAME=kill_it_twice
RABBITMQ_QUEUE_NAME=customer.events.consumer
INCREMENTAL_JOB_NAME=customers

pass() {
  echo "G3 sink outage .................. PASS (${OUTAGE_DURATION_SECONDS}s down, ${lost_event_count} lost, recovered in ${maximum_recovery_seconds}s)"
  echo "Elasticsearch recovery .......... ${elasticsearch_recovery_seconds}s"
  echo "RabbitMQ recovery ............... ${rabbitmq_recovery_seconds}s"
  echo "Elasticsearch retries ........... ${elasticsearch_retry_count}"
  echo "RabbitMQ retries ................ ${rabbitmq_retry_count}"
  echo "Processed events ................ ${processed_event_count}"
  echo "RabbitMQ pending messages ....... ${rabbitmq_message_count}"
}

fail() {
  echo "G3 sink outage .................. FAIL"
  echo "$1"
  exit 1
}

query_postgres() {
  docker compose exec -T postgres psql \
    -U "${POSTGRES_USER_NAME}" \
    -d "${POSTGRES_DATABASE_NAME}" \
    -Atc "$1"
}

read_checkpoint() {
  query_postgres "
    SELECT last_processed_change_id
    FROM incremental_sync_jobs
    WHERE name = '${INCREMENTAL_JOB_NAME}';
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

current_time_seconds() {
  date +%s
}

calculate_elapsed_seconds() {
  local started_at_seconds="$1"
  local completed_at_seconds="$2"

  awk \
    -v started_at_seconds="${started_at_seconds}" \
    -v completed_at_seconds="${completed_at_seconds}" \
    'BEGIN {
      printf "%.1f", completed_at_seconds - started_at_seconds
    }'
}

wait_for_checkpoint() {
  local expected_checkpoint="$1"
  local actual_checkpoint=""

  for ((attempt = 1; attempt <= MAXIMUM_WAIT_ATTEMPTS; attempt += 1)); do
    actual_checkpoint="$(read_checkpoint)"

    if [[ "${actual_checkpoint}" == "${expected_checkpoint}" ]]; then
      return
    fi

    sleep 0.25
  done

  fail "Checkpoint did not reach ${expected_checkpoint}"
}

wait_for_consumer() {
  local consumer_count=""

  for ((attempt = 1; attempt <= MAXIMUM_WAIT_ATTEMPTS; attempt += 1)); do
    consumer_count="$(
      docker compose exec -T rabbitmq \
        rabbitmqctl list_queues name consumers 2>/dev/null |
        awk -v queue="${RABBITMQ_QUEUE_NAME}" \
          '$1 == queue { print $2 }' |
        tr -d '[:space:]'
    )"

    if [[ "${consumer_count}" == "1" ]]; then
      return
    fi

    sleep 0.25
  done

  fail "RabbitMQ consumer did not reconnect"
}

restore_destinations() {
  docker compose up -d \
    elasticsearch \
    rabbitmq \
    >/dev/null 2>&1 || true
}

trap restore_destinations EXIT

echo "Preparing G3 verification environment..."

docker compose stop \
  backfill \
  incremental-sync \
  consumer \
  >/dev/null 2>&1 || true

docker compose up -d --wait \
  postgres \
  rabbitmq \
  elasticsearch

docker compose build \
  migrate \
  backend \
  destination-setup \
  incremental-sync \
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

DESTINATION_RETRY_MAX_ATTEMPTS=40 \
docker compose up \
  -d \
  --no-deps \
  --force-recreate \
  consumer \
  incremental-sync \
  >/dev/null

wait_for_checkpoint "${RECORD_COUNT}"

initial_checkpoint="$(read_checkpoint)"

echo "Testing Elasticsearch ${OUTAGE_DURATION_SECONDS}s outage..."

docker compose stop elasticsearch >/dev/null

query_postgres "
  UPDATE customers
  SET status = 'inactive'
  WHERE id = 2;
" >/dev/null

sleep "${OUTAGE_DURATION_SECONDS}"

checkpoint_while_elasticsearch_down="$(read_checkpoint)"

if [[ "${checkpoint_while_elasticsearch_down}" != "${initial_checkpoint}" ]]; then
  fail "Checkpoint advanced while Elasticsearch was unavailable"
fi

elasticsearch_recovery_started_at_seconds="$(current_time_seconds)"

docker compose up -d --wait elasticsearch >/dev/null

wait_for_checkpoint "$((RECORD_COUNT + 1))"

elasticsearch_recovery_completed_at_seconds="$(current_time_seconds)"

elasticsearch_recovery_seconds="$(
  calculate_elapsed_seconds \
    "${elasticsearch_recovery_started_at_seconds}" \
    "${elasticsearch_recovery_completed_at_seconds}"
)"

elasticsearch_checkpoint="$(read_checkpoint)"

incremental_logs="$(
  docker compose logs --no-color incremental-sync
)"

elasticsearch_recovery_log_count="$(
  printf '%s\n' "${incremental_logs}" |
    grep -F '"event":"destination_delivery_recovered"' |
    grep -F '"eventId":"customer:2:2"' |
    grep -c '"destination":"elasticsearch"' || true
)"

if [[ "${elasticsearch_recovery_log_count}" != "1" ]]; then
  fail "Elasticsearch structured recovery log was not found"
fi

echo "Testing RabbitMQ ${OUTAGE_DURATION_SECONDS}s outage..."

docker compose stop rabbitmq >/dev/null

query_postgres "
  UPDATE customers
  SET status = 'inactive'
  WHERE id = 3;
" >/dev/null

sleep "${OUTAGE_DURATION_SECONDS}"

checkpoint_while_rabbitmq_down="$(read_checkpoint)"

if [[ "${checkpoint_while_rabbitmq_down}" != "${elasticsearch_checkpoint}" ]]; then
  fail "Checkpoint advanced while RabbitMQ was unavailable"
fi

rabbitmq_recovery_started_at_seconds="$(current_time_seconds)"

docker compose up -d --wait rabbitmq >/dev/null

wait_for_checkpoint "$((RECORD_COUNT + 2))"
wait_for_consumer

rabbitmq_recovery_completed_at_seconds="$(current_time_seconds)"

rabbitmq_recovery_seconds="$(
  calculate_elapsed_seconds \
    "${rabbitmq_recovery_started_at_seconds}" \
    "${rabbitmq_recovery_completed_at_seconds}"
)"

rabbitmq_checkpoint="$(read_checkpoint)"

incremental_logs="$(
  docker compose logs --no-color incremental-sync
)"

consumer_logs="$(
  docker compose logs --no-color consumer
)"

rabbitmq_recovery_log_count="$(
  printf '%s\n' "${incremental_logs}" |
    grep -F '"event":"destination_delivery_recovered"' |
    grep -F '"eventId":"customer:3:2"' |
    grep -c '"destination":"rabbitmq"' || true
)"

if [[ "${rabbitmq_recovery_log_count}" != "1" ]]; then
  fail "RabbitMQ structured publisher recovery log was not found"
fi

if [[ "${consumer_logs}" != *"RabbitMQ consumer connection recovered"* ]]; then
  fail "RabbitMQ consumer recovery was not logged"
fi

processed_event_count="$(
  query_postgres "
    SELECT COUNT(*)
    FROM consumer_processed_events;
  " | tr -d '[:space:]'
)"

rabbitmq_message_count="$(read_rabbitmq_message_count)"

curl -fsS \
  -X POST \
  http://localhost:9200/customers/_refresh \
  >/dev/null

elasticsearch_documents="$(
  curl -fsS \
    -H 'Content-Type: application/json' \
    -X POST \
    http://localhost:9200/customers/_mget \
    -d '{"ids":["2","3"]}'
)"

successful_document_count="$(
  printf '%s\n' "${elasticsearch_documents}" |
    awk -F'"found":true' '
      {
        found_count += NF - 1
      }

      END {
        print found_count + 0
      }
    '
)"

elasticsearch_retry_count="$(
  read_metric_value "pipeline_elasticsearch_retries_total"
)"

rabbitmq_retry_count="$(
  read_metric_value "pipeline_rabbitmq_retries_total"
)"

if [[ "${rabbitmq_checkpoint}" != "$((RECORD_COUNT + 2))" ]]; then
  fail "Final checkpoint is incorrect"
fi

if [[ "${processed_event_count}" != "2" ]]; then
  fail "Expected 2 processed consumer events"
fi

if [[ "${successful_document_count}" != "2" ]]; then
  fail "Elasticsearch is missing a recovered event"
fi

if [[ "${rabbitmq_message_count}" != "0" ]]; then
  fail "RabbitMQ still contains pending messages"
fi

if ((elasticsearch_retry_count < 1)); then
  fail "Elasticsearch retry metric was not incremented"
fi

if ((rabbitmq_retry_count < 1)); then
  fail "RabbitMQ retry metric was not incremented"
fi

lost_event_count="$((2 - processed_event_count))"

maximum_recovery_seconds="$(
  awk \
    -v elasticsearch="${elasticsearch_recovery_seconds}" \
    -v rabbitmq="${rabbitmq_recovery_seconds}" \
    'BEGIN {
      if (elasticsearch > rabbitmq) {
        printf "%.1f", elasticsearch
      } else {
        printf "%.1f", rabbitmq
      }
    }'
)"

pass