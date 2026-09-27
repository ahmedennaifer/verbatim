/** Parse the markdown table returned by run_sql ("| a | b |" rows) into header and rows. */
export function parseMarkdownTable(text: string): { header: string[]; rows: string[][] } | null {
  const lines = text.split("\n").filter((line) => line.trim().startsWith("|"));
  if (lines.length < 2) return null;
  const split = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replace(/\\\|/g, "|"));
  return { header: split(lines[0]), rows: lines.slice(2).map(split) };
}

const NUMERIC = /^-?[\d,]+(\.\d+)?%?$/;

export function DataTable({ header, rows }: { header: string[]; rows: string[][] }) {
  return (
    <div className="max-h-80 overflow-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 bg-sunken">
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="border-b border-line px-3 py-2 font-medium whitespace-nowrap text-ink-2">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-line last:border-0 hover:bg-canvas">
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={
                    NUMERIC.test(cell)
                      ? "px-3 py-1.5 text-right font-mono whitespace-nowrap text-ink tabular-nums"
                      : "max-w-80 truncate px-3 py-1.5 text-ink-2"
                  }
                  title={cell}
                >
                  {cell === "NULL" ? <span className="text-ink-3">—</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
