import { useEffect, useState } from "react";
import { API_URL, type OutputFile } from "./agent";

export type Artifact = OutputFile & { size: number; created_at: string };
export type Review = {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  date: string | null;
  verified: boolean | null;
  helpful_votes: number;
  product: string | null;
  brand: string | null;
};
export type Info = { model: string; provider: string; dataset: Record<string, number> };

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

/** Fetch once per key; `key` null skips the request. */
function useFetch<T>(key: string | null, path: () => string): T | undefined {
  const [data, setData] = useState<{ key: string; value: T }>();
  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    getJson<T>(path())
      .then((value) => !cancelled && setData({ key, value }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);
  return data && data.key === key ? data.value : undefined;
}

export function useInfo() {
  return useFetch<Info>("info", () => "/info");
}

export function useArtifacts(refreshKey: number) {
  return useFetch<Artifact[]>(`artifacts-${refreshKey}`, () => "/artifacts");
}

const reviewCache = new Map<number, Review>();

/** Reviews cited in an answer, fetched once and cached for the session. */
export function useReviews(ids: number[]): Map<number, Review> {
  const missing = ids.filter((id) => !reviewCache.has(id));
  const key = missing.length ? missing.join(",") : null;
  const fetched = useFetch<Review[]>(key, () => `/reviews?ids=${key}`);
  if (fetched) for (const review of fetched) reviewCache.set(review.id, review);
  return new Map(ids.flatMap((id) => (reviewCache.has(id) ? [[id, reviewCache.get(id)!]] : [])));
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}
