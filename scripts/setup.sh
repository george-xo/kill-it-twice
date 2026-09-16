#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"

SEED_COUNT="${SEED_COUNT:-1000}"

MAIN_QUEUE_NAME="customer.events.consumer"
DEAD_LETTER_QUEUE_NAME="customer.events.dlq"

cd "${PROJECT_ROOT}"

fail() {
  echo "Project setup failed: $1" >&2
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  fail "Docker is required"
fi

if ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose is required"
fi

if ! [[ "${SEED_COUNT}" =~ ^[1-9][0-9]*$ ]]; then
  fail "SEED_COUNT must be a positive integer"
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

echo "Validating Docker Compose configuration..."
docker compose config --quiet

echo "Building Backend setup images..."
docker compose build \
  backend \
  migrate \
  destination-setup \
  backfill

echo "Starting infrastructure..."
docker compose up -d --wait \
  postgres \
  elasticsearch \
  rabbitmq

echo "Stopping application workers..."
docker compose stop \
  backend \
  frontend \
  backfill \
  consumer \
  incremental-sync \
  >/dev/null 2>&1 || true

echo "Running database migrations..."
docker compose run --rm migrate

echo "Seeding ${SEED_COUNT} customers..."
docker compose run --rm \
  -e SEED_COUNT="${SEED_COUNT}" \
  backend \
  node dist/seed/seed.js

echo "Resetting Elasticsearch customer index..."

elasticsearch_status="$(
  docker compose exec -T elasticsearch \
    curl \
    --silent \
    --output /dev/null \
    --write-out '%{http_code}' \
    -X DELETE \
    http://127.0.0.1:9200/customers
)"

if [[ "${elasticsearch_status}" != "200" &&
  "${elasticsearch_status}" != "404" ]]; then
  fail "Elasticsearch index reset returned HTTP ${elasticsearch_status}"
fi

echo "Creating destination topology..."
docker compose run --rm destination-setup

echo "Clearing RabbitMQ queues..."
docker compose exec -T rabbitmq \
  rabbitmqctl purge_queue "${MAIN_QUEUE_NAME}" \
  >/dev/null

docker compose exec -T rabbitmq \
  rabbitmqctl purge_queue "${DEAD_LETTER_QUEUE_NAME}" \
  >/dev/null

echo "Running initial Backfill..."
docker compose run --rm --no-deps backfill

echo
echo "Project setup completed successfully."
echo "Seeded customers: ${SEED_COUNT}"
echo "Next command: make start"