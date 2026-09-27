import { BarChart3, FileText, MessageCircleQuestion } from "lucide-react";
import { useRef } from "react";
import type { OutputFile } from "../lib/agent";
import type { Artifact, Info } from "../lib/api";
import { Composer, type ComposerHandle } from "./Composer";

const STARTERS = [
  {
    icon: MessageCircleQuestion,
    title: "Ask a question",
    description: "What customers love, hate or keep mentioning about a product or brand.",
    prompt: "What do customers love and hate about CHANEL products?",
  },
  {
    icon: BarChart3,
    title: "Find what sells",
    description: "Rank products, compare brands and spot trends, with charts.",
    prompt: "Which skincare products perform best, why do they sell, and what similar product could I market? Include charts.",
  },
  {
    icon: FileText,
    title: "Build a report",
    description: "Get a PDF or spreadsheet you can share with your team.",
    prompt: "Compare how Dior, Gucci and Tom Ford are rated over time, as a PDF report.",
  },
];

export function EmptyState({
  onSend,
  info,
  recent,
  onOpenFile,
}: {
  onSend: (text: string) => void;
  info?: Info;
  recent?: Artifact[];
  onOpenFile: (file: OutputFile) => void;
}) {
  const composer = useRef<ComposerHandle>(null);
  const charts = (recent ?? []).filter((a) => a.kind === "image").slice(0, 4);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col justify-center px-6 py-16">
      <p className="text-[13px] font-medium text-ember-ink">Customer insights</p>
      <h1 className="mt-1.5 text-[34px] leading-tight font-semibold tracking-[-0.025em] text-ink">What do you want to know?</h1>

      <div className="mt-6">
        <Composer ref={composer} onSend={onSend} onStop={() => {}} running={false} info={info} autoFocus />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {STARTERS.map((starter) => (
          <button
            key={starter.title}
            type="button"
            onClick={() => composer.current?.fill(starter.prompt)}
            className="group flex flex-col items-start justify-start rounded-2xl border border-line bg-surface/70 p-4 text-left transition hover:border-line-strong hover:bg-surface"
          >
            <starter.icon className="size-4.5 text-ink-3 transition group-hover:text-ember" />
            <p className="mt-3 text-[14px] font-medium text-ink">{starter.title}</p>
            <p className="mt-1 text-[13px] leading-5 text-ink-3">{starter.description}</p>
          </button>
        ))}
      </div>

      {charts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[13px] font-medium text-ink-2">Recent charts</h2>
          <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {charts.map((chart) => (
              <button
                key={chart.url}
                type="button"
                onClick={() => onOpenFile(chart)}
                title={chart.name}
                className="aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface p-1.5 transition hover:border-line-strong"
              >
                <img src={chart.url} alt={chart.name} className="size-full object-contain" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
