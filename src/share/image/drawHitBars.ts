import type { ShareCardPalette } from '../../components/chart/palette';
import {
  AXIS_GUTTER,
  MONO,
  NAME_CHARS,
  SANS,
  escapeXml,
  formatCardPercent,
  round,
  truncate,
} from './svgPrimitives';

export interface HitBarRow {
  id: string;
  name: string;
  color: string;
  /** One chance per column, in column order. */
  hits: number[];
}

export interface HitBarColumn {
  /** What the column measures, as the chart labels it ("≥15", "3+ successes"). */
  label: string;
}

export interface HitBarsSpec {
  rows: HitBarRow[];
  columns: HitBarColumn[];
  palette: ShareCardPalette;
  /** Left edge of the whole block, y-axis labels included. */
  x: number;
  width: number;
  /** Top of the block. The key sits here, the plot below it. */
  y: number;
  /** Total block height, key and row names included. */
  height: number;
}

export interface HitBarsDrawing {
  parts: string[];
  /** Rows actually drawn. The rest would have been unreadable slivers. */
  shown: number;
  /** Rows the width could not hold, for the caller's footer note. */
  hidden: number;
}

const KEY_HEIGHT = 20;
const NAME_FOOT = 22;
const BAR_GAP = 3;
const GROUP_GAP = 14;
// Below this a bar is a sliver nobody can read a height off, so rows are
// dropped and counted rather than drawn as noise.
const MIN_BAR_WIDTH = 7;
// ~px per glyph of 10px ui-monospace, the same figure the on-screen chart uses
// to decide whether a bar label fits over its bar.
const LABEL_CHAR_WIDTH = 6.1;

// Later targets are harder, so their bars step lighter, the same ramp the chart
// walks. Colour still says which roll; opacity says which target.
export function targetOpacity(index: number, total: number): number {
  if (total <= 1) return 0.85;
  const min = 0.35;
  const max = 0.9;
  return max - ((max - min) / (total - 1)) * index;
}

/** How many rows fit before bars drop under the legibility floor. */
export function hitBarCapacity(width: number, targets: number): number {
  const plotWidth = width - AXIS_GUTTER;
  const groupWidth =
    Math.max(1, targets) * MIN_BAR_WIDTH +
    Math.max(0, targets - 1) * BAR_GAP +
    GROUP_GAP;
  return Math.max(1, Math.floor(plotWidth / groupWidth));
}

/**
 * The grouped hit-rate bars the chart's target view shows: one group per roll,
 * one bar per target, heights read straight off the chances handed in.
 */
export function drawHitBars({
  rows,
  columns,
  palette,
  x,
  width,
  y,
  height,
}: HitBarsSpec): HitBarsDrawing {
  const parts: string[] = [];
  if (columns.length === 0 || rows.length === 0) {
    parts.push(
      `<text x="${x}" y="${y + 40}" font-family="${SANS}" font-size="13" fill="${palette.muted}">No targets to measure against yet.</text>`,
    );
    return { parts, shown: 0, hidden: 0 };
  }

  const capacity = hitBarCapacity(width, columns.length);
  const shownRows = rows.slice(0, capacity);
  const hidden = rows.length - shownRows.length;

  // The key names the opacity ramp; without it a lighter bar is unreadable.
  let keyX = x + AXIS_GUTTER;
  columns.forEach((column, ci) => {
    const opacity = targetOpacity(ci, columns.length);
    parts.push(
      `<rect x="${round(keyX)}" y="${y + 2}" width="10" height="10" rx="2" fill="${palette.text}" fill-opacity="${round(opacity)}"/>`,
    );
    parts.push(
      `<text x="${round(keyX + 15)}" y="${y + 11}" font-family="${MONO}" font-size="11" fill="${palette.muted}">${escapeXml(column.label)}</text>`,
    );
    keyX += 15 + Array.from(column.label).length * LABEL_CHAR_WIDTH + 18;
  });

  const plotLeft = x + AXIS_GUTTER;
  const plotRight = x + width;
  const plotTop = y + KEY_HEIGHT + 12;
  const plotBottom = y + height - NAME_FOOT;
  const plotHeight = plotBottom - plotTop;

  for (const tick of [0, 0.25, 0.5, 0.75, 1]) {
    const gridY = round(plotBottom - tick * plotHeight);
    parts.push(
      `<line x1="${plotLeft}" y1="${gridY}" x2="${plotRight}" y2="${gridY}" stroke="${palette.grid}" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${plotLeft - 8}" y="${gridY + 4}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${palette.muted}">${formatCardPercent(tick)}</text>`,
    );
  }

  const groupWidth = (plotRight - plotLeft) / shownRows.length;
  const barsWidth = groupWidth - GROUP_GAP;
  const barWidth =
    (barsWidth - BAR_GAP * (columns.length - 1)) / columns.length;

  shownRows.forEach((row, ri) => {
    const groupLeft = plotLeft + groupWidth * ri + GROUP_GAP / 2;
    columns.forEach((_, ci) => {
      const p = Math.min(1, Math.max(0, row.hits[ci] ?? 0));
      const barLeft = groupLeft + (barWidth + BAR_GAP) * ci;
      const barHeight = p * plotHeight;
      parts.push(
        `<rect x="${round(barLeft)}" y="${round(plotBottom - barHeight)}" width="${round(barWidth)}" height="${round(barHeight)}" fill="${row.color}" fill-opacity="${round(targetOpacity(ci, columns.length))}"/>`,
      );
      const label = formatCardPercent(p);
      // Same rule as the chart: labels are all-or-nothing per bar, so a run of
      // them never turns into overlapping smears.
      if (Array.from(label).length * LABEL_CHAR_WIDTH <= barWidth + 2) {
        parts.push(
          `<text x="${round(barLeft + barWidth / 2)}" y="${round(plotBottom - barHeight - 4)}" text-anchor="middle" font-family="${MONO}" font-size="10" fill="${palette.muted}">${label}</text>`,
        );
      }
    });

    // Names get roughly one character per 6.6px of group at 11px sans.
    const nameChars = Math.max(4, Math.min(NAME_CHARS, Math.floor(groupWidth / 6.6)));
    parts.push(
      `<text x="${round(groupLeft + barsWidth / 2)}" y="${round(plotBottom + 16)}" text-anchor="middle" font-family="${SANS}" font-size="11" fill="${palette.text}">${escapeXml(truncate(row.name, nameChars))}</text>`,
    );
  });

  return { parts, shown: shownRows.length, hidden };
}
