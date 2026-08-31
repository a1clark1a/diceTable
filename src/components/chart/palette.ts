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

// Series get a stroke dash by index so overlapping lines stay distinguishable
// without relying on hue alone (color-blind users), and two coincident series no
// longer fully occlude each other. Index 0 (the primary row) stays solid. The
// exported image reads from here too, so a shared picture keeps the same cues.
const SERIES_DASH: readonly string[] = [
  '0', // solid, the primary row
  '7 4',
  '2 4',
  '9 4 2 4',
  '5 5',
  '1 4',
  '12 5',
  '4 4',
];

export function seriesDash(index: number): string {
  const safe = ((index % SERIES_DASH.length) + SERIES_DASH.length) % SERIES_DASH.length;
  return SERIES_DASH[safe] ?? '0';
}

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

export interface ShareCardPalette {
  background: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  grid: string;
}

// The exported image is a standalone file: it leaves the app, so it cannot
// carry theme tokens with it. These are the two palettes it ships instead,
// kept here with the chart fills rather than loose in the share code.
export const SHARE_CARD_LIGHT: ShareCardPalette = {
  background: '#ffffff',
  panel: '#f8fafc',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  grid: '#e2e8f0',
};

export const SHARE_CARD_DARK: ShareCardPalette = {
  background: '#0b1220',
  panel: '#111a2b',
  border: '#243044',
  text: '#e2e8f0',
  muted: '#94a3b8',
  grid: '#1e293b',
};

export function shareCardPalette(theme: 'light' | 'dark'): ShareCardPalette {
  return theme === 'dark' ? SHARE_CARD_DARK : SHARE_CARD_LIGHT;
}
