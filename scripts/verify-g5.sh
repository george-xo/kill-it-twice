#!/usr/bin/env bash

set -euo pipefail

MAX_WAIT_ATTEMPTS=60
SEED_COUNT=10

POSTGRES_USER_NAME=app_user
POSTGRES_DATABASE_NAME=kill_it_twice
BACKFILL_JOB_NAME=customers

MAIN_QUEUE_NAME=customer.events.consumer
DEAD_LETTER_QUEUE_NAME=customer.events.dlq

fail() {
  echo "G5 observability ................ FAIL"
  echo "$1"
  exit 1
}

query_postgres() {
  docker compose exec -T postgres psql \
    -U "${POSTGRES_USER_NAME}" \
    -d "${POSTGRES_DATABASE_NAME}" \
    -Atc "$1"
}

metric_value() {
  local metric_name="$1"

  curl -fsS http://localhost:3000/metrics |
    awk -v metric_name="${metric_name}" \
      '$1 == metric_name { print $2 }'
}

wait_for_status() {
  local expected_status="$1"
  local status_output=""

  for ((attempt = 1; attempt <= MAX_WAIT_ATTEMPTS; attempt += 1)); do
    status_output="$(
      curl -fsS http://localhost:3000/status 2>/dev/null || true
    )"

    if [[ "${status_output}" == *"\"status\":\"${expected_status}\""* ]]; then
      return
    fi

    sleep 1
  done

  fail "System did not reach ${expected_status} status"
}

wait_for_metric() {
  local metric_name="$1"
  local minimum_value="$2"
  local current_value=""

  for ((attempt = 1; attempt <= MAX_WAIT_ATTEMPTS; attempt += 1)); do
    current_value="$(metric_value "${metric_name}" || true)"

    if [[ "${current_value}" =~ ^[0-9]+$ ]] &&
      ((current_value >= minimum_value)); then
      return
    fi

    sleep 1
  done

  fail "${metric_name} did not reach ${minimum_value}"
}

restore_environment() {
  docker compose up -d elasticsearch >/dev/null 2>&1 || true

  docker compose exec -T postgres psql \
    -U "${POSTGRES_USER_NAME}" \
    -d "${POSTGRES_DATABASE_NAME}" \
    -c "
      UPDATE backfill_jobs
      SET
        status = 'completed',
        stop_requested = FALSE,
        last_error = NULL
      WHERE name = '${BACKFILL_JOB_NAME}';
    " >/dev/null 2>&1 || true
}

trap restore_environment EXIT

echo "Preparing G5 verification environment..."

docker compose config --quiet

docker compose build \
  backend \
  migrate \
  destination-setup \
  backfill \
  consumer \
  incremental-sync

docker compose up -d --wait \
  postgres \
  elasticsearch \
  rabbitmq

docker compose stop \
  backfill \
  incremental-sync \
  consumer \
  >/dev/null 2>&1 || true

docker compose run --rm migrate >/dev/null

docker compose run --rm \
  -e SEED_COUNT="${SEED_COUNT}" \
  backend \
  node dist/seed/seed.js \
  >/dev/null

curl -sS \
  -X DELETE \
  http://localhost:9200/customers \
  >/dev/null || true

docker compose run --rm destination-setup >/dev/null

docker compose run \
  --rm \
  --no-deps \
  backfill \
  >/dev/null

query_postgres "
  TRUNCATE TABLE
    consumer_processed_events,
    pipeline_metrics;
" >/dev/null

docker compose exec -T rabbitmq \
  rabbitmqctl purge_queue "${MAIN_QUEUE_NAME}" \
  >/dev/null

docker compose exec -T rabbitmq \
  rabbitmqctl purge_queue "${DEAD_LETTER_QUEUE_NAME}" \
  >/dev/null

docker compose up -d --force-recreate \
  backend \
  consumer \
  incremental-sync \
  >/dev/null

wait_for_status "healthy"

metrics_output="$(
  curl -fsS http://localhost:3000/metrics
)"

required_metrics=(
  pipeline_delivered_events_total
  pipeline_elasticsearch_retries_total
  pipeline_rabbitmq_retries_total
  consumer_processed_events_total
  consumer_duplicate_events_total
  pipeline_dead_letter_events_total
)

