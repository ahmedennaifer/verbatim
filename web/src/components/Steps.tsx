import { ChevronRight, CircleAlert, Code2, Database, FileDown, Wrench } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import Markdown from "react-markdown";
import type { Step, ToolCall } from "../lib/turns";
import { textOf } from "../lib/turns";
import { Code } from "./Code";
import { DataTable, parseMarkdownTable } from "./DataTable";

type ToolStep = Extract<Step, { kind: "tool" }>;

const EASE = [0.22, 1, 0.36, 1] as const;

export function summarize(call: ToolCall, resultText: string | undefined) {
  const args = call.args as Record<string, string>;
  const failed = resultText?.startsWith("ERROR") ?? false;
  switch (call.name) {
    case "run_sql": {
      const rows = resultText?.match(/^(\d+) row\(s\)/)?.[1];
      const more = resultText?.split("\n", 1)[0].includes("more available");
      return {
        icon: Database,
        label: "Queried the database",
        live: "Querying the database",
        detail: failed ? "query failed" : rows && `${rows}${more ? "+" : ""} ${rows === "1" ? "row" : "rows"}`,
        failed,
      };
    }
    case "export_sql": {
      const m = resultText?.match(/^Exported ([\d,]+) rows/);
      return {
        icon: FileDown,
        label: "Exported data",
        live: "Exporting data",
        detail: failed ? "export failed" : m && `${m[1]} rows`,
        failed,
      };
    }
    case "run_code": {
      let ok: boolean | undefined;
      let files = 0;
      try {
        const parsed = JSON.parse(resultText ?? "");
        ok = parsed.ok;
        files = parsed.files?.length ?? 0;
      } catch {
        // Result not in yet.
      }
      const lang = args.language === "javascript" ? "JavaScript" : "Python";
      return {
        icon: Code2,
        label: `Ran ${lang}`,
        live: `Running ${lang}`,
        detail: ok === undefined ? undefined : ok ? (files ? `${files} ${files === 1 ? "file" : "files"}` : "done") : "failed",
        failed: ok === false,
      };
    }
    default:
      return { icon: Wrench, label: call.name, live: call.name, detail: undefined, failed };
  }
}

function Details({ step }: { step: ToolStep }) {
  const args = step.call.args as Record<string, string>;
  const text = step.result ? textOf(step.result.content) : "";

  if (step.call.name === "run_code") {
    let output = text;
    try {
      output = JSON.parse(text).output;
    } catch {
      // Show raw text.
    }
    return (
      <div className="space-y-2">
        {args.code && <Code language={args.language === "javascript" ? "javascript" : "python"}>{args.code}</Code>}
        {output?.trim() && (
          <pre className="max-h-56 overflow-auto rounded-xl bg-ink px-4 py-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-canvas/90">
            {output.trim()}
          </pre>
        )}
      </div>
    );
  }

  const table = step.call.name === "run_sql" ? parseMarkdownTable(text) : null;
  return (
    <div className="space-y-2">
      {args.sql && <Code language="sql">{args.sql}</Code>}
      {text.startsWith("ERROR") ? (
        <pre className="rounded-xl bg-danger-soft px-4 py-3 font-mono text-[12px] whitespace-pre-wrap text-danger">{text}</pre>
      ) : table ? (
        <DataTable {...table} />
      ) : (
        text && <p className="text-[13px] text-ink-3">{text}</p>
      )}
    </div>
  );
}

function ToolRow({ step, live }: { step: ToolStep; live: boolean }) {
  const [open, setOpen] = useState(false);
  const resultText = step.result ? textOf(step.result.content) : undefined;
  const { icon: Icon, label, live: liveLabel, detail, failed } = summarize(step.call, resultText);
  const pending = !step.result;

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center gap-3 rounded-lg py-1.5 pr-1 text-left text-[13.5px]"
      >
        <span
          className={[
            "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-surface",
            failed ? "border-danger/30 text-danger" : pending && live ? "border-ember/40 text-ember" : "border-line-strong text-ink-3",
          ].join(" ")}
        >
          {failed ? <CircleAlert className="size-3.5" /> : <Icon className={["size-3.5", pending && live ? "animate-pulse-soft" : ""].join(" ")} />}
        </span>
        <span className={pending && live ? "font-medium text-ink" : "text-ink-2"}>{pending && live ? `${liveLabel}…` : label}</span>
        {detail && <span className={failed ? "text-danger" : "text-ink-3"}>{detail}</span>}
        <ChevronRight
          className={[
            "ml-auto size-4 text-ink-3 opacity-0 transition duration-200 ease-(--ease-out-quint) group-hover:opacity-100 group-focus-visible:opacity-100",
            open ? "rotate-90 opacity-100" : "",
          ].join(" ")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pt-1 pb-3 pl-9">
              <Details step={step} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function NoteRow({ text }: { text: string }) {
  return (
    <li className="flex gap-3 py-1.5">
      <span className="relative z-10 flex size-6 shrink-0 items-center justify-center">
        <span className="size-1.5 rounded-full bg-line-strong" />
      </span>
      <div className="min-w-0 text-[13.5px] leading-6 text-ink-3 [&_p]:m-0 [&_strong]:font-medium [&_strong]:text-ink-2">
        <Markdown>{text}</Markdown>
      </div>
    </li>
  );
}

/** The agent's work for one turn, as a timeline. */
export function Timeline({ steps, running }: { steps: Step[]; running: boolean }) {
  if (!steps.length) return <p className="text-[13.5px] text-ink-3">No steps yet.</p>;
  return (
    <ol className="relative before:absolute before:top-4 before:bottom-4 before:left-3 before:w-px before:bg-line">
      {steps.map((step, i) =>
        step.kind === "note" ? (
          <NoteRow key={step.id} text={step.text} />
        ) : (
          <ToolRow key={step.id} step={step} live={running && i >= steps.length - 2} />
        ),
      )}
    </ol>
  );
}
