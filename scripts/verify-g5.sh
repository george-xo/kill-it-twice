#!/usr/bin/env bash

set -euo pipefail

MAX_WAIT_ATTEMPTS=60
SEED_COUNT=10

fail() {
  echo "G5 verification failed: $1" >&2
  exit 1
}

metric_value() {
  local metric_name="$1"

  curl -fsS http://localhost:3000/metrics |
    awk -v metric_name="${metric_name}" \
      '$1 == metric_name { print $2 }'
}

wait_for_status() {
  local expected_status="$1"

  for ((attempt = 1; attempt <= MAX_WAIT_ATTEMPTS; attempt += 1)); do
    if curl -fsS http://localhost:3000/status 2>/dev/null |
      grep -q "\"status\":\"${expected_status}\""; then
      return
    fi

    sleep 1
  done

  fail "system did not reach ${expected_status} status"
}

wait_for_metric() {
  local metric_name="$1"
  local minimum_value="$2"

  for ((attempt = 1; attempt <= MAX_WAIT_ATTEMPTS; attempt += 1)); do
    local current_value

    current_value="$(metric_value "${metric_name}" || true)"

    if [[ "${current_value}" =~ ^[0-9]+$ ]] &&
      ((current_value >= minimum_value)); then
      return
    fi

    sleep 1
  done

  fail "${metric_name} did not reach ${minimum_value}"
}

restore_elasticsearch() {
  docker compose up -d elasticsearch >/dev/null 2>&1 || true
}

trap restore_elasticsearch EXIT

echo "Preparing G5 verification environment..."

npm run build --prefix backend
npm run lint --prefix backend

docker compose config --quiet

docker compose build \
  backend \
  migrate \
  destination-setup \
  consumer \
  incremental-sync

docker compose up -d --wait \
  postgres \
  elasticsearch \
  rabbitmq

docker compose stop \
  backfill \
  incremental-sync \
  consumer >/dev/null 2>&1 || true

docker compose run --rm migrate

docker compose run --rm \
  -e SEED_COUNT="${SEED_COUNT}" \
  backend \
  node dist/seed/seed.js

docker compose run --rm destination-setup

docker compose exec -T rabbitmq \
  rabbitmqctl purge_queue customer.events.consumer >/dev/null

docker compose exec -T rabbitmq \
  rabbitmqctl purge_queue customer.events.dlq >/dev/null

docker compose up -d --force-recreate \
  backend \
  consumer \
  incremental-sync

wait_for_status "healthy"

metrics_output="$(curl -fsS http://localhost:3000/metrics)"

required_metrics=(
  pipeline_delivered_events_total
  pipeline_elasticsearch_retries_total
  pipeline_rabbitmq_retries_total
  consumer_processed_events_total
  consumer_duplicate_events_total
  pipeline_dead_letter_events_total
)

for metric_name in "${required_metrics[@]}"; do
  echo "${metrics_output}" |
    grep -q "# TYPE ${metric_name} counter" ||
    fail "${metric_name} is missing or is not a counter"
done

docker compose exec -T postgres psql \
  -U app_user \
  -d kill_it_twice \
  -c "
    UPDATE customers
    SET status = CASE
      WHEN status = 'active' THEN 'inactive'
      ELSE 'active'
    END
    WHERE id = 1;
  " >/dev/null

wait_for_metric "pipeline_delivered_events_total" 1
wait_for_metric "consumer_processed_events_total" 1

docker compose stop elasticsearch >/dev/null

wait_for_status "degraded"

docker compose exec -T postgres psql \
  -U app_user \
  -d kill_it_twice \
  -c "
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

docker compose logs incremental-sync |
  grep -q '"event":"destination_retry_scheduled"' ||
  fail "structured retry log was not found"

docker compose logs incremental-sync |
  grep -q '"event":"destination_delivery_recovered"' ||
  fail "structured recovery log was not found"

docker compose logs consumer |
  grep -q '"event":"consumer_event_processed"' ||
  fail "structured consumer log was not found"

delivered_count="$(
  metric_value "pipeline_delivered_events_total"
)"

retry_count="$(
  metric_value "pipeline_elasticsearch_retries_total"
)"

consumer_count="$(
  metric_value "consumer_processed_events_total"
)"

echo "G5 observability ................ PASS"
echo "System status ................... healthy"
echo "Delivered events ................ ${delivered_count}"
echo "Elasticsearch retries ........... ${retry_count}"
echo "Processed consumer events ....... ${consumer_count}"
echo "Structured logs ................. PASS"