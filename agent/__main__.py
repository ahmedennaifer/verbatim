"""Talk to the agent: `uv run python -m agent` for a session, or `uv run python -m agent "question"`."""

import argparse
import json
import logging
import time
import uuid

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.state import CompiledStateGraph

from agent.config import get_settings
from agent.graph import build_graph
from agent.metrics import RunRecord, RunTotals, track_run

log = logging.getLogger("agent")


def _short(text: str, limit: int = 160) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit] + "…"


def _log_plan(plan: dict | None) -> None:
    if plan is None:
        log.info("Plan: none (planner output was invalid)")
        return
    lines = [f"Objective: {plan['objective']}"]
    lines += [f"  assumption: {a}" for a in plan["assumptions"]]
    lines += [f"  {i}. {s['goal']} [{', '.join(s['skills'])}]" for i, s in enumerate(plan["steps"], 1)]
    log.info("\n".join(lines))


def _log_messages(messages: list) -> str | None:
    """Log tool calls, tool results and notes; return the reply to the user if there is one."""
    reply = None
    for message in messages:
        if isinstance(message, AIMessage):
            if message.tool_calls and message.text:
                log.info("· %s", _short(message.text, 300))
            for call in message.tool_calls:
                log.info("→ %s %s", call["name"], _short(json.dumps(call["args"]), 400))
            if not message.tool_calls:
                reply = message.text
        elif isinstance(message, ToolMessage):
            log.info("  ← %s", _short(message.text))
    return reply


def run_turn(graph: CompiledStateGraph, thread_id: str, turn: int, message: str) -> str:
    settings = get_settings()
    config: RunnableConfig = {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": settings.agent_recursion_limit,
    }
    started = time.monotonic()
    reply = None
    with track_run() as calls:
        try:
            for update in graph.stream({"messages": [HumanMessage(message)]}, config, stream_mode="updates"):
                for node, data in update.items():
                    if node == "planner":
                        _log_plan(data["plan"])
                    reply = _log_messages((data or {}).get("messages", [])) or reply
        finally:
            seconds = time.monotonic() - started
            totals = RunTotals.from_calls(calls)
            run_id = f"{thread_id}-{turn}"
            RunRecord(run_id=run_id, question=message, seconds=round(seconds, 2), totals=totals, calls=calls).save()
            log.info("[turn %s] %s | %.1fs total", run_id, totals, seconds)
    return reply or "(no reply)"


def main() -> None:
    parser = argparse.ArgumentParser(description="Talk to the reviews agent.")
    parser.add_argument("question", nargs="*", help="Ask one question and exit; omit for a session.")
    question = " ".join(parser.parse_args().question)

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    graph = build_graph(checkpointer=InMemorySaver())
    thread_id = uuid.uuid4().hex[:8]

    if question:
        print(f"\n{run_turn(graph, thread_id, 1, question)}\n")
        return

    print("Reviews agent. Ask a question, or press Ctrl-D to quit.")
    turn = 0
    while True:
        try:
            message = input("\nyou> ").strip()
        except EOFError, KeyboardInterrupt:
            print()
            return
        if message:
            turn += 1
            print(f"\nagent> {run_turn(graph, thread_id, turn, message)}")


if __name__ == "__main__":
    main()
