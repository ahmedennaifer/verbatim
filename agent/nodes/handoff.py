"""Handoff node: turns the chat model's start_analysis call into the input of the analysis workflow."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from pydantic import BaseModel, ValidationError

if TYPE_CHECKING:
    from agent.graph import State

log = logging.getLogger(__name__)


class Handoff(BaseModel):
    conversation_summary: str
    request: str


def wants_analysis(state: State) -> bool:
    last = state["messages"][-1]
    return isinstance(last, AIMessage) and any(c["name"] == "start_analysis" for c in last.tool_calls)


def handoff_node(state: State) -> dict:
    messages = state["messages"]
    last = messages[-1]
    if not isinstance(last, AIMessage):
        raise TypeError("handoff_node must follow a start_analysis tool call")
    call = next(c for c in last.tool_calls if c["name"] == "start_analysis")
    try:
        handoff = Handoff.model_validate(call["args"])
    except ValidationError as e:
        log.warning("start_analysis arguments invalid, using the user's last message: %s", e)
        last_user = next(m for m in reversed(messages) if isinstance(m, HumanMessage))
        handoff = Handoff(conversation_summary="None", request=last_user.text)

    # Every tool call needs a tool result before the conversation can continue.
    return {
        "messages": [ToolMessage("Analysis started.", tool_call_id=call["id"])],
        "handoff": handoff.model_dump(),
        "analysis_start": len(messages) + 1,
    }
