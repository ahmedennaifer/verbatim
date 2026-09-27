import type { Client, Thread } from "@langchain/langgraph-sdk";
import { Database, Images, MessageSquareText, PanelLeftClose, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Info } from "../lib/api";
import { textOf } from "../lib/turns";
import { Logo } from "./Logo";

export type View = "chat" | "artifacts" | "dataset";

type Item = { id: string; title: string; updated: Date };

function titleOf(thread: Thread): string {
  const messages = (thread.values as { messages?: { type: string; content: never }[] } | null)?.messages ?? [];
  const first = messages.find((m) => m.type === "human");
  return first ? textOf(first.content).slice(0, 80) : "Untitled analysis";
}

function groupLabel(date: Date): string {
  const today = new Date();
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  return "Older";
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Database;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[14px] transition-colors",
        active ? "bg-surface font-medium text-ink shadow-[0_1px_2px_oklch(0.2_0.01_262/0.06)]" : "text-ink-2 hover:bg-line/50",
      ].join(" ")}
    >
      <Icon className="size-4 text-ink-3" />
      {label}
    </button>
  );
}

export function Sidebar({
  client,
  view,
  onView,
  threadId,
  onOpen,
  revision,
  info,
  onCollapse,
}: {
  client: Client;
  view: View;
  onView: (view: View) => void;
  threadId: string | null;
  onOpen: (id: string | null) => void;
  revision: number;
  info?: Info;
  onCollapse: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [localRevision, setLocalRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    client.threads
      .search({ limit: 40, sortBy: "updated_at", sortOrder: "desc" })
      .then((threads) => {
        if (cancelled) return;
        setItems(
          threads
            .filter((t) => ((t.values as { messages?: unknown[] } | null)?.messages?.length ?? 0) > 0)
            .map((t) => ({ id: t.thread_id, title: titleOf(t), updated: new Date(t.updated_at) })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, revision, localRevision]);

  const remove = async (id: string) => {
    await client.threads.delete(id);
    setConfirming(null);
    if (id === threadId) onOpen(null);
    setLocalRevision((r) => r + 1);
  };

  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const label = groupLabel(item.updated);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return (
    <nav aria-label="Main" className="flex h-full w-64 flex-col border-r border-line bg-sunken/70">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Logo />
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          className="rounded-md p-1.5 text-ink-3 transition hover:bg-line/60 hover:text-ink"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <div className="space-y-0.5 px-3">
        <button
          type="button"
          onClick={() => {
            onView("chat");
            onOpen(null);
          }}
          className="mb-2 flex w-full items-center gap-2.5 rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-[14px] font-medium text-ink transition hover:border-ink-3"
        >
          <Plus className="size-4" />
          New analysis
        </button>
        <NavButton icon={MessageSquareText} label="Analyses" active={view === "chat"} onClick={() => onView("chat")} />
        <NavButton icon={Images} label="Artifacts" active={view === "artifacts"} onClick={() => onView("artifacts")} />
        <NavButton icon={Database} label="Dataset" active={view === "dataset"} onClick={() => onView("dataset")} />
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {items.length === 0 && <p className="px-2.5 text-[13px] text-ink-3">Your analyses will appear here.</p>}
        {[...groups].map(([label, group]) => (
          <section key={label} className="mb-4">
            <h2 className="px-2.5 pb-1 text-[12px] font-medium text-ink-3">{label}</h2>
            <ul className="space-y-px">
              {group.map((item) => (
                <li key={item.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      onView("chat");
                      onOpen(item.id);
                    }}
                    title={item.title}
                    className={[
                      "block w-full truncate rounded-lg py-1.5 pr-8 pl-2.5 text-left text-[13.5px] transition-colors",
                      item.id === threadId && view === "chat" ? "bg-line/70 text-ink" : "text-ink-2 hover:bg-line/50",
                    ].join(" ")}
                  >
                    {item.title}
                  </button>
                  {confirming === item.id ? (
                    <span className="absolute inset-y-0 right-1 flex items-center gap-1 rounded-lg bg-surface pl-2 shadow-sm">
                      <button type="button" onClick={() => remove(item.id)} className="rounded px-1.5 py-0.5 text-[12px] font-medium text-danger hover:bg-danger-soft">
                        Delete
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="rounded px-1.5 py-0.5 text-[12px] text-ink-3 hover:bg-sunken">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(item.id)}
                      aria-label={`Delete "${item.title}"`}
                      className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-ink-3 opacity-0 transition group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="flex items-center gap-2.5 border-t border-line px-4 py-3">
        <span className="relative flex size-2">
          <span className="size-2 rounded-full bg-[oklch(0.68_0.15_150)]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-medium text-ink-2">Local workspace</span>
          <span className="block truncate font-mono text-[11.5px] text-ink-3">{info?.model ?? "connecting…"}</span>
        </span>
      </footer>
    </nav>
  );
}
