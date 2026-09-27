import { FileSpreadsheet, FileText, Globe } from "lucide-react";
import type { OutputFile } from "../lib/agent";
import type { Artifact } from "../lib/api";

function formatSize(bytes: number): string {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

function Thumb({ artifact }: { artifact: Artifact }) {
  if (artifact.kind === "image")
    return <img src={artifact.url} alt="" className="size-full object-contain p-2" loading="lazy" />;
  const Icon = artifact.kind === "html" ? Globe : /\.(csv|xlsx?)$/i.test(artifact.name) ? FileSpreadsheet : FileText;
  return (
    <span className="flex size-full items-center justify-center bg-sunken">
      <Icon className="size-8 text-ink-3" strokeWidth={1.5} />
    </span>
  );
}

export function ArtifactsView({ artifacts, onOpen }: { artifacts?: Artifact[]; onOpen: (file: OutputFile) => void }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">Artifacts</h1>
      <p className="mt-1 text-[14.5px] text-ink-3">Every chart, report and spreadsheet your analyses produced.</p>

      {!artifacts ? (
        <p className="mt-10 text-[14px] text-ink-3">Loading…</p>
      ) : artifacts.length === 0 ? (
        <p className="mt-10 max-w-md text-[14px] leading-6 text-ink-3">
          Nothing yet. Ask for a chart, a spreadsheet or a PDF in an analysis and it will show up here.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {artifacts.map((artifact) => (
            <li key={artifact.url}>
              <button
                type="button"
                onClick={() => onOpen(artifact)}
                className="group w-full overflow-hidden rounded-2xl border border-line bg-surface text-left transition hover:border-line-strong hover:shadow-[0_10px_28px_-18px_oklch(0.2_0.01_262/0.35)]"
              >
                <span className="block aspect-[4/3] border-b border-line bg-surface">
                  <Thumb artifact={artifact} />
                </span>
                <span className="block px-3.5 py-3">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{artifact.name}</span>
                  <span className="mt-0.5 block text-[12px] text-ink-3">
                    {new Date(artifact.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ·{" "}
                    {formatSize(artifact.size)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
