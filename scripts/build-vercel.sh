#!/usr/bin/env bash
set -e

REPO_ROOT="$(pwd)"
UNIVERSE_DIR="$REPO_ROOT/artifacts/universe"
OUTPUT_DIR="$REPO_ROOT/public"

cd "$UNIVERSE_DIR"
pnpm vite build --outDir "$OUTPUT_DIR" --emptyOutDir
echo "Build output written to $OUTPUT_DIR"
