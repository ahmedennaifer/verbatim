---
name: sql
description: Query the reviews database (brands, products, reviews) with read-only PostgreSQL. Use for any number, list, trend or sample of reviews.
---

# SQL

Tools:
- `run_sql(sql, max_rows=100)` → markdown table, max 200 rows, long text cut at 300 characters.
- `export_sql(sql, filename)` → full result as CSV in `workspace/exports/`, for the code sandbox.

The schema and data notes are in your context. Read the data notes before writing queries.

## How to work
1. **Resolve entities first.** Find the exact products/brands the user means before analysing:
   `SELECT parent_asin, title, rating_count FROM products WHERE title ILIKE '%...%' ORDER BY rating_count DESC NULLS LAST LIMIT 20`.
   If several candidates match, say which ones you picked and why.
2. **Check the size.** Count reviews for the matched products before reading any text.
3. **Aggregate in SQL.** Counts, averages, distributions, trends by month: let Postgres do it.
4. **Sample text on purpose.** When reading opinions, pull a balanced sample instead of the first rows:
   some of each rating, the most helpful (`helpful_votes DESC`), and recent ones; skip very short bodies.

## run_sql vs export_sql
- `run_sql` when you need to *see* the result (up to 200 rows).
- `export_sql` when code needs the data (charts, spreadsheets, many rows). Never copy rows by hand into code.

## Rules
- Read-only: writes fail. Don't retry them.
- Queries are cancelled after 15 s. If that happens, add a filter, aggregate, or use the full-text index.
- Errors come back as `ERROR: ...` with the Postgres message. Fix the query and try again.
- Always add `LIMIT` when listing rows.
