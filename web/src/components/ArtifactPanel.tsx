import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { OutputFile } from "../lib/agent";
import { DataTable } from "./DataTable";

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return { header: rows[0] ?? [], rows: rows.slice(1, 501) };
}

function CsvPreview({ url }: { url: string }) {
  const [table, setTable] = useState<{ header: string[]; rows: string[][] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => !cancelled && setTable(parseCsv(text)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (failed) return <p className="p-6 text-sm text-ink-3">Couldn't load a preview. Use Download instead.</p>;
  if (!table) return <p className="p-6 text-sm text-ink-3">Loading preview…</p>;
  return (
    <div className="p-5">
      <DataTable {...table} />
    </div>
  );
}

function Preview({ file }: { file: OutputFile }) {
  if (file.kind === "image")
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <img src={file.url} alt={file.name} className="max-h-full max-w-full rounded-lg" />
      </div>
    );
  if (file.kind === "pdf" || file.kind === "html")
    return <iframe src={file.url} title={file.name} className="h-full w-full border-0 bg-surface" />;
  if (/\.csv$/i.test(file.name)) return <CsvPreview url={file.url} />;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-[15px] font-medium text-ink">{file.name}</p>
      <p className="max-w-72 text-sm text-ink-3">This file type opens in its own app. Download it to view.</p>
      <a
        href={file.url}
        download={file.name}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-canvas transition hover:bg-ink-2"
      >
        <Download className="size-4" /> Download
      </a>
    </div>
  );
}

export function ArtifactPanel({ file, onClose }: { file: OutputFile; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside aria-label={`Preview of ${file.name}`} className="flex h-full flex-col border-l border-line bg-canvas">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
        <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{file.name}</p>
        <a
          href={file.url}
          download={file.name}
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-2 transition hover:border-line-strong hover:text-ink"
        >
          <Download className="size-3.5" /> Download
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="rounded-full p-1.5 text-ink-3 transition hover:bg-sunken hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <Preview file={file} />
      </div>
    </aside>
  );
}
