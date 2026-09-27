"""Token and latency metrics for every model call.

The input tokens of a call are how full the context was for that call. Each call is logged as one line;
each run is appended to logs/runs.jsonl.
"""

import logging
import time
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Self

from langchain_core.messages import BaseMessage
from pydantic import BaseModel, Field

from agent.config import get_settings

log = logging.getLogger("agent.metrics")

_run_calls: ContextVar[list[CallUsage] | None] = ContextVar("run_calls", default=None)


@contextmanager
def track_run() -> Iterator[list[CallUsage]]:
    """Collect every CallUsage recorded while the block runs."""
    calls: list[CallUsage] = []
    token = _run_calls.set(calls)
    try:
        yield calls
    finally:
        _run_calls.reset(token)


class CallUsage(BaseModel):
    node: str
    input_tokens: int
    output_tokens: int
    seconds: float

    @property
    def context_pct(self) -> float:
        return 100 * self.input_tokens / get_settings().llm_context_window

    @classmethod
    def record(cls, node: str, message: BaseMessage, started: float) -> Self:
        usage = getattr(message, "usage_metadata", None) or {}
        call = cls(
            node=node,
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            seconds=round(time.monotonic() - started, 2),
        )
        log.info(
            "  [%s] context %s tokens (%.1f%%) | output %s | %.2fs",
            node,
            f"{call.input_tokens:,}",
            call.context_pct,
            f"{call.output_tokens:,}",
            call.seconds,
        )
        if (calls := _run_calls.get()) is not None:
            calls.append(call)
        return call


class RunTotals(BaseModel):
    calls: int
    input_tokens: int
    output_tokens: int
    peak_context: int
    model_seconds: float

    @classmethod
    def from_calls(cls, calls: list[CallUsage]) -> Self:
        return cls(
            calls=len(calls),
            input_tokens=sum(c.input_tokens for c in calls),
            output_tokens=sum(c.output_tokens for c in calls),
            peak_context=max((c.input_tokens for c in calls), default=0),
            model_seconds=round(sum(c.seconds for c in calls), 2),
        )

    def __str__(self) -> str:
        peak_pct = 100 * self.peak_context / get_settings().llm_context_window
        return (
            f"{self.calls} model calls | peak context {self.peak_context:,} tokens ({peak_pct:.1f}%) | "
            f"input {self.input_tokens:,} | output {self.output_tokens:,} | {self.model_seconds}s in model"
        )


class RunRecord(BaseModel):
    run_id: str
    at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    model: str = Field(default_factory=lambda: get_settings().llm_model)
    question: str
    seconds: float
    totals: RunTotals
    calls: list[CallUsage]

    def save(self) -> None:
        logs_dir = get_settings().logs_dir
        logs_dir.mkdir(exist_ok=True)
        with (logs_dir / "runs.jsonl").open("a") as f:
            f.write(self.model_dump_json() + "\n")
