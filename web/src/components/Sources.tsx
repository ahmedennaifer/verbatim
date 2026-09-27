import { BadgeCheck, Star, ThumbsUp } from "lucide-react";
import { useState } from "react";
import type { Review } from "../lib/api";

export function Stars({ rating, size = "size-3" }: { rating: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-px" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={[size, i <= rating ? "fill-ember text-ember" : "fill-line text-line"].join(" ")} />
      ))}
    </span>
  );
}

function ReviewCard({ review, onSelect, selected }: { review: Review; onSelect: () => void; selected: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "flex w-60 shrink-0 flex-col gap-1.5 rounded-xl border bg-surface p-3 text-left transition",
        selected ? "border-ember/50 ring-2 ring-ember/15" : "border-line hover:border-line-strong",
      ].join(" ")}
    >
      <span className="flex items-center justify-between gap-2">
        <Stars rating={review.rating} />
        <span className="font-mono text-[11px] text-ink-3">#{review.id}</span>
      </span>
      <span className="line-clamp-2 text-[13px] leading-5 font-medium text-ink">{review.title || review.body}</span>
      <span className="truncate text-[12px] text-ink-3">{review.brand ?? review.product}</span>
    </button>
  );
}

export function ReviewDetail({ review }: { review: Review }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-3">
        <Stars rating={review.rating} size="size-3.5" />
        {review.date && <span>{new Date(review.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>}
        {review.verified && (
          <span className="inline-flex items-center gap-1 text-[oklch(0.5_0.12_150)]">
            <BadgeCheck className="size-3.5" /> Verified purchase
          </span>
        )}
        {review.helpful_votes > 0 && (
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="size-3.5" /> {review.helpful_votes}
          </span>
        )}
      </div>
      {review.title && <p className="text-[14px] font-semibold text-ink">{review.title}</p>}
      {review.body && <p className="text-[14px] leading-6 text-ink-2">{review.body}</p>}
      {review.product && <p className="truncate text-[12.5px] text-ink-3">{review.product}</p>}
    </div>
  );
}

/** The reviews an answer cites, as a scrollable row; picking one shows it in full. */
export function Sources({ reviews }: { reviews: Review[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!reviews.length) return null;
  const current = reviews.find((r) => r.id === selected);

  return (
    <section aria-label="Sources" className="space-y-2">
      <h3 className="text-[13px] font-medium text-ink-2">
        Sources <span className="text-ink-3">· {reviews.length} {reviews.length === 1 ? "review" : "reviews"}</span>
      </h3>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            selected={review.id === selected}
            onSelect={() => setSelected(review.id === selected ? null : review.id)}
          />
        ))}
      </div>
      {current && (
        <div className="animate-rise rounded-xl border border-line bg-surface p-4">
          <ReviewDetail review={current} />
        </div>
      )}
    </section>
  );
}
