#!/usr/bin/env bash
# Start the Agent Server (API, port 2024) and the web app (port 3001). Ctrl-C stops both.
set -euo pipefail
cd "$(dirname "$0")/.."

uv run langgraph dev --no-browser --port 2024 &
api=$!
(cd web && pnpm dev) &
web=$!
trap 'kill $api $web 2>/dev/null' EXIT INT TERM

echo "API: http://localhost:2024   UI: http://localhost:3001"
wait
