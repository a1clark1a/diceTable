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

export type HitWeight = 'normal' | 'medium' | 'semibold';

// Weight climbs with the percentage so the three bands stay apart for anyone
// who cannot separate the red from the amber. Colour alone cannot carry a
// three-state signal.
export function hitWeight(p: number): HitWeight {
  const tone = hitTone(p);
  if (tone === 'good') return 'semibold';
  if (tone === 'mid') return 'medium';
  return 'normal';
}

export interface ShareCardPalette {
  background: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  grid: string;
  /** The hit-chance ramp, as literal hex: see hitColor for why. */
  hitGood: string;
  hitMid: string;
  hitBad: string;
  /**
   * The purple the target view marks its pool axis with (purple.fg). On screen
   * that axis is marked twice, purple.fg on the text and purple.solid on the
   * rules, but the card collapses them: purple.solid measures only 3.5:1 on the
   * dark card ground, under the floor for text.
   */
  poolAccent: string;
}

// The exported image is a standalone file: it leaves the app, so it cannot
// carry theme tokens with it. These are the two palettes it ships instead,
// kept here with the chart fills rather than loose in the share code. The hit
// ramp resolves what hitColor's tokens resolve to in src/theme.ts: green.700 /
// yellow.700 / red.600 on light, and the 400 ramp on dark.
export const SHARE_CARD_LIGHT: ShareCardPalette = {
  background: '#ffffff',
  panel: '#f8fafc',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  grid: '#e2e8f0',
  hitGood: '#116932',
  hitMid: '#845209',
  hitBad: '#dc2626',
  poolAccent: '#641ba3',
};

export const SHARE_CARD_DARK: ShareCardPalette = {
  background: '#0b1220',
  panel: '#111a2b',
  border: '#243044',
  text: '#e2e8f0',
  muted: '#94a3b8',
  grid: '#1e293b',
  hitGood: '#4ade80',
  hitMid: '#facc15',
  hitBad: '#f87171',
  poolAccent: '#d8b4fe',
};

export function shareCardPalette(theme: 'light' | 'dark'): ShareCardPalette {
  return theme === 'dark' ? SHARE_CARD_DARK : SHARE_CARD_LIGHT;
}

/** hitWeight as an SVG font-weight, so the bands stay apart without hue. */
export function shareHitWeight(p: number): number {
  const weight = hitWeight(p);
  if (weight === 'semibold') return 600;
  if (weight === 'medium') return 500;
  return 400;
}

/** hitColor for a card that cannot carry tokens; same bands, literal hex. */
export function shareHitColor(p: number, palette: ShareCardPalette): string {
  const tone = hitTone(p);
  if (tone === 'good') return palette.hitGood;
  if (tone === 'mid') return palette.hitMid;
  return palette.hitBad;
}
