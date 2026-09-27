"""Schema node: builds the database description passed to the planner and executor."""

from __future__ import annotations

from functools import cache
from typing import TYPE_CHECKING

from pydantic import BaseModel

from agent.tools.sql import connect

if TYPE_CHECKING:
    from agent.graph import State

# Hand-written facts about the data, checked against the loaded dataset.
DATA_NOTES = """\
- Source: Amazon Reviews 2023, two categories: All_Beauty (~112k products) and Amazon_Fashion (~826k products).
- Reviews span 2000-11 to 2023-09.
- Ratings are skewed: ~58% of reviews are 5 stars. Compare distributions, not just averages.
- ~12% of reviews have a body under 20 characters ("Great!", "Love it"). Filter on length(body) when reading opinions.
- ~93% of products have no price_usd. Price questions only cover a small subset: say so.
- Brand names are messy seller fields (e.g. "Generic", unknown sellers). Match brands with lower(name) or ILIKE
  and check which variants exist before aggregating. Luxury brands present include CHANEL, Dior, Gucci, Prada,
  Versace, Tom Ford, Michael Kors, COACH, Ralph Lauren, Calvin Klein.
- One product (parent_asin) groups several variants (asin). Aggregate reviews by parent_asin.
- Product names in questions rarely match titles exactly: search products.title with ILIKE and confirm matches first.
- Full-text search on reviews only uses the index with this exact expression:
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')) @@ plainto_tsquery('english', '<words>')
- Queries time out after 15s: aggregate in SQL, avoid scanning review text without a filter.
"""

COLUMNS_SQL = """
SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod),
       col_description(c.oid, a.attnum), obj_description(c.oid, 'pg_class'),
       c.reltuples::bigint
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.relkind = 'r'
ORDER BY c.relname, a.attnum
"""

FOREIGN_KEYS_SQL = """
SELECT conrelid::regclass::text, a.attname, confrelid::regclass::text, af.attname
FROM pg_constraint k
JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
JOIN pg_attribute af ON af.attrelid = k.confrelid AND af.attnum = k.confkey[1]
WHERE k.contype = 'f' AND k.connamespace = 'public'::regnamespace
"""

# Planner statistics give common values without scanning the tables.
COMMON_VALUES_SQL = """
SELECT tablename, attname, most_common_vals::text
FROM pg_stats
WHERE schemaname = 'public' AND n_distinct BETWEEN 1 AND 20 AND most_common_vals IS NOT NULL
"""


class Column(BaseModel):
    name: str
    type: str
    comment: str | None = None
    common_values: str | None = None

    def to_prompt(self) -> str:
        line = f"- {self.name} {self.type}"
        if self.comment:
            line += f" — {self.comment}"
        if self.common_values:
            line += f" | values: {self.common_values}"
        return line


class Table(BaseModel):
    name: str
    row_estimate: int
    comment: str | None = None
    columns: list[Column] = []

    def to_prompt(self) -> str:
        header = f"### {self.name} (~{self.row_estimate:,} rows){f' — {self.comment}' if self.comment else ''}"
        return "\n".join([header, *(c.to_prompt() for c in self.columns)])


class ForeignKey(BaseModel):
    table: str
    column: str
    ref_table: str
    ref_column: str


class DatabaseSchema(BaseModel):
    tables: list[Table]
    foreign_keys: list[ForeignKey]
    notes: str = DATA_NOTES

    def to_prompt(self) -> str:
        parts = ["## Database schema (PostgreSQL, read-only)"]
        parts += [f"\n{t.to_prompt()}" for t in self.tables]
        parts += ["\n## Joins", *(f"- {k.table}.{k.column} → {k.ref_table}.{k.ref_column}" for k in self.foreign_keys)]
        parts += ["\n## Data notes", self.notes]
        return "\n".join(parts)


def load_schema() -> DatabaseSchema:
    with connect() as conn:
        column_rows = conn.execute(COLUMNS_SQL).fetchall()
        fk_rows = conn.execute(FOREIGN_KEYS_SQL).fetchall()
        common = {(t, c): v.strip("{}") for t, c, v in conn.execute(COMMON_VALUES_SQL).fetchall()}

    tables: dict[str, Table] = {}
    for table, column, type_, col_comment, table_comment, rows in column_rows:
        entry = tables.setdefault(table, Table(name=table, row_estimate=rows, comment=table_comment))
        entry.columns.append(
            Column(name=column, type=type_, comment=col_comment, common_values=common.get((table, column)))
        )
    foreign_keys = [ForeignKey(table=t, column=c, ref_table=rt, ref_column=rc) for t, c, rt, rc in fk_rows]
    return DatabaseSchema(tables=list(tables.values()), foreign_keys=foreign_keys)


@cache
def build_schema_prompt() -> str:
    return load_schema().to_prompt()


def schema_node(state: State) -> dict:
    return {"db_schema": build_schema_prompt()}