for metric_name in "${required_metrics[@]}"; do
  if [[ "${metrics_output}" != *"# TYPE ${metric_name} counter"* ]]; then
    fail "${metric_name} is missing or is not a counter"
  fi
done

echo "Testing failed worker status..."

query_postgres "
  UPDATE backfill_jobs
  SET
    status = 'failed',
    last_error = 'G5 verification worker failure'
  WHERE name = '${BACKFILL_JOB_NAME}';
" >/dev/null

wait_for_status "degraded"

worker_failure_status="$(
  curl -fsS http://localhost:3000/status
)"

if [[ "${worker_failure_status}" != *'"status":"failed"'* ]]; then
  fail "Failed worker status was not exposed"
fi

if [[ "${worker_failure_status}" != *'"lastError":"G5 verification worker failure"'* ]]; then
  fail "Worker last error was not exposed"
fi

query_postgres "
  UPDATE backfill_jobs
  SET
    status = 'completed',
    stop_requested = FALSE,
    last_error = NULL
  WHERE name = '${BACKFILL_JOB_NAME}';
" >/dev/null

wait_for_status "healthy"

echo "Testing successful event metrics..."

query_postgres "
  UPDATE customers
  SET status = CASE
    WHEN status = 'active' THEN 'inactive'
    ELSE 'active'
  END
  WHERE id = 1;
" >/dev/null

wait_for_metric "pipeline_delivered_events_total" 1
wait_for_metric "consumer_processed_events_total" 1

echo "Testing dependency outage and recovery..."

docker compose stop elasticsearch >/dev/null

wait_for_status "degraded"

query_postgres "
  UPDATE customers
  SET status = CASE
    WHEN status = 'active' THEN 'inactive'
    ELSE 'active'
  END
  WHERE id = 2;
" >/dev/null

sleep 1

docker compose up -d --wait elasticsearch >/dev/null

wait_for_status "healthy"
wait_for_metric "pipeline_elasticsearch_retries_total" 1
wait_for_metric "pipeline_delivered_events_total" 2
wait_for_metric "consumer_processed_events_total" 2

incremental_logs="$(
  docker compose logs --no-color incremental-sync
)"

consumer_logs="$(
  docker compose logs --no-color consumer
)"

if [[ "${incremental_logs}" != *'"event":"destination_retry_scheduled"'* ]]; then
  fail "Structured retry log was not found"
fi

if [[ "${incremental_logs}" != *'"event":"destination_delivery_recovered"'* ]]; then
  fail "Structured recovery log was not found"
fi

if [[ "${consumer_logs}" != *'"event":"consumer_event_processed"'* ]]; then
  fail "Structured consumer log was not found"
fi

delivered_count="$(
  metric_value "pipeline_delivered_events_total"
)"

retry_count="$(
  metric_value "pipeline_elasticsearch_retries_total"
)"

consumer_count="$(
  metric_value "consumer_processed_events_total"
)"

final_status="$(
  curl -fsS http://localhost:3000/status
)"

if [[ "${final_status}" != *'"status":"healthy"'* ]]; then
  fail "Final system status is not healthy"
fi

curl -fsS \
  -X POST \
  http://localhost:9200/customers/_refresh \
  >/dev/null

source_record_count="$(
  query_postgres "
    SELECT COUNT(*)
    FROM customers;
  " | tr -d '[:space:]'
)"

elasticsearch_record_count="$(
  curl -fsS \
    'http://localhost:9200/_cat/count/customers?h=count' |
    tr -d '[:space:]'
)"

if [[ "${source_record_count}" != "${SEED_COUNT}" ]]; then
  fail "Expected ${SEED_COUNT} source records, got ${source_record_count}"
fi

if [[ "${elasticsearch_record_count}" != "${SEED_COUNT}" ]]; then
  fail "Expected ${SEED_COUNT} Elasticsearch records, got ${elasticsearch_record_count}"
fi

echo "G5 observability ................ PASS"
echo "System status ................... healthy"
echo "Delivered events ................ ${delivered_count}"
echo "Elasticsearch retries ........... ${retry_count}"
echo "Processed consumer events ....... ${consumer_count}"
echo "Source records .................. ${source_record_count}"
echo "Elasticsearch records ........... ${elasticsearch_record_count}"
echo "Structured logs ................. PASS"