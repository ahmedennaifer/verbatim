import { AlertTriangle, Link2, PanelLeftOpen } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArtifactPanel } from "./components/ArtifactPanel";
import { ArtifactsView } from "./components/ArtifactsView";
import { Composer } from "./components/Composer";
import { DatasetView } from "./components/DatasetView";
import { EmptyState } from "./components/EmptyState";
import { Sidebar, type View } from "./components/Sidebar";
import { TurnView } from "./components/TurnView";
import { type OutputFile, useAgent } from "./lib/agent";
import { useArtifacts, useInfo } from "./lib/api";
import { toTurns } from "./lib/turns";

const EASE = [0.22, 1, 0.36, 1] as const;

function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (/quota|rate|429|RESOURCE_EXHAUSTED/i.test(text)) return "The model's free quota is used up for now. Try again later.";
  return "Something went wrong while running the analysis. Try again, or rephrase the question.";
}

function viewFromUrl(): View {
  const view = new URLSearchParams(window.location.search).get("view");
  return view === "artifacts" || view === "dataset" ? view : "chat";
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(window.location.href).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2 transition hover:border-line-strong hover:text-ink"
    >
      <Link2 className="size-3.5" />
      {copied ? "Link copied" : "Copy link"}
    </button>
  );
}

export default function App() {
  const { stream, send, open, threadId, revision } = useAgent();
  const [view, setViewState] = useState<View>(viewFromUrl);
  const setView = (next: View) => {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next === "chat") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  };
  const [sidebar, setSidebar] = useState(true);
  const [artifact, setArtifact] = useState<OutputFile | null>(null);
  const info = useInfo();
  const artifacts = useArtifacts(revision);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const ui = stream.values?.ui;
  const turns = useMemo(() => toTurns(stream.messages, ui), [stream.messages, ui]);
  const running = stream.isLoading;
  const empty = turns.length === 0 && !stream.isThreadLoading;

  // Follow the output while it streams, unless the reader scrolled up; opened threads start at the top.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && running && pinned.current) el.scrollTo({ top: el.scrollHeight });
  }, [turns, running]);

  const ask = (text: string) => {
    setView("chat");
    pinned.current = true;
    send(text);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <AnimatePresence initial={false}>
        {sidebar && (
          <motion.div
            key="sidebar"
            initial={{ width: 0 }}
            animate={{ width: 256 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="h-full shrink-0 overflow-hidden"
          >
            <Sidebar
              client={stream.client}
              view={view}
              onView={setView}
              threadId={threadId}
              onOpen={(id) => {
                setArtifact(null);
                open(id);
              }}
              revision={revision}
              info={info}
              onCollapse={() => setSidebar(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 px-5">
          {!sidebar && (
            <button
              type="button"
              onClick={() => setSidebar(true)}
              aria-label="Open sidebar"
              className="rounded-md p-1.5 text-ink-3 transition hover:bg-sunken hover:text-ink"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          )}
          {view === "chat" && !empty && (
            <>
              <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink-2">{turns[0]?.question}</p>
              {threadId && <ShareButton />}
            </>
          )}
        </header>

        {view === "artifacts" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ArtifactsView artifacts={artifacts} onOpen={setArtifact} />
          </div>
        )}

        {view === "dataset" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DatasetView
              info={info}
              onAsk={(text) => {
                open(null);
                ask(text);
              }}
            />
          </div>
        )}

        {view === "chat" && (
          <>
            <div
              ref={scrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
              }}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              {empty ? (
                <EmptyState onSend={ask} info={info} recent={artifacts} onOpenFile={setArtifact} />
              ) : (
                <div className="mx-auto w-full max-w-[760px] space-y-16 px-6 pt-4 pb-12">
                  {turns.map((turn, i) => (
                    <TurnView key={turn.id} turn={turn} running={running && i === turns.length - 1} onOpenFile={setArtifact} />
                  ))}
                  {stream.error != null && !running && (
                    <p role="alert" className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3 text-[14px] text-danger">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      {errorMessage(stream.error)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {!empty && (
              <div className="mx-auto w-full max-w-[760px] px-6 pt-2 pb-5">
                <Composer onSend={ask} onStop={() => stream.stop()} running={running} info={info} placeholder="Ask a follow-up…" />
              </div>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {artifact && (
          <motion.div
            key="artifact"
            initial={{ width: 0 }}
            animate={{ width: "min(46vw, 760px)" }}
            exit={{ width: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="h-full shrink-0 overflow-hidden"
          >
            <div className="h-full w-[min(46vw,760px)]">
              <ArtifactPanel file={artifact} onClose={() => setArtifact(null)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
