import type { ReactNode } from "react";

const SQL_KEYWORDS =
  /\b(select|from|where|join|left|right|inner|outer|on|group|by|order|having|limit|offset|as|and|or|not|in|is|null|case|when|then|else|end|with|distinct|count|sum|avg|min|max|round|coalesce|lower|upper|date_trunc|extract|desc|asc|union|all|between|like|ilike|over|partition|filter|cast|interval)\b/gi;

/** Minimal SQL highlighting: keywords, strings and numbers. */
function highlightSql(sql: string): ReactNode[] {
  const tokens = sql.split(/('(?:[^']|'')*'|\b\d+(?:\.\d+)?\b)/g);
  return tokens.map((token, i) => {
    if (token.startsWith("'")) return <span key={i} className="text-[oklch(0.5_0.12_150)]">{token}</span>;
    if (/^\d/.test(token)) return <span key={i} className="text-[oklch(0.5_0.14_300)]">{token}</span>;
    const parts = token.split(SQL_KEYWORDS);
    return parts.map((part, j) =>
      j % 2 === 1 ? (
        <span key={`${i}-${j}`} className="font-medium text-ember-ink">
          {part.toUpperCase()}
        </span>
      ) : (
        part
      ),
    );
  });
}

export function Code({ children, language }: { children: string; language: "sql" | "python" | "javascript" }) {
  return (
    <pre className="max-h-72 overflow-auto rounded-xl border border-line bg-sunken px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink-2">
      <code>{language === "sql" ? highlightSql(children.trim()) : children.trim()}</code>
    </pre>
  );
}
