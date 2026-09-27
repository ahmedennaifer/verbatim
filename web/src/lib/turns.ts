import type { AIMessage, Message, ToolMessage } from "@langchain/langgraph-sdk";
import type { OutputFile, Plan, UIEntry } from "./agent";

/** Plumbing between the agent's nodes; never shown. */
const HIDDEN_TOOLS = new Set(["start_analysis", "load_skill"]);

export type ToolCall = NonNullable<AIMessage["tool_calls"]>[number];

export type Step =
  | { kind: "note"; id: string; text: string }
  | { kind: "tool"; id: string; call: ToolCall; result?: ToolMessage };

export type Turn = {
  id: string;
  question: string;
  plan?: Plan;
  steps: Step[];
  answer?: string;
  files: OutputFile[];
};

export function textOf(content: Message["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
    .join("");
}

// The executor narrates its progress as "Step 2: ..." / "Finding 3: ..."; those belong in the timeline.
// Deciding from the first words keeps a message in the same place for its whole stream.
const NOTE = /^\s*\**\s*(step|finding)\s+\d+/i;

/**
 * Group the flat message list into turns: one user question and everything the agent did for it.
 * Every message lands in exactly one slot (plan, steps or answer), so nothing moves while streaming.
 */
export function toTurns(messages: Message[], ui: UIEntry[] = []): Turn[] {
  const results = new Map<string, ToolMessage>();
  for (const m of messages) if (m.type === "tool" && m.tool_call_id) results.set(m.tool_call_id, m);

  const turns: Turn[] = [];
  for (const m of messages) {
    if (m.type === "human") {
      turns.push({ id: m.id ?? `turn-${turns.length}`, question: textOf(m.content), steps: [], files: [] });
      continue;
    }
    const turn = turns[turns.length - 1];
    if (!turn || m.type !== "ai") continue;

    for (const entry of ui) {
      if (entry.metadata?.message_id !== m.id) continue;
      if (entry.name === "plan") turn.plan = entry.props;
      if (entry.name === "files") turn.files.push(...entry.props.files);
    }

    const text = textOf(m.content).trim();
    const calls = (m.tool_calls ?? []).filter((c) => !HIDDEN_TOOLS.has(c.name));
    if (m.tool_calls?.length) {
      if (text && calls.length) turn.steps.push({ kind: "note", id: `${m.id}-note`, text });
      for (const call of calls) {
        const result = call.id ? results.get(call.id) : undefined;
        turn.steps.push({ kind: "tool", id: call.id ?? `${m.id}-${call.name}`, call, result });
      }
    } else if (text && NOTE.test(text)) {
      turn.steps.push({ kind: "note", id: `${m.id}-note`, text });
    } else if (text) {
      turn.answer = text;
    }
  }
  return turns;
}
