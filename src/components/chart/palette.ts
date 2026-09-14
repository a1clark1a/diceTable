// Eight series hues, one set per colour mode. The hue family is the same in
// both (blue, orange, green, purple, rose, cyan, olive, pink), so a row keeps
// its identity across a theme switch; only lightness and chroma move.
//
// One shared set is not possible, which is why this used to fail. A row colour
// is painted on bg (the table row, which Chakra's line recipe paints), bg.subtle
// (hover, the card sparkline well, the expanded row), bg.muted (the pinned row
// and the bar tracks), bg.emphasized (the chart hover cursor), bg.panel (cards,
// the chart, the legend, the inspect dialog) and the share card's own copies of
// bg and bg.panel. Asking one set to clear 3:1 against the darkest light ground
// (#dedcd5) and the lightest dark ground (#262b32) at once leaves a luminance
// window of 0.1711 to 0.2051, a 1.15:1 span. Eight hues fit in it; eight
// distinguishable hues do not, because lightness is what separates them once
// chroma is flat and that window holds no lightness range at all.
//
// Chroma is held flat at the highest value all eight hues reach in gamut at
// their assigned lightness: 0.090 light, 0.105 dark. Flat is the point: at mixed
// saturation the loudest row reads as the most important one, which is a lie
// when the index is arbitrary. (The 0.13 the old comment claimed was never
// reachable; cyan and olive top out below it.)
//
// Separation is a property of the set, not of any one entry. Each set clears,
// against every ground above in its own mode: 3:1 contrast (worst 3.74 light,
// 3.45 dark), adjacent dE2000 >= 15 unsimulated (27.4 / 26.9), adjacent >= 8
// under simulated protanopia and deuteranopia (11.6 / 14.4 light, 10.4 / 18.5
// dark), and all-pairs >= 8 under both (9.1 / 9.0 light, 8.3 / 8.2 dark).
// Re-check the whole set, against all six grounds, before moving a slot.
//
// These literals are mirrored as row.1 through row.8 in src/theme.ts, which is
// what the app paints with, and src/theme.test.ts pins the two together. They
// are kept here as well because the share image leaves the app and cannot carry
// a CSS variable with it, the same reason SHARE_CARD_LIGHT exists below.
export const ROW_PALETTE_LIGHT = [
  '#21396a',
  '#673406',
  '#075b3c',
  '#7a639c',
  '#551b30',
  '#065e75',
  '#715b14',
  '#935059',
] as const;

export const ROW_PALETTE_DARK = [
  '#8eb1f4',
  '#d79362',
  '#96edc1',
  '#8c70b4',
  '#f6a1ba',
  '#3ea6c7',
  '#e4c878',
  '#c3707b',
] as const;

export function rowPalette(theme: 'light' | 'dark'): readonly string[] {
  return theme === 'dark' ? ROW_PALETTE_DARK : ROW_PALETTE_LIGHT;
}

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

const ROW_SLOTS = ROW_PALETTE_LIGHT.length;

function rowSlot(index: number): number {
  return ((index % ROW_SLOTS) + ROW_SLOTS) % ROW_SLOTS;
}

/**
 * The token, not a literal, so the browser swaps the two sets on a theme change
 * with no React render in between. A variable rather than a Chakra token name
 * because the same string is handed to both Chakra props and raw SVG paint
 * attributes in Recharts, and only one of those resolves token names.
 */
export function rowColor(index: number): string {
  return `var(--chakra-colors-row-${rowSlot(index) + 1})`;
}

/** For the share image, which leaves the app and takes no variables with it. */
export function rowColorHex(index: number, theme: 'light' | 'dark'): string {
  return rowPalette(theme)[rowSlot(index)]!;
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
  hitGood: '#206949',
  hitMid: '#7f5507',
  hitBad: '#963839',
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
