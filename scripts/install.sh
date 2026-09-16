#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"

cd "${PROJECT_ROOT}"

fail() {
  echo "Docker dependency installation failed: $1" >&2
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  fail "Docker is required"
fi

if ! docker compose version >/dev/null 2>&1; then
  fail "Docker Compose v2 is required"
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

echo "Validating Docker Compose configuration..."
docker compose config --quiet

echo "Building application images..."
echo "Each image installs dependencies from its own package-lock.json."

docker compose build \
  backend \
  frontend \
  migrate \
  destination-setup \
  backfill \
  consumer \
  incremental-sync

echo
echo "Docker images built successfully."
echo "Backend dependencies were installed from backend/package-lock.json."
echo "Frontend dependencies were installed from frontend/package-lock.json."