// The executor cites reviews as "review 139913", "reviews 12 and 34" or "review_id 55".
const CITATION = /\breview(?:s|_id)?\s+#?(\d{2,8})((?:\s*(?:,|and|&)\s*#?\d{2,8})*)/gi;

export function citedReviewIds(text: string): number[] {
  const ids = new Set<number>();
  for (const match of text.matchAll(CITATION)) {
    ids.add(Number(match[1]));
    for (const extra of match[2].matchAll(/\d{2,8}/g)) ids.add(Number(extra[0]));
  }
  return [...ids];
}

/** Turn citations into markdown links (#review-<id>) that the answer renders as citation chips. */
export function linkCitations(text: string): string {
  return text.replace(CITATION, (full, first: string, rest: string) => {
    const link = (id: string) => `[${id}](#review-${id})`;
    const tail = rest.replace(/#?(\d{2,8})/g, (_m, id: string) => link(id));
    return full.replace(new RegExp(`#?${first}`), link(first)).replace(rest, tail);
  });
}
