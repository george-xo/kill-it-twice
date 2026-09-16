#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"

cd "${PROJECT_ROOT}"

if [[ ! -f .env ]]; then
  echo ".env is missing. Run: make setup" >&2
  exit 1
fi

echo "Building and starting the application..."

docker compose up \
  -d \
  --build \
  --wait \
  backend \
  frontend \
  consumer \
  incremental-sync

echo
echo "Application started successfully."
echo "Frontend:  http://localhost:8080"
echo "Backend:   http://localhost:3000"
echo "Status:    http://localhost:3000/status"
echo "RabbitMQ:  http://localhost:15672"