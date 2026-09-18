#!/usr/bin/env bash

set -euo pipefail

RECORD_COUNT=10000
BATCH_SIZE=1000
BATCH_DELAY_MS=500
MINIMUM_CHECKPOINT_BEFORE_KILL=1000
MINIMUM_IN_FLIGHT_EVENTS=20
MAXIMUM_WAIT_ATTEMPTS=600

POSTGRES_USER_NAME=app_user
POSTGRES_DATABASE_NAME=kill_it_twice
BACKFILL_JOB_NAME=customers
RABBITMQ_QUEUE_NAME=customer.events.consumer

pass() {
  echo "G1 resume after kill ............ PASS (killed at ${killed_at}, resumed at ${resume_checkpoint}, ${lost_record_count} lost)"
  echo "Replayed events ................. ${replayed_event_count}"
  echo "Source records .................. ${source_count}"
  echo "Elasticsearch records ........... ${elasticsearch_count}"
  echo "RabbitMQ events ................. ${rabbitmq_message_count}"
  echo "Missing records ................. ${missing_record_count}"
}

fail() {
  echo "G1 resume after kill ............ FAIL"
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
    SELECT last_processed_id
    FROM backfill_jobs
    WHERE name = '${BACKFILL_JOB_NAME}';
  " | tr -d '[:space:]'
}

read_rabbitmq_message_count() {
  docker compose exec -T rabbitmq \
    rabbitmqctl list_queues name messages_ready 2>/dev/null |
    awk -v queue="${RABBITMQ_QUEUE_NAME}" \
      '$1 == queue { print $2 }' |
    tr -d '[:space:]'
}

count_missing_elasticsearch_records() {
  local source_ids_json

  source_ids_json="$(
    query_postgres "
      SELECT COALESCE(
        json_agg(id::TEXT ORDER BY id),
        '[]'::json
      )::TEXT
      FROM customers;
    "
  )"

  printf '{"ids":%s}' "${source_ids_json}" |
    curl -fsS \
      -X POST \
      -H 'Content-Type: application/json' \
      --data-binary @- \
      http://localhost:9200/customers/_mget |
    awk -F'"found":false' '
      {
        missing_count += NF - 1
      }

      END {
        print missing_count + 0
      }
    '
}

echo "Preparing G1 verification environment..."

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
  backfill

docker compose run --rm migrate >/dev/null

docker compose run --rm \
  -e SEED_COUNT="${RECORD_COUNT}" \
  backend \
  node dist/seed/seed.js \
  >/dev/null

query_postgres "
  DELETE FROM backfill_jobs
  WHERE name = '${BACKFILL_JOB_NAME}';
" >/dev/null

curl -sS \
  -X DELETE \
  http://localhost:9200/customers \
  >/dev/null || true

docker compose run --rm destination-setup >/dev/null

docker compose exec -T rabbitmq \
  rabbitmqctl purge_queue "${RABBITMQ_QUEUE_NAME}" \
  >/dev/null

echo "Starting Backfill..."

BACKFILL_BATCH_SIZE="${BATCH_SIZE}" \
BACKFILL_BATCH_DELAY_MS="${BATCH_DELAY_MS}" \
docker compose up \
  -d \
  --no-deps \
  --force-recreate \
  backfill \
  >/dev/null

checkpoint_before_kill=""
published_before_kill=""

for ((attempt = 1; attempt <= MAXIMUM_WAIT_ATTEMPTS; attempt += 1)); do
  checkpoint_before_kill="$(read_checkpoint)"
  published_before_kill="$(read_rabbitmq_message_count)"

  if [[ "${checkpoint_before_kill}" =~ ^[0-9]+$ ]] &&
    [[ "${published_before_kill}" =~ ^[0-9]+$ ]] &&
    ((checkpoint_before_kill >= MINIMUM_CHECKPOINT_BEFORE_KILL)) &&
    ((published_before_kill >= checkpoint_before_kill + MINIMUM_IN_FLIGHT_EVENTS)); then
    break
  fi

  sleep 0.25
done

if [[ ! "${checkpoint_before_kill}" =~ ^[0-9]+$ ]] ||
  [[ ! "${published_before_kill}" =~ ^[0-9]+$ ]]; then
  fail "Backfill progress could not be read"
fi

if ((checkpoint_before_kill < MINIMUM_CHECKPOINT_BEFORE_KILL)); then
  fail "Backfill did not reach the minimum checkpoint"
fi

