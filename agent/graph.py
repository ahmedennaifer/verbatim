from collections.abc import Sequence
from typing import Annotated

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.graph.ui import AnyUIMessage, ui_message_reducer
from langgraph.prebuilt import ToolNode, tools_condition

from agent.nodes.chat import chat_node
from agent.nodes.executor import executor_node
from agent.nodes.handoff import handoff_node, wants_analysis
from agent.nodes.planner import planner_node
from agent.nodes.schema import schema_node
from agent.tools import TOOLS


class State(MessagesState):
    db_schema: str
    handoff: dict
    plan: dict | None
    analysis_start: int
    ui: Annotated[Sequence[AnyUIMessage], ui_message_reducer]


def build_graph(checkpointer: BaseCheckpointSaver | None = None) -> CompiledStateGraph:
    graph = StateGraph(State)
    graph.add_node("schema", schema_node)
    graph.add_node("chat", chat_node)
    graph.add_node("handoff", handoff_node)
    graph.add_node("planner", planner_node)
    graph.add_node("executor", executor_node)
    graph.add_node("tools", ToolNode(TOOLS))

    graph.add_edge(START, "schema")
    graph.add_edge("schema", "chat")
    graph.add_conditional_edges("chat", lambda state: "handoff" if wants_analysis(state) else END)
    graph.add_edge("handoff", "planner")
    graph.add_edge("planner", "executor")
    graph.add_conditional_edges("executor", tools_condition, {"tools": "tools", END: END})
    graph.add_edge("tools", "executor")
    return graph.compile(checkpointer=checkpointer)


# Served by the LangGraph Agent Server (langgraph.json), which provides its own persistence.
graph = build_graph()
