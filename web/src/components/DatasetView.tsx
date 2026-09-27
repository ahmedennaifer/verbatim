import { Check, X } from "lucide-react";
import { formatCount, type Info } from "../lib/api";

const CAN = [
  "Ratings, their distribution and how they change over time",
  "What reviewers praise or complain about, with the reviews to prove it",
  "Rankings of products and brands by review volume and rating",
  "Comparisons between brands, categories and periods",
];

const CANNOT = [
  "Sales, revenue, profit or returns (review volume stands in for demand)",
  "Prices for most products (only about 7% have one)",
  "Anything after September 2023 or outside beauty and fashion",
];

export function DatasetView({ info, onAsk }: { info?: Info; onAsk: (text: string) => void }) {
  const stats = [
    { label: "Reviews", value: info?.dataset.reviews },
    { label: "Products", value: info?.dataset.products },
    { label: "Brands", value: info?.dataset.brands },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10">
      <p className="text-[13px] font-medium text-ember-ink">Dataset</p>
      <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.02em] text-ink">Amazon Reviews 2023 · Beauty & Fashion</h1>
      <p className="mt-2 max-w-[62ch] text-[14.5px] leading-6 text-ink-3">
        Public customer reviews collected by UC San Diego's McAuley Lab, from November 2000 to September 2023. The assistant
        queries it read-only.
      </p>

      <dl className="mt-8 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface">
        {stats.map((stat) => (
          <div key={stat.label} className="px-5 py-4">
            <dt className="text-[13px] text-ink-3">{stat.label}</dt>
            <dd className="mt-1 font-mono text-[22px] font-medium text-ink tabular-nums">{stat.value ? formatCount(stat.value) : "—"}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="text-[14px] font-semibold text-ink">Good questions for this data</h2>
          <ul className="mt-3 space-y-2.5">
            {CAN.map((item) => (
              <li key={item} className="flex gap-2.5 text-[14px] leading-6 text-ink-2">
                <Check className="mt-1 size-4 shrink-0 text-[oklch(0.55_0.13_150)]" />
                {item}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-[14px] font-semibold text-ink">What it can't tell you</h2>
          <ul className="mt-3 space-y-2.5">
            {CANNOT.map((item) => (
              <li key={item} className="flex gap-2.5 text-[14px] leading-6 text-ink-2">
                <X className="mt-1 size-4 shrink-0 text-ink-3" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <button
        type="button"
        onClick={() => onAsk("Give me an overview of this dataset: biggest brands, rating trends and anything surprising, with a chart.")}
        className="mt-10 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-canvas transition hover:bg-ink-2"
      >
        Explore it with an overview analysis
      </button>
    </div>
  );
}
