export const ROW_PALETTE = [
  '#2563eb',
  '#ea580c',
  '#16a34a',
  '#9333ea',
  '#db2777',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
] as const;

export function rowColor(index: number): string {
  const safe = ((index % ROW_PALETTE.length) + ROW_PALETTE.length) % ROW_PALETTE.length;
  return ROW_PALETTE[safe]!;
}

function hitTone(p: number): 'good' | 'mid' | 'bad' {
  if (p >= 0.66) return 'good';
  if (p >= 0.33) return 'mid';
  return 'bad';
}

export type HitToken = 'hit.good' | 'hit.mid' | 'hit.bad';

export function hitColor(p: number): HitToken {
  const tone = hitTone(p);
  if (tone === 'good') return 'hit.good';
  if (tone === 'mid') return 'hit.mid';
  return 'hit.bad';
}
