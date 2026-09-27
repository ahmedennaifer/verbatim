import { useState } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Review } from "../lib/api";
import { linkCitations } from "../lib/citations";
import { ReviewDetail } from "./Sources";

function Citation({ id, review }: { id: string; review?: Review }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="mx-0.5 inline-flex -translate-y-px items-center rounded-md bg-sunken px-1.5 py-px font-mono text-[11.5px] leading-5 text-ink-2 transition hover:bg-ember-soft hover:text-ember-ink"
      >
        {id}
      </button>
      {open && review && (
        <span className="absolute bottom-full left-1/2 z-30 mb-2 block w-80 -translate-x-1/2 rounded-xl border border-line bg-surface p-4 text-left shadow-[0_16px_40px_-16px_oklch(0.2_0.01_262/0.35)]">
          <ReviewDetail review={{ ...review, body: review.body && review.body.slice(0, 280) }} />
        </span>
      )}
    </span>
  );
}

function components(reviews: Map<number, Review>): Components {
  return {
    h1: (props) => <h3 className="mt-7 mb-2 text-lg font-semibold tracking-tight text-ink" {...props} />,
    h2: (props) => <h3 className="mt-7 mb-2 text-lg font-semibold tracking-tight text-ink" {...props} />,
    h3: (props) => <h4 className="mt-6 mb-1.5 text-[15.5px] font-semibold text-ink" {...props} />,
    p: (props) => <p className="my-3 leading-7" {...props} />,
    ul: (props) => <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-line-strong" {...props} />,
    ol: (props) => <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:text-ink-3" {...props} />,
    li: (props) => <li className="pl-1 leading-7" {...props} />,
    strong: (props) => <strong className="font-semibold text-ink" {...props} />,
    a: ({ href, children, ...props }) => {
      const id = href?.match(/^#review-(\d+)$/)?.[1];
      if (id) return <Citation id={id} review={reviews.get(Number(id))} />;
      return (
        <a href={href} className="text-ember-ink underline decoration-ember/40 underline-offset-2 hover:decoration-ember" {...props}>
          {children}
        </a>
      );
    },
    blockquote: (props) => <blockquote className="my-4 rounded-xl bg-sunken px-4 py-3 text-ink-2" {...props} />,
    code: (props) => <code className="rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[0.86em] text-ink-2" {...props} />,
    pre: (props) => (
      <pre className="my-4 overflow-auto rounded-xl border border-line bg-sunken p-4 text-[13px] [&_code]:bg-transparent [&_code]:p-0" {...props} />
    ),
    hr: () => <hr className="my-6 border-line" />,
    table: (props) => (
      <div className="my-5 overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-left text-[14px]" {...props} />
      </div>
    ),
    thead: (props) => <thead className="bg-sunken" {...props} />,
    th: (props) => <th className="border-b border-line px-3.5 py-2 font-medium text-ink-2" {...props} />,
    td: (props) => <td className="border-b border-line px-3.5 py-2 tabular-nums [tr:last-child_&]:border-0" {...props} />,
  };
}

export function Answer({ text, streaming, reviews }: { text: string; streaming: boolean; reviews: Map<number, Review> }) {
  return (
    <div className="max-w-[70ch] text-[15.5px] text-ink-2 [&>*:first-child]:mt-0">
      <Markdown remarkPlugins={[remarkGfm]} components={components(reviews)}>
        {linkCitations(text)}
      </Markdown>
      {streaming && <span aria-hidden className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse-soft bg-ember" />}
    </div>
  );
}