if ((published_before_kill < checkpoint_before_kill + MINIMUM_IN_FLIGHT_EVENTS)); then
  fail "Backfill was not observed in the middle of a batch"
fi

backfill_container_id="$(docker compose ps -q backfill)"

if [[ -z "${backfill_container_id}" ]]; then
  fail "Backfill container was not found"
fi

echo "Killing Backfill during an unfinished batch..."

docker kill "${backfill_container_id}" >/dev/null

killed_at="$(read_rabbitmq_message_count)"
resume_checkpoint="$(read_checkpoint)"

if [[ ! "${killed_at}" =~ ^[0-9]+$ ]] ||
  [[ ! "${resume_checkpoint}" =~ ^[0-9]+$ ]]; then
  fail "Kill position or resume checkpoint is invalid"
fi

if ((killed_at <= resume_checkpoint)); then
  fail "Backfill was not killed after the persisted checkpoint"
fi

if ((resume_checkpoint >= RECORD_COUNT)); then
  fail "Backfill completed before it could be killed"
fi

backfill_status_after_kill="$(
  query_postgres "
    SELECT status
    FROM backfill_jobs
    WHERE name = '${BACKFILL_JOB_NAME}';
  " | tr -d '[:space:]'
)"

if [[ "${backfill_status_after_kill}" != "running" ]]; then
  fail "Expected running status after kill, got ${backfill_status_after_kill}"
fi

echo "Restarting Backfill from checkpoint ${resume_checkpoint}..."

docker compose start backfill >/dev/null

sleep 1

resume_log="$(
  docker compose logs --no-color backfill |
    grep 'Backfill started from customer ID' |
    tail -n 1
)"

if [[ "${resume_log}" != *"customer ID ${resume_checkpoint};"* ]]; then
  fail "Backfill did not resume from checkpoint ${resume_checkpoint}"
fi

docker compose wait backfill >/dev/null

final_status="$(
  query_postgres "
    SELECT status
    FROM backfill_jobs
    WHERE name = '${BACKFILL_JOB_NAME}';
  " | tr -d '[:space:]'
)"

snapshot_max_id="$(
  query_postgres "
    SELECT snapshot_max_id
    FROM backfill_jobs
    WHERE name = '${BACKFILL_JOB_NAME}';
  " | tr -d '[:space:]'
)"

final_checkpoint="$(
  query_postgres "
    SELECT last_processed_id
    FROM backfill_jobs
    WHERE name = '${BACKFILL_JOB_NAME}';
  " | tr -d '[:space:]'
)"

processed_count="$(
  query_postgres "
    SELECT processed_count
    FROM backfill_jobs
    WHERE name = '${BACKFILL_JOB_NAME}';
  " | tr -d '[:space:]'
)"

source_count="$(
  query_postgres "
    SELECT COUNT(*)
    FROM customers;
  " | tr -d '[:space:]'
)"

curl -fsS \
  -X POST \
  http://localhost:9200/customers/_refresh \
  >/dev/null

elasticsearch_count="$(
  curl -fsS \
    'http://localhost:9200/_cat/count/customers?h=count' |
    tr -d '[:space:]'
)"

missing_record_count="$(
  count_missing_elasticsearch_records
)"

rabbitmq_message_count="$(
  read_rabbitmq_message_count
)"

replayed_event_count="$(
  expr "${rabbitmq_message_count}" - "${source_count}"
)"

expected_replayed_event_count="$(
  expr "${killed_at}" - "${resume_checkpoint}"
)"

lost_record_count="${missing_record_count}"

if [[ "${final_status}" != "completed" ]]; then
  fail "Expected final status completed, got ${final_status}"
fi

if [[ "${snapshot_max_id}" != "${RECORD_COUNT}" ]]; then
  fail "Expected snapshot max ID ${RECORD_COUNT}, got ${snapshot_max_id}"
fi

if [[ "${final_checkpoint}" != "${snapshot_max_id}" ]]; then
  fail "Final checkpoint does not match snapshot max ID"
fi

if [[ "${processed_count}" != "${source_count}" ]]; then
  fail "Processed count does not match source count"
fi

if [[ "${elasticsearch_count}" != "${source_count}" ]]; then
  fail "Elasticsearch count does not match source count"
fi

if [[ "${missing_record_count}" != "0" ]]; then
  fail "Elasticsearch is missing ${missing_record_count} records"
fi

if [[ "${replayed_event_count}" != "${expected_replayed_event_count}" ]]; then
  fail "Replay count does not match unfinished batch progress"
fi

pass