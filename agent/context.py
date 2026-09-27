from langchain_core.messages import AIMessage, AnyMessage, HumanMessage


def text_history(messages: list[AnyMessage]) -> list[AnyMessage]:
    """User messages and assistant replies only, without tool calls and tool results."""
    history: list[AnyMessage] = []
    for message in messages:
        if isinstance(message, HumanMessage):
            history.append(message)
        elif isinstance(message, AIMessage) and not message.tool_calls and message.text:
            history.append(AIMessage(message.text))
    return history
