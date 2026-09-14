export interface LitRow {
  id: string;
  name: string;
  mean: number;
}

/**
 * What a screen reader gets in place of the field.
 *
 * The field answers "where does my roll sit among all of them" by showing it,
 * which is nothing to anyone who cannot see it. Rank by average says the same
 * thing in one sentence, and it is the question the wide canvas exists for, so
 * the surface is not a visual-only feature with an apology attached.
 *
 * Averages, not a name list: a hundred names read aloud is the wall the field
 * was built to avoid.
 */
export function litSummary(rows: readonly LitRow[], litId: string | null): string {
  if (litId === null) return '';
  const lit = rows.find((row) => row.id === litId);
  if (lit === undefined) return '';
  const total = rows.length;
  // Ties count as not-beaten, so the sentence never claims a roll beats one it
  // only matches.
  const below = rows.filter((row) => row.id !== lit.id && row.mean < lit.mean)
    .length;
  if (total === 1) return `${lit.name} lit. It is the only roll drawn.`;
  if (below === total - 1) {
    return `${lit.name} lit. Its average is the highest of all ${total} rolls drawn.`;
  }
  if (below === 0) {
    return `${lit.name} lit. Its average is the lowest of all ${total} rolls drawn.`;
  }
  return `${lit.name} lit. Its average is higher than ${below} of the other ${total - 1} rolls drawn.`;
}
