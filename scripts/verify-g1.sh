#!/usr/bin/env bash

set -euo pipefail

RECORD_COUNT=10000
BATCH_SIZE=100
BATCH_DELAY_MS=500
MINIMUM_CHECKPOINT_BEFORE_KILL=300
MAXIMUM_WAIT_ATTEMPTS=120

POSTGRES_USER_NAME=app_user
POSTGRES_DATABASE_NAME=kill_it_twice
BACKFILL_JOB_NAME=customers
RABBITMQ_QUEUE_NAME=customer.events.consumer

pass() {
  echo "G1 resume after kill ............ PASS"
  echo "Killed after checkpoint ......... ${checkpoint_before_kill}"
  echo "Resumed from checkpoint ......... ${checkpoint_before_kill}"
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

  curl -fsS \
    -X POST \
    -H 'Content-Type: application/json' \
    --data-binary "{\"ids\":${source_ids_json}}" \
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

docker compose stop consumer backfill >/dev/null 2>&1 || true

docker compose up -d --wait postgres rabbitmq elasticsearch

docker compose build \
  migrate \
  backend \
  destination-setup \
  backfill

docker compose run --rm migrate

docker compose run --rm \
  -e SEED_COUNT="${RECORD_COUNT}" \
  backend \
  node dist/seed/seed.js

query_postgres "
  DELETE FROM backfill_jobs
  WHERE name = '${BACKFILL_JOB_NAME}';
" >/dev/null

curl -sS \
  -X DELETE \
  http://localhost:9200/customers \
  >/dev/null || true

docker compose run --rm destination-setup

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
  backfill

checkpoint_before_kill=""

for ((attempt = 1; attempt <= MAXIMUM_WAIT_ATTEMPTS; attempt += 1)); do
  checkpoint_before_kill="$(read_checkpoint)"

  if [[ "${checkpoint_before_kill}" =~ ^[0-9]+$ ]] &&
    ((checkpoint_before_kill >= MINIMUM_CHECKPOINT_BEFORE_KILL)); then
    break
  fi

  sleep 0.25
done

if [[ ! "${checkpoint_before_kill}" =~ ^[0-9]+$ ]] ||
  ((checkpoint_before_kill < MINIMUM_CHECKPOINT_BEFORE_KILL)); then
  fail "Backfill did not reach the required checkpoint before timeout"
fi

if ((checkpoint_before_kill >= RECORD_COUNT)); then
  fail "Backfill completed before it could be killed"
fi

echo "Killing Backfill at checkpoint ${checkpoint_before_kill}..."

backfill_container_id="$(docker compose ps -q backfill)"

if [[ -z "${backfill_container_id}" ]]; then
  fail "Backfill container was not found"
fi

docker kill "${backfill_container_id}" >/dev/null

stored_checkpoint_after_kill="$(read_checkpoint)"

if [[ "${stored_checkpoint_after_kill}" != "${checkpoint_before_kill}" ]]; then
  fail "Stored checkpoint changed after docker kill"
fi

backfill_status_after_kill="$(
  query_postgres "
    SELECT status
    FROM backfill_jobs
    WHERE name = '${BACKFILL_JOB_NAME}';
  " | tr -d '[:space:]'
)"

if [[ "${backfill_status_after_kill}" != "running" ]]; then
  fail "Expected job status running after docker kill, got ${backfill_status_after_kill}"
fi

echo "Restarting Backfill..."

docker compose start backfill >/dev/null

sleep 1

resume_log="$(
  docker compose logs --no-color backfill |
    grep 'Backfill started from customer ID' |
    tail -n 1
)"

if [[ "${resume_log}" != *"customer ID ${checkpoint_before_kill};"* ]]; then
  fail "Backfill did not resume from checkpoint ${checkpoint_before_kill}"
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

missing_record_count="$(count_missing_elasticsearch_records)"

rabbitmq_message_count="$(
  docker compose exec -T rabbitmq \
    rabbitmqctl list_queues name messages |
    awk -v queue="${RABBITMQ_QUEUE_NAME}" '$1 == queue { print $2 }' |
    tr -d '[:space:]'
)"

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

if [[ -z "${rabbitmq_message_count}" ]] ||
  ((rabbitmq_message_count < source_count)); then
  fail "RabbitMQ contains fewer events than the source record count"
fi

if [[ ! "${missing_record_count}" =~ ^[0-9]+$ ]]; then
  fail "Missing Elasticsearch record count is invalid"
fi

if ((missing_record_count > 0)); then
  fail "Elasticsearch is missing ${missing_record_count} source records"
fi

pass