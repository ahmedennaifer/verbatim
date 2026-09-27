#!/usr/bin/env bash
# Install the agent, the code sandbox and the web app.
set -euo pipefail
cd "$(dirname "$0")/.."

uv sync
uv venv --quiet --allow-existing sandbox/.venv
uv pip install --quiet --python sandbox/.venv/bin/python -r sandbox/requirements.txt
npm ci --prefix sandbox
pnpm --dir web install --frozen-lockfile
[ -f .env ] || cp .env.example .env
