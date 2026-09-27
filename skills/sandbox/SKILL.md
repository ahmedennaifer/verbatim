---
name: sandbox
description: Run Python or JavaScript to build charts, spreadsheets, PDFs, HTML pages or do calculations SQL can't do well. Use only when the user needs a file or a computation beyond SQL.
---

# Code sandbox

Tool: `run_code(code, language="python" | "javascript")` → `{ok, output, files}`

## When to use
- The user asks for a file: chart, spreadsheet (xlsx/csv), PDF, HTML page or interactive view.
- A computation is awkward in SQL (statistics, text processing on an exported sample, reshaping).

## When NOT to use
- Anything SQL can answer directly (counts, averages, filters, group-bys). Use the SQL tool.
- To query the database. The sandbox has **no database access** and **no internet**.
- To "look at" data you already have in the conversation. Summarize it instead.

## Getting data in
1. Export the query result to `workspace/` with the SQL tool (CSV or Parquet).
2. Read that file in your code, e.g. `pd.read_parquet("exports/complaints.parquet")`.
Never paste rows into the code.

## Getting files out
- The working directory is `workspace/`. Write deliverables to `outputs/` (e.g. `outputs/report.pdf`).
- Only files in `outputs/` reach the user; the tool lists new or changed ones in `files`.
- Anything else you write (scratch files) stays in `workspace/` and is not shown.

## Available
- **Python**: pandas, pyarrow, matplotlib (headless, use `savefig`), openpyxl, reportlab. Standard library.
  Charts: a house style (colours, fonts, grid, DPI) is preloaded. Don't set colours or styles yourself unless colour
  encodes meaning; give every chart a clear title and axis labels in plain text (no emoji or symbols such as ★),
  and save it as PNG in `outputs/`.
- **JavaScript**: Node (ES modules, `.mjs`), built-in modules only (`node:fs`, `node:path`, ...). No npm packages.
  For interactive pages, write a self-contained `.html` file with inline JS and CSS.
- You cannot install packages.

## Limits
- 60 s per run; the process is killed after that.
- Output is truncated at 20,000 characters: print summaries, not whole tables.
- Each run is a fresh process: no variables survive between runs. Save to files to keep state.
- Writes outside `workspace/`, network access and reading secrets fail with `PermissionError` / `403`.
  That is expected, don't retry or work around it.
