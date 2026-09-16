#!/usr/bin/env bash

set -euo pipefail

RECORD_COUNT=10
BATCH_RECORD_COUNT=500
FAILED_RECORD_COUNT=3
SUCCESSFUL_RECORD_COUNT="$(
  expr "${BATCH_RECORD_COUNT}" - "${FAILED_RECORD_COUNT}"
)"
MAXIMUM_WAIT_ATTEMPTS=600

POSTGRES_USER_NAME=app_user
POSTGRES_DATABASE_NAME=kill_it_twice
INCREMENTAL_JOB_NAME=customers

MAIN_QUEUE_NAME=customer.events.consumer
DEAD_LETTER_QUEUE_NAME=customer.events.dlq

pass() {
  echo "G4 partial batch failure ........ PASS (${successful_document_count} written, ${dead_letter_queue_count} in DLQ)"
  echo "Processed batch records ......... ${processed_count}"
  echo "Successful Elasticsearch docs ... ${successful_document_count}"
  echo "Failed Elasticsearch docs ....... ${failed_document_count}"
  echo "Main queue messages .............. ${main_queue_count}"
  echo "DLQ messages ..................... ${dead_letter_queue_count}"
  echo "Final checkpoint ................. ${final_checkpoint}"
}

fail() {
  echo "G4 partial batch failure ........ FAIL"
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

INCREMENTAL_SYNC_BATCH_SIZE="${BATCH_RECORD_COUNT}" \
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
  SELECT
    900000 + generated_number,
    1,
    'INSERT',
    jsonb_build_object(
      'id', 900000 + generated_number,
      'name', 'Batch Customer ' || generated_number,
      'email',
        'batch-customer-' || generated_number || '@example.com',
      'status',
        CASE
          WHEN generated_number IN (100, 250, 400)
            THEN jsonb_build_object('invalid', true)
          ELSE to_jsonb('active'::TEXT)
        END,
      'attributes', '{}'::jsonb,
      'version', 1,
      'created_at', NOW(),
      'updated_at', NOW()
    )
  FROM generate_series(
    1,
    ${BATCH_RECORD_COUNT}
  ) AS generated(generated_number);
" >/dev/null

expected_checkpoint="$((RECORD_COUNT + BATCH_RECORD_COUNT))"

wait_for_checkpoint "${expected_checkpoint}"

curl -fsS \
  -X POST \
  http://localhost:9200/customers/_refresh \
  >/dev/null

test_entity_ids="$(
  query_postgres "
    SELECT json_agg(
      (900000 + generated_number)::TEXT
      ORDER BY generated_number
    )::TEXT
    FROM generate_series(
      1,
      ${BATCH_RECORD_COUNT}
    ) AS generated(generated_number);
  "
)"

documents="$(
  printf '{"ids":%s}' "${test_entity_ids}" |
    curl -fsS \
      -H 'Content-Type: application/json' \
      -X POST \
      --data-binary @- \
      http://localhost:9200/customers/_mget
)"

successful_document_count="$(
  printf '%s\n' "${documents}" |
    awk -F'"found":true' '
      {
        found_count += NF - 1
      }

      END {
        print found_count + 0
      }
    '
)"

failed_document_count="$(
  printf '%s\n' "${documents}" |
    awk -F'"found":false' '
      {
        missing_count += NF - 1
      }

      END {
        print missing_count + 0
      }
    '
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

delivered_metric_count="$(
  read_metric_value "pipeline_delivered_events_total"
)"

dead_letter_metric_count="$(
  read_metric_value "pipeline_dead_letter_events_total"
)"

incremental_logs="$(
  docker compose logs --no-color incremental-sync
)"

dead_letter_log_count="$(
  printf '%s\n' "${incremental_logs}" |
    grep -F '"event":"customer_change_sent_to_dlq"' |
    grep -c '"failedDestination":"elasticsearch"' || true
)"

if [[ "${successful_document_count}" != "${SUCCESSFUL_RECORD_COUNT}" ]]; then
  fail "Expected ${SUCCESSFUL_RECORD_COUNT} successful documents"
fi

if [[ "${failed_document_count}" != "${FAILED_RECORD_COUNT}" ]]; then
  fail "Expected ${FAILED_RECORD_COUNT} failed documents"
fi

if [[ "${main_queue_count}" != "${SUCCESSFUL_RECORD_COUNT}" ]]; then
  fail "Expected ${SUCCESSFUL_RECORD_COUNT} main queue messages"
fi

if [[ "${dead_letter_queue_count}" != "${FAILED_RECORD_COUNT}" ]]; then
  fail "Expected ${FAILED_RECORD_COUNT} DLQ messages"
fi

if [[ "${final_checkpoint}" != "${expected_checkpoint}" ]]; then
  fail "Checkpoint did not move past the complete batch"
fi

if [[ "${processed_count}" != "${BATCH_RECORD_COUNT}" ]]; then
  fail "Expected ${BATCH_RECORD_COUNT} processed batch records"
fi

if [[ "${delivered_metric_count}" != "${SUCCESSFUL_RECORD_COUNT}" ]]; then
  fail "Delivered metric does not match successful records"
fi

if [[ "${dead_letter_metric_count}" != "${FAILED_RECORD_COUNT}" ]]; then
  fail "DLQ metric does not match failed records"
fi

if [[ "${dead_letter_log_count}" != "${FAILED_RECORD_COUNT}" ]]; then
  fail "Expected ${FAILED_RECORD_COUNT} structured DLQ logs"
fi

pass