import type { ShareCardPalette } from '../../components/chart/palette';

export interface ShareImage {
  svg: string;
  width: number;
  height: number;
}

export const CARD_WIDTH = 920;
export const PADDING = 28;
const TITLE_HEIGHT = 42;
export const PANEL_HEADING = 22;
export const PLOT_HEIGHT = 300;
export const AXIS_GUTTER = 52;
// The lowest result sits inset from the axis, the way the chart pads its x-axis,
// so a marker on the first result does not land on the y-axis labels.
export const PLOT_X_PAD = 14;
export const AXIS_FOOT = 26;
export const LIST_GAP = 22;
export const LIST_LINE = 46;
export const FOOTER_HEIGHT = 34;
// The footer aside says what the picture leaves out, and the compare cards
// spend the same slot on their scale caveat. The matrix can fire three at once
// (row cap, mixed scales, rolls left out), which reaches 113 code points. At
// 11px that is roughly 660px of ink, and the credit on the left takes about
// 132px of the 864px live width, so the pair still does not collide.
const NOTE_CHARS = 120;

// The comparison views' full caption runs past NOTE_CHARS, so both compare
// cards state the same caveat in the space a footer aside has. One constant,
// because two cards print it and they must not drift apart.
export const MIXED_SCALE_CARD_NOTE = 'Pool rows are counted in successes, not totals';

const TITLE_CHARS = 70;
export const NAME_CHARS = 28;
export const NOTATION_CHARS = 72;

export const SANS =
  "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const MONO =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

// Everything drawn here is user-supplied text, so nothing reaches the markup
// without going through this first.
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// No DOM means no text measurement, so long strings are cut to a character
// budget instead. Monospace at 12px sits near 7.2px a character. The cut is by
// code points, not UTF-16 units: slicing through a surrogate pair would leave a
// lone surrogate that encodeURIComponent refuses, sinking every share action.
export function truncate(value: string, maxChars: number): string {
  const chars = Array.from(value);
  if (chars.length <= maxChars) return value;
  return `${chars.slice(0, Math.max(0, maxChars - 1)).join('')}…`;
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatStat(value: number): string {
  return value.toFixed(2);
}

/** A whole percent, the way the cards label every chance. */
export function formatCardPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export interface CardShellOptions {
  palette: ShareCardPalette;
  /** Full card height, including padding, header band and footer. */
  height: number;
  scale: number;
  /** Already trimmed. A blank title leaves the header band out entirely. */
  title: string;
  /** Already trimmed. A blank note leaves the footer aside out. */
  note: string;
  body: string[];
}

/** The header band's height, and the y every card's first panel starts at. */
export function headerHeight(title: string): number {
  return title.length > 0 ? TITLE_HEIGHT : 0;
}

// Every card is the same object: a painted ground, an optional heading, the
// drawing, and a footer carrying the credit and whatever the picture leaves out.
export function renderCard({
  palette,
  height,
  scale,
  title,
  note,
  body,
}: CardShellOptions): ShareImage {
  const parts: string[] = [];
  parts.push(
    `<rect x="0" y="0" width="${CARD_WIDTH}" height="${height}" fill="${palette.background}"/>`,
  );

  if (title.length > 0) {
    parts.push(
      `<text x="${PADDING}" y="${PADDING + 22}" font-family="${SANS}" font-size="20" font-weight="600" fill="${palette.text}">${escapeXml(truncate(title, TITLE_CHARS))}</text>`,
    );
  }

  parts.push(...body);

  parts.push(
    `<text x="${PADDING}" y="${height - PADDING + 6}" font-family="${SANS}" font-size="11" fill="${palette.muted}">built with dice-table.app</text>`,
  );

  if (note.length > 0) {
    parts.push(
      `<text x="${CARD_WIDTH - PADDING}" y="${height - PADDING + 6}" text-anchor="end" font-family="${SANS}" font-size="11" fill="${palette.muted}">${escapeXml(truncate(note, NOTE_CHARS))}</text>`,
    );
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH * scale}" height="${height * scale}" viewBox="0 0 ${CARD_WIDTH} ${height}">`,
    parts.join(''),
    '</svg>',
  ].join('');

  return { svg, width: CARD_WIDTH * scale, height: height * scale };
}

/** The uppercase panel label the chart uses over Totals and Successes. */
export function panelHeading(
  heading: string,
  y: number,
  palette: ShareCardPalette,
  color: string = palette.text,
): string {
  return `<text x="${PADDING}" y="${y + 12}" font-family="${SANS}" font-size="11" font-weight="600" letter-spacing="0.6" fill="${color}">${escapeXml(heading.toUpperCase())}</text>`;
}

/** A colour swatch and a name, the row identity every card repeats. */
export function rowSwatch(x: number, y: number, color: string): string {
  return `<rect x="${round(x)}" y="${round(y - 9)}" width="10" height="10" rx="2" fill="${color}"/>`;
}

export function scaleFor(scale: number | undefined): number {
  return scale !== undefined && scale > 0 ? scale : 1;
}
