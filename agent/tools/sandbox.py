"""Run agent-written Python or JavaScript inside an OS-level sandbox (Anthropic sandbox-runtime).

The code can read files in workspace/, write only to workspace/, and has no network.
Files written to workspace/outputs/ are returned to the user.
"""

import json
import os
import shutil
import signal
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from agent.config import ROOT, get_settings

SANDBOX = ROOT / "sandbox"
SRT = SANDBOX / "node_modules" / ".bin" / "srt"
PYTHON = SANDBOX / ".venv" / "bin" / "python"
NODE = shutil.which("node") or "node"
SECRETS = ["~/.ssh", "~/.aws", "~/.config", "~/.gnupg", "~/.pgpass", "~/.zsh_history", "~/.bash_history"]

Language = Literal["python", "javascript"]
RUNTIMES: dict[Language, tuple[str, str]] = {"python": (str(PYTHON), ".py"), "javascript": (NODE, ".mjs")}


class RunCodeResult(BaseModel):
    ok: bool = Field(description="True if the code exited successfully")
    output: str = Field(description="Combined stdout and stderr, truncated if long")
    files: list[str] = Field(
        default_factory=list, description="New or changed files in outputs/, relative to workspace/"
    )


def _write_srt_settings(scratch: Path) -> Path:
    """Sandbox rules: write only to the workspace, no network, no secrets or database files."""
    rules = {
        "filesystem": {
            "allowWrite": [str(get_settings().workspace_dir)],
            "denyRead": [str(ROOT / ".env"), str(ROOT / "db"), *SECRETS],
            "denyWrite": [],
        },
        "network": {"allowedDomains": [], "deniedDomains": []},
    }
    path = scratch / "srt.json"
    path.write_text(json.dumps(rules))
    return path


def _snapshot(outputs: Path) -> dict[Path, float]:
    return {p: p.stat().st_mtime for p in outputs.rglob("*") if p.is_file()}


def run_code(code: str, language: Language = "python") -> RunCodeResult:
    """Run Python or JavaScript in the sandbox. Working directory is workspace/; save deliverables to outputs/.

    Args:
        code: The full script to run.
        language: "python" or "javascript" (Node, ES modules).
    """
    settings = get_settings()
    workspace = settings.workspace_dir
    outputs, tmp = workspace / "outputs", workspace / ".tmp"
    # Scripts live outside the project: a new .py file under it makes the dev server reload mid-run.
    scratch = Path(tempfile.gettempdir()) / "verbatim-sandbox"
    for d in (outputs, tmp, scratch):
        d.mkdir(parents=True, exist_ok=True)

    interpreter, suffix = RUNTIMES[language]
    script = scratch / f"{uuid.uuid4().hex}{suffix}"
    script.write_text(code)
    before = _snapshot(outputs)
    env = {
        "PATH": f"{PYTHON.parent}:{Path(NODE).parent}:/usr/bin:/bin",
        "HOME": str(workspace),
        "TMPDIR": str(tmp),
        "MPLCONFIGDIR": str(tmp / "matplotlib"),
        "MPLBACKEND": "Agg",
        "MATPLOTLIBRC": str(SANDBOX / "matplotlib" / "matplotlibrc"),
    }
    proc = subprocess.Popen(
        [str(SRT), "--settings", str(_write_srt_settings(scratch)), interpreter, str(script)],
        cwd=workspace,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )
    try:
        output, _ = proc.communicate(timeout=settings.sandbox_timeout_s)
        ok = proc.returncode == 0
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGKILL)
        output, _ = proc.communicate()
        output = (output or "") + f"\n[killed: exceeded {settings.sandbox_timeout_s}s time limit]"
        ok = False
    finally:
        script.unlink(missing_ok=True)

    limit = settings.sandbox_max_output_chars
    if len(output) > limit:
        output = output[:limit] + f"\n[output truncated at {limit} chars]"
    after = _snapshot(outputs)
    files = sorted(str(p.relative_to(workspace)) for p, mtime in after.items() if before.get(p) != mtime)
    return RunCodeResult(ok=ok, output=output, files=files)
