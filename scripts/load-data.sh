#!/usr/bin/env bash
# Download the two Amazon Reviews 2023 categories, load them into Postgres and create the read-only role.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
source .env
set +a

base=https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw
mkdir -p data/raw
for category in All_Beauty Amazon_Fashion; do
  for file in "review_categories/$category" "meta_categories/meta_$category"; do
    target="data/raw/$(basename "$file").jsonl.gz"
    [ -f "$target" ] || curl -fL -o "$target" "$base/$file.jsonl.gz"
  done
done

createdb reviews 2>/dev/null || true
uv run db/load.py
psql -d reviews -v ON_ERROR_STOP=1 -v ro_password="$VERBATIM_RO_PASSWORD" -f db/roles.sql
