#!/usr/bin/env bash
set -e

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM EXIT

(
  cd artifacts/api-server
  PORT=8080 NODE_ENV=development pnpm run dev
) &
API_PID=$!

(
  cd artifacts/universe
  PORT=23974 BASE_PATH=/ pnpm run dev
) &
WEB_PID=$!

wait $API_PID $WEB_PID
