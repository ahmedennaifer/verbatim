import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";
import { useCallback, useState } from "react";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:2024";
const ASSISTANT_ID = import.meta.env.VITE_ASSISTANT_ID ?? "agent";

export type PlanStep = { goal: string; skills: string[] };
export type Plan = { objective: string; assumptions: string[]; steps: PlanStep[] };
export type OutputFile = { name: string; url: string; kind: "image" | "pdf" | "html" | "download" };

export type UIEntry =
  | { id: string; name: "plan"; props: Plan; metadata?: { message_id?: string } }
  | { id: string; name: "files"; props: { files: OutputFile[] }; metadata?: { message_id?: string } };

export type AgentState = { messages: Message[]; ui?: UIEntry[] };

function threadFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("thread");
}

function writeThreadToUrl(threadId: string | null) {
  const url = new URL(window.location.href);
  if (threadId) url.searchParams.set("thread", threadId);
  else url.searchParams.delete("thread");
  window.history.replaceState(null, "", url);
}

/** The agent's stream, with the current thread kept in the URL so a reload reopens it. */
export function useAgent() {
  const [threadId, setThreadId] = useState<string | null>(threadFromUrl);
  // Bumped when a run ends, so the history and artifact lists refresh.
  const [revision, setRevision] = useState(0);

  const stream = useStream<AgentState>({
    apiUrl: API_URL,
    assistantId: ASSISTANT_ID,
    messagesKey: "messages",
    threadId,
    onThreadId: (id) => {
      setThreadId(id);
      writeThreadToUrl(id);
      setRevision((r) => r + 1);
    },
    onFinish: () => setRevision((r) => r + 1),
    reconnectOnMount: true,
  });

  const send = useCallback(
    (text: string) =>
      stream.submit(
        { messages: [{ type: "human", content: text }] },
        {
          streamMode: ["values", "messages-tuple", "custom"],
          optimisticValues: (prev) => ({
            messages: [...(prev.messages ?? []), { type: "human", content: text, id: crypto.randomUUID() }],
          }),
        },
      ),
    [stream],
  );

  const open = useCallback(
    (id: string | null) => {
      setThreadId(id);
      writeThreadToUrl(id);
      stream.switchThread(id);
    },
    [stream],
  );

  return { stream, send, open, threadId, revision };
}
