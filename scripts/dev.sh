#!/usr/bin/env bash
set -e

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM EXIT

(
  cd api
  set -a
  [ -f ../.env.local ] && . ../.env.local
  [ -f ../artifacts/api-server/.env ] && . ../artifacts/api-server/.env
  set +a
  PORT=8080 NODE_ENV=development pnpm exec tsx server.ts
) &
API_PID=$!

(
  cd artifacts/universe
  PORT=23974 BASE_PATH=/ pnpm run dev
) &
WEB_PID=$!

wait $API_PID $WEB_PID
