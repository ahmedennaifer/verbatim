"""Tests for the agent's tools. Most need the local `reviews` database and the sandbox install."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from agent.nodes.schema import build_schema_prompt, load_schema
from agent.tools.sandbox import run_code
from agent.tools.skills import Skill, load_skill, skill_catalog
from agent.tools.sql import export_sql, run_sql


@pytest.mark.integration
def test_schema_has_all_tables_and_joins():
    schema = load_schema()
    assert {t.name for t in schema.tables} == {"brands", "products", "reviews"}
    assert {(k.table, k.ref_table) for k in schema.foreign_keys} == {("products", "brands"), ("reviews", "products")}
    assert "## Data notes" in build_schema_prompt()


@pytest.mark.integration
def test_run_sql_returns_table():
    assert run_sql("select 1 as one").splitlines()[1:] == ["| one |", "|---|", "| 1 |"]


@pytest.mark.integration
def test_run_sql_caps_rows_without_loading_everything():
    assert "more available" in run_sql("select * from reviews", max_rows=1).splitlines()[0]


@pytest.mark.integration
def test_run_sql_truncates_long_text():
    assert run_sql("select repeat('x', 1000)").splitlines()[-1].endswith("… |")


@pytest.mark.integration
@pytest.mark.parametrize(
    ("sql", "error"),
    [
        ("delete from brands", "read-only transaction"),
        ("selec 1", "syntax error"),
        ("select pg_sleep(20)", "statement timeout"),
    ],
)
def test_run_sql_errors_are_returned_as_text(sql, error):
    result = run_sql(sql)
    assert result.startswith("ERROR:") and error in result


@pytest.mark.integration
def test_export_sql_is_readable_from_sandbox():
    assert export_sql("select rating from reviews limit 10", "test export").startswith("Exported 10 rows")
    result = run_code("import pandas as pd; print(len(pd.read_csv('exports/test_export.csv')))")
    assert result.ok and result.output.strip() == "10"


@pytest.mark.integration
def test_run_code_returns_output_files():
    result = run_code("open('outputs/test.txt', 'w').write('hi')")
    assert result.ok and result.files == ["outputs/test.txt"]


@pytest.mark.integration
def test_run_code_javascript():
    assert run_code("console.log(1 + 1)", "javascript").output.strip() == "2"


@pytest.mark.integration
@pytest.mark.parametrize(
    "code",
    [
        "open('../.env').read()",
        "open('../escaped.txt', 'w').write('x')",
        "import urllib.request; urllib.request.urlopen('https://example.com', timeout=5)",
        "import socket; socket.create_connection(('127.0.0.1', 5432), timeout=3)",
    ],
)
def test_run_code_is_isolated(code):
    assert not run_code(code).ok


def test_skill_catalog_and_loading():
    assert {"sql", "sandbox"} <= {line.split(":")[0].lstrip("- ") for line in skill_catalog().splitlines()}
    assert load_skill("sql").startswith("# SQL")
    assert load_skill("nope").startswith("ERROR: unknown skill")


def test_skill_name_must_match_directory(tmp_path: Path):
    path = tmp_path / "other" / "SKILL.md"
    path.parent.mkdir()
    path.write_text("---\nname: sql\ndescription: x\n---\nbody")
    with pytest.raises(ValidationError):
        Skill.from_file(path)
