"""Read-only SQL tools for the agent. Connects as verbatim_ro (see db/roles.sql)."""

import re
import time
from pathlib import Path
from typing import LiteralString, cast

import psycopg
from psycopg import sql as pgsql

from agent.config import get_settings

CURSOR_STATEMENTS = ("select", "with", "values", "table")


def connect() -> psycopg.Connection:
    return psycopg.connect(get_settings().database_url_ro.get_secret_value(), application_name="verbatim")


def _query(sql: str) -> LiteralString:
    # Agent-written SQL is dynamic by design; the read-only role and statement timeout are the guard.
    return cast(LiteralString, sql.strip().rstrip(";"))


def _cell(value: object) -> str:
    if value is None:
        return "NULL"
    limit = get_settings().sql_max_cell_chars
    text = " ".join(str(value).split()).replace("|", "\\|")
    return text if len(text) <= limit else text[:limit] + "…"


def _error(e: psycopg.Error) -> str:
    return f"ERROR: {str(e).strip()}"


def run_sql(sql: str, max_rows: int = 100) -> str:
    """Run a read-only PostgreSQL query and return the rows as a markdown table.

    Args:
        sql: The query to run.
        max_rows: Maximum rows to return (capped at the configured limit).
    """
    max_rows = max(1, min(max_rows, get_settings().sql_max_rows))
    query = _query(sql)
    start = time.monotonic()
    try:
        with connect() as conn:
            # Server-side cursor so huge results are never pulled into memory.
            first_word = query.split(None, 1)[0].lower() if query else ""
            cursor = conn.cursor(name="q") if first_word in CURSOR_STATEMENTS else conn.cursor()
            with cursor as cur:
                cur.execute(query)
                if cur.description is None:
                    return "OK (no rows returned)"
                columns = [d.name for d in cur.description]
                rows = cur.fetchmany(max_rows + 1)
    except psycopg.Error as e:
        return _error(e)

    more = len(rows) > max_rows
    rows = rows[:max_rows]
    note = " shown, more available: aggregate, add LIMIT, or use export_sql" if more else ""
    lines = [
        f"{len(rows)} row(s){note} | {time.monotonic() - start:.2f}s",
        "| " + " | ".join(columns) + " |",
        "|" + "---|" * len(columns),
        *("| " + " | ".join(_cell(v) for v in row) + " |" for row in rows),
    ]
    return "\n".join(lines)


def export_sql(sql: str, filename: str) -> str:
    """Save the full result of a query as CSV in workspace/exports/ so code in the sandbox can read it.

    Args:
        sql: The query whose result to export.
        filename: Name of the CSV file to create (sanitized, .csv added).
    """
    exports = get_settings().workspace_dir / "exports"
    name = re.sub(r"[^\w.-]", "_", Path(filename).stem) + ".csv"
    path = exports / name
    exports.mkdir(parents=True, exist_ok=True)
    copy_sql = pgsql.SQL("COPY ({}) TO STDOUT WITH (FORMAT csv, HEADER)").format(pgsql.SQL(_query(sql)))
    try:
        with connect() as conn, conn.cursor() as cur, path.open("wb") as f:
            with cur.copy(copy_sql) as copy:
                for chunk in copy:
                    f.write(chunk)
            count = cur.rowcount
    except psycopg.Error as e:
        path.unlink(missing_ok=True)
        return _error(e)
    size_mb = path.stat().st_size / 1e6
    return f"Exported {count:,} rows ({size_mb:.1f} MB) to exports/{name}. In run_code: pd.read_csv('exports/{name}')"
