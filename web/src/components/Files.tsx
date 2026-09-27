import { FileSpreadsheet, FileText, Globe, Image as ImageIcon, Maximize2 } from "lucide-react";
import type { OutputFile } from "../lib/agent";

function iconFor(file: OutputFile) {
  if (file.kind === "image") return ImageIcon;
  if (file.kind === "html") return Globe;
  if (/\.(csv|xlsx?)$/i.test(file.name)) return FileSpreadsheet;
  return FileText;
}

function describe(file: OutputFile): string {
  if (file.kind === "image") return "Chart";
  if (file.kind === "pdf") return "PDF report";
  if (file.kind === "html") return "Interactive page";
  if (/\.xlsx?$/i.test(file.name)) return "Spreadsheet";
  if (/\.csv$/i.test(file.name)) return "CSV table";
  return "File";
}

/** Charts show inline under the answer; every file also opens in the artifact panel. */
export function Files({ files, onOpen }: { files: OutputFile[]; onOpen: (file: OutputFile) => void }) {
  if (!files.length) return null;
  const images = files.filter((f) => f.kind === "image");
  const others = files.filter((f) => f.kind !== "image");

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className={images.length > 1 ? "grid gap-3 sm:grid-cols-2" : ""}>
          {images.map((file) => (
            <button
              key={file.url}
              type="button"
              onClick={() => onOpen(file)}
              className="group relative block w-full overflow-hidden rounded-2xl border border-line bg-surface text-left transition hover:border-line-strong hover:shadow-[0_8px_24px_-12px_oklch(0.2_0.01_262/0.18)]"
            >
              <img src={file.url} alt={file.name} className="w-full object-contain p-3" loading="lazy" />
              <span className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[13px] text-ink-3">
                <span className="truncate">{file.name}</span>
                <Maximize2 className="size-3.5 opacity-60 transition group-hover:text-ink group-hover:opacity-100" />
              </span>
            </button>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map((file) => {
            const Icon = iconFor(file);
            return (
              <button
                key={file.url}
                type="button"
                onClick={() => onOpen(file)}
                className="flex min-w-56 items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left transition hover:border-line-strong hover:bg-canvas"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-ember-soft text-ember-ink">
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{file.name}</span>
                  <span className="block text-[12.5px] text-ink-3">{describe(file)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
