"""Tools exposed to the model."""

from langchain_core.tools import tool

from agent.tools.sandbox import Language, run_code
from agent.tools.skills import load_skill
from agent.tools.sql import export_sql, run_sql


@tool("run_code", parse_docstring=True)
def run_code_tool(code: str, language: Language = "python") -> str:
    """Run Python or JavaScript in the sandbox. Working directory is workspace/; save deliverables to outputs/.

    Args:
        code: The full script to run.
        language: "python" or "javascript" (Node, ES modules).
    """
    return run_code(code, language).model_dump_json()


TOOLS = [
    tool(run_sql, parse_docstring=True),
    tool(export_sql, parse_docstring=True),
    run_code_tool,
    tool(load_skill, parse_docstring=True),
]
