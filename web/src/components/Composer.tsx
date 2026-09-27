import { ArrowUp, Database, Sparkles, Square } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { formatCount, type Info } from "../lib/api";

export type ComposerHandle = { fill: (text: string) => void };

export const Composer = forwardRef<
  ComposerHandle,
  {
    onSend: (text: string) => void;
    onStop: () => void;
    running: boolean;
    info?: Info;
    autoFocus?: boolean;
    placeholder?: string;
  }
>(function Composer({ onSend, onStop, running, info, autoFocus, placeholder = "Ask about products, brands or what customers say…" }, handle) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(handle, () => ({
    fill: (value: string) => {
      setText(value);
      requestAnimationFrame(() => {
        ref.current?.focus();
        ref.current?.setSelectionRange(value.length, value.length);
      });
    },
  }));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  const submit = () => {
    const value = text.trim();
    if (!value || running) return;
    onSend(value);
    setText("");
  };

  const reviews = info?.dataset.reviews;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-[20px] border border-line-strong bg-surface shadow-[0_12px_32px_-20px_oklch(0.2_0.01_262/0.4)] transition focus-within:border-ink-3 focus-within:shadow-[0_12px_32px_-18px_oklch(0.2_0.01_262/0.5)]"
    >
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      <textarea
        id="composer"
        ref={ref}
        rows={1}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="block max-h-[220px] min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-3"
      />
      <div className="flex items-center gap-2 px-3 pt-1 pb-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[12.5px] text-ink-2">
          <Database className="size-3.5 text-ink-3" />
          Amazon Reviews
          {reviews ? <span className="text-ink-3">· {formatCount(reviews)}</span> : null}
        </span>
        <span className="hidden items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] text-ink-3 sm:inline-flex">
          <Sparkles className="size-3.5" />
          Charts & reports on request
        </span>
        <span className="ml-auto hidden font-mono text-[11.5px] text-ink-3 md:inline">{info?.model}</span>
        {running ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition hover:bg-ink-2"
          >
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim()}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ember text-white transition hover:brightness-95 disabled:bg-sunken disabled:text-ink-3"
          >
            <ArrowUp className="size-4.5" strokeWidth={2.4} />
          </button>
        )}
      </div>
    </form>
  );
});
