import type { Plan } from "../lib/agent";

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <section aria-label="Plan" className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_oklch(0.2_0.01_262/0.04)]">
      <p className="text-[13px] font-medium text-ember-ink">Plan</p>
      <p className="mt-1 text-[15px] leading-6 font-medium text-ink">{plan.objective}</p>

      <ol className="mt-4 space-y-2">
        {plan.steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-6 text-ink-2">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-sunken font-mono text-[11px] text-ink-3 tabular-nums">
              {i + 1}
            </span>
            <span>{step.goal}</span>
          </li>
        ))}
      </ol>

      {plan.assumptions.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[13px] font-medium text-ink-2">Assumptions</p>
          <ul className="mt-1.5 space-y-1 text-[13.5px] leading-6 text-ink-3">
            {plan.assumptions.map((assumption, i) => (
              <li key={i}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
