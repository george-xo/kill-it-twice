#!/usr/bin/env bash

set -euo pipefail

RECORD_COUNT=10
MAXIMUM_WAIT_ATTEMPTS=120

POSTGRES_USER_NAME=app_user
POSTGRES_DATABASE_NAME=kill_it_twice
INCREMENTAL_JOB_NAME=customers

MAIN_QUEUE_NAME=customer.events.consumer
DEAD_LETTER_QUEUE_NAME=customer.events.dlq

pass() {
  echo "G4 partial batch and DLQ ........ PASS"
  echo "Processed batch records ......... ${processed_count}"
  echo "Successful Elasticsearch docs ... ${successful_document_count}"
  echo "Failed Elasticsearch docs ....... ${failed_document_count}"
  echo "Main queue messages .............. ${main_queue_count}"
  echo "DLQ messages ..................... ${dead_letter_queue_count}"
  echo "Final checkpoint ................. ${final_checkpoint}"
}

fail() {
  echo "G4 partial batch and DLQ ........ FAIL"
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

read_queue_count() {
  local queue_name="$1"

  docker compose exec -T rabbitmq \
    rabbitmqctl list_queues name messages 2>/dev/null |
    awk -v queue="${queue_name}" \
      '$1 == queue { print $2 }' |
    tr -d '[:space:]'
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

echo "Preparing G4 verification environment..."

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
  incremental-sync

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
  rabbitmqctl purge_queue "${MAIN_QUEUE_NAME}" \
  >/dev/null

docker compose exec -T rabbitmq \
  rabbitmqctl purge_queue "${DEAD_LETTER_QUEUE_NAME}" \
  >/dev/null

DESTINATION_RETRY_MAX_ATTEMPTS=2 \
DESTINATION_RETRY_INITIAL_DELAY_MS=50 \
DESTINATION_RETRY_MAX_DELAY_MS=50 \
docker compose up \
  -d \
  --no-deps \
  --force-recreate \
  incremental-sync \
  >/dev/null

wait_for_checkpoint "${RECORD_COUNT}"

query_postgres "
  INSERT INTO change_log (
    entity_id,
    entity_version,
    operation,
    payload
  )
  VALUES
  (
    900001,
    1,
    'INSERT',
    jsonb_build_object(
      'id', 900001,
      'name', 'Valid Customer 1',
      'email', 'valid900001@example.com',
      'status', 'active',
      'attributes', '{}'::jsonb,
      'version', 1,
      'created_at', NOW(),
      'updated_at', NOW()
    )
  ),
  (
    900002,
    1,
    'INSERT',
    jsonb_build_object(
      'id', 900002,
      'name', 'Poison Customer',
      'email', 'poison900002@example.com',
      'status', jsonb_build_object('invalid', true),
      'attributes', '{}'::jsonb,
      'version', 1,
      'created_at', NOW(),
      'updated_at', NOW()
    )
  ),
  (
    900003,
    1,
    'INSERT',
    jsonb_build_object(
      'id', 900003,
      'name', 'Valid Customer 2',
      'email', 'valid900003@example.com',
      'status', 'active',
      'attributes', '{}'::jsonb,
      'version', 1,
      'created_at', NOW(),
      'updated_at', NOW()
    )
  );
" >/dev/null

expected_checkpoint="$((RECORD_COUNT + 3))"

wait_for_checkpoint "${expected_checkpoint}"

curl -fsS \
  -X POST \
  http://localhost:9200/customers/_refresh \
  >/dev/null

documents="$(
  curl -fsS \
    -H 'Content-Type: application/json' \
    -X POST \
    http://localhost:9200/customers/_mget \
    -d '{"ids":["900001","900002","900003"]}'
)"

successful_document_count="$(
  printf '%s\n' "${documents}" |
    grep -o '"found":true' |
    wc -l |
    tr -d '[:space:]'
)"

failed_document_count="$(
  printf '%s\n' "${documents}" |
    grep -o '"found":false' |
    wc -l |
    tr -d '[:space:]'
)"

main_queue_count="$(read_queue_count "${MAIN_QUEUE_NAME}")"

dead_letter_queue_count="$(
  read_queue_count "${DEAD_LETTER_QUEUE_NAME}"
)"

final_checkpoint="$(read_checkpoint)"

processed_count="$(
  query_postgres "
    SELECT processed_count
    FROM incremental_sync_jobs
    WHERE name = '${INCREMENTAL_JOB_NAME}';
  " | tr -d '[:space:]'
)"

incremental_logs="$(
  docker compose logs --no-color incremental-sync
)"

if [[ "${successful_document_count}" != "2" ]]; then
  fail "Expected 2 successful Elasticsearch documents"
fi

if [[ "${failed_document_count}" != "1" ]]; then
  fail "Expected 1 failed Elasticsearch document"
fi

if [[ "${main_queue_count}" != "2" ]]; then
  fail "Expected 2 messages in the main queue"
fi

if [[ "${dead_letter_queue_count}" != "1" ]]; then
  fail "Expected 1 message in the DLQ"
fi

if [[ "${final_checkpoint}" != "${expected_checkpoint}" ]]; then
  fail "Checkpoint did not move past the failed event"
fi

if [[ "${processed_count}" != "3" ]]; then
  fail "Expected 3 processed batch records"
fi

if [[ "${incremental_logs}" != *"Event customer:900002:1 sent to DLQ"* ]]; then
  fail "DLQ delivery was not logged"
fi

pass