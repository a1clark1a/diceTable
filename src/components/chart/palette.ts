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
   * rules, but the card collapses them: purple.solid measures only 3.2:1 on the
   * dark card ground, under the floor for text.
   */
  poolAccent: string;
}

// The exported image is a standalone file: it leaves the app, so it cannot
// carry theme tokens with it. These are the two palettes it ships instead,
// kept here with the chart fills rather than loose in the share code. Every
// value mirrors the semantic token of the same role in src/theme.ts, so a card
// saved from the app looks like the app it came from: background is bg, panel
// is bg.panel, border is border, grid is border.subtle, text is fg, muted is
// fg.muted, and the hit ramp is hit.good / hit.mid / hit.bad.
export const SHARE_CARD_LIGHT: ShareCardPalette = {
  background: '#f2f1ed',
  panel: '#fbfaf8',
  border: '#d6d2c9',
  text: '#22221f',
  muted: '#5c5952',
  grid: '#e3e0d8',
  hitGood: '#2c7454',
  hitMid: '#8a5e17',
  hitBad: '#a0403a',
  poolAccent: '#5b3f94',
};

export const SHARE_CARD_DARK: ShareCardPalette = {
  background: '#131519',
  panel: '#1a1d22',
  border: '#303640',
  text: '#e4e7eb',
  muted: '#a5acb6',
  grid: '#252a31',
  hitGood: '#58be92',
  hitMid: '#dda857',
  hitBad: '#e4726a',
  poolAccent: '#b7a2f0',
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
