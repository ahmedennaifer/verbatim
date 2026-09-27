export function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-ink" />
        <path
          d="M9 21.5 13.5 15l4 3.5L23 10"
          fill="none"
          className="stroke-ember"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withName && <span className="text-[15px] font-semibold tracking-tight text-ink">Verbatim</span>}
    </span>
  );
}
