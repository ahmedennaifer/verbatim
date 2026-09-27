import { Check, Copy } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useId, useMemo, useState } from "react";
import type { OutputFile } from "../lib/agent";
import { useReviews } from "../lib/api";
import { citedReviewIds } from "../lib/citations";
import type { Turn } from "../lib/turns";
import { Answer } from "./Answer";
import { Files } from "./Files";
import { PlanCard } from "./PlanCard";
import { Sources } from "./Sources";
import { Timeline, summarize } from "./Steps";

type Tab = "answer" | "steps" | "files";

function useElapsed(running: boolean): number {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return Math.max(0, Math.round((now - started) / 1000));
}

function Progress({ turn, onShowSteps }: { turn: Turn; onShowSteps: () => void }) {
  const elapsed = useElapsed(true);
  const tools = turn.steps.filter((s) => s.kind === "tool");
  const last = tools[tools.length - 1];
  const label = last
    ? last.result
      ? "Reviewing results"
      : `${summarize(last.call, undefined).live}`
    : turn.plan
      ? "Starting the analysis"
      : "Thinking";
  const planned = turn.plan?.steps.length;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3.5">
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inset-0 animate-ping rounded-full bg-ember/45" />
        <span className="relative size-2.5 rounded-full bg-ember" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">{label}…</span>
        <span className="block text-[12.5px] text-ink-3">
          {tools.length} {tools.length === 1 ? "step" : "steps"} done
          {planned ? ` · plan of ${planned}` : ""} · {elapsed}s
        </span>
      </span>
      {tools.length > 0 && (
        <button type="button" onClick={onShowSteps} className="shrink-0 text-[13px] font-medium text-ember-ink hover:underline">
          View steps
        </button>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] text-ink-3 transition hover:bg-sunken hover:text-ink"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function TurnView({
  turn,
  running,
  onOpenFile,
}: {
  turn: Turn;
  running: boolean;
  onOpenFile: (file: OutputFile) => void;
}) {
  const [tab, setTab] = useState<Tab>("answer");
  const tabsId = useId();
  const ids = useMemo(() => (turn.answer && !running ? citedReviewIds(turn.answer) : []), [turn.answer, running]);
  const reviews = useReviews(ids);
  const isAnalysis = turn.steps.length > 0 || !!turn.plan;
  const toolCount = turn.steps.filter((s) => s.kind === "tool").length;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "answer", label: "Answer" },
    { id: "steps", label: "Steps", count: toolCount },
    ...(turn.files.length ? [{ id: "files" as const, label: "Files", count: turn.files.length }] : []),
  ];

  return (
    <article className="animate-rise">
      <h2 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">{turn.question}</h2>

      {isAnalysis && (
        <div role="tablist" aria-label="Result views" className="mt-4 flex gap-5 border-b border-line">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`${tabsId}-${t.id}`}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={[
                "relative pb-2.5 text-[14px] transition-colors",
                tab === t.id ? "font-medium text-ink" : "text-ink-3 hover:text-ink-2",
              ].join(" ")}
            >
              {t.label}
              {t.count ? <span className="ml-1.5 text-ink-3 tabular-nums">{t.count}</span> : null}
              {tab === t.id && (
                <motion.span
                  layoutId={`${tabsId}-underline`}
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ink"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-5">
        {tab === "answer" && (
          <>
            {running && !turn.answer && <Progress turn={turn} onShowSteps={() => setTab("steps")} />}
            {!running && isAnalysis && !turn.answer && (
              <p className="text-[14px] text-ink-3">This analysis stopped before it produced an answer.</p>
            )}
            {reviews.size > 0 && <Sources reviews={[...reviews.values()]} />}
            {turn.answer && <Answer text={turn.answer} streaming={running} reviews={reviews} />}
            <Files files={turn.files} onOpen={onOpenFile} />
            {turn.answer && !running && (
              <div className="-ml-2 flex items-center gap-1">
                <CopyButton text={turn.answer} />
                {toolCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setTab("steps")}
                    className="rounded-lg px-2 py-1 text-[12.5px] text-ink-3 transition hover:bg-sunken hover:text-ink"
                  >
                    How I got this · {toolCount} steps
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {tab === "steps" && (
          <>
            {turn.plan && <PlanCard plan={turn.plan} />}
            <Timeline steps={turn.steps} running={running} />
          </>
        )}

        {tab === "files" && <Files files={turn.files} onOpen={onOpenFile} />}
      </div>
    </article>
  );
}

