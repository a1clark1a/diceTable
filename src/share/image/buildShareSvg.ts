import type { ChartView, Distribution } from '../../types';
import { sortedKeys } from '../../engine/distribution';
import { seriesDash, shareCardPalette } from '../../components/chart/palette';
import { buildSeriesEval, evalSeriesAt } from '../../components/chart/seriesEval';
import {
  formatMissPercent,
  planZeroSpikes,
  type ZeroSpikeRow,
} from '../../components/chart/zeroSpike';

export interface ShareImageRow {
  id: string;
  name: string;
  notation: string;
  color: string;
  dist: Distribution;
  canMiss: boolean;
  mean: number;
  stddev: number;
  min: number;
  max: number;
}

export interface ShareImageOptions {
  rows: ShareImageRow[];
  view: ChartView;
  theme: 'light' | 'dark';
  /** Optional heading. The header band is left out entirely when it is blank. */
  title?: string;
  /** Optional footer aside, for saying what the picture leaves out. */
  note?: string;
  scale?: number;
}

export interface ShareImage {
  svg: string;
  width: number;
  height: number;
}

const CARD_WIDTH = 920;
const PADDING = 28;
const TITLE_HEIGHT = 42;
const PLOT_HEIGHT = 300;
const AXIS_GUTTER = 52;
// The lowest result sits inset from the axis, the way the chart pads its x-axis,
// so a marker on the first result does not land on the y-axis labels.
const PLOT_X_PAD = 14;
const AXIS_FOOT = 26;
const LIST_GAP = 22;
const LIST_LINE = 46;
const FOOTER_HEIGHT = 34;
// The footer aside can carry both left-out notes at once ("N pool rolls are
// not in this picture. N rolls left out (too complex)"), which reaches 70
// code points with two-digit counts; the budget has to hold the pair whole.
// At 11px the aside still ends well clear of the credit on the left.
const NOTE_CHARS = 90;

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

const VIEW_LABELS: Record<ChartView, string> = {
  pmf: 'Chance of each result',
  cdf: 'Chance of rolling at most',
  ccdf: 'Chance of rolling at least',
  target: 'Chance of each result',
};

// Everything drawn here is user-supplied text, so nothing reaches the markup
// without going through this first.
function escapeXml(value: string): string {
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
function truncate(value: string, maxChars: number): string {
  const chars = Array.from(value);
  if (chars.length <= maxChars) return value;
  return `${chars.slice(0, Math.max(0, maxChars - 1)).join('')}…`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatStat(value: number): string {
  return value.toFixed(2);
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  const step = Math.max(1, Math.round((max - min) / count));
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}

export function buildShareSvg(options: ShareImageOptions): ShareImage {
  const { rows, theme } = options;
  const view: ChartView = options.view === 'target' ? 'pmf' : options.view;
  const palette = shareCardPalette(theme);
  const scale = options.scale && options.scale > 0 ? options.scale : 1;
  const title = (options.title ?? '').trim();

  const usable = rows.filter((r) => r.dist.size > 0);
  const headerHeight = title.length > 0 ? TITLE_HEIGHT : 0;
  const listHeight = usable.length * LIST_LINE;
  const height =
    PADDING * 2 +
    headerHeight +
    PLOT_HEIGHT +
    AXIS_FOOT +
    LIST_GAP +
    listHeight +
    FOOTER_HEIGHT;

  const parts: string[] = [];
  parts.push(
    `<rect x="0" y="0" width="${CARD_WIDTH}" height="${height}" fill="${palette.background}"/>`,
  );

  let y = PADDING;
  if (title.length > 0) {
    parts.push(
      `<text x="${PADDING}" y="${y + 22}" font-family="${SANS}" font-size="20" font-weight="600" fill="${palette.text}">${escapeXml(truncate(title, 70))}</text>`,
    );
    y += TITLE_HEIGHT;
  }

  const plotLeft = PADDING + AXIS_GUTTER;
  const plotRight = CARD_WIDTH - PADDING;
  const plotTop = y + 18;
  const plotBottom = y + PLOT_HEIGHT;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  parts.push(
    `<text x="${PADDING}" y="${y + 10}" font-family="${SANS}" font-size="11" fill="${palette.muted}">${escapeXml(VIEW_LABELS[view])}</text>`,
  );

  if (usable.length === 0) {
    parts.push(
      `<text x="${PADDING}" y="${plotTop + 40}" font-family="${SANS}" font-size="13" fill="${palette.muted}">No rolls to compare yet.</text>`,
    );
  } else {
    let globalMin = Infinity;
    let globalMax = -Infinity;
    const prepared = usable.map((row) => {
      const keys = sortedKeys(row.dist);
      const rowMin = keys[0] ?? 0;
      const rowMax = keys[keys.length - 1] ?? 0;
      if (rowMin < globalMin) globalMin = rowMin;
      if (rowMax > globalMax) globalMax = rowMax;
      return { row, series: buildSeriesEval(row.dist, rowMin, rowMax) };
    });
    if (globalMax <= globalMin) globalMax = globalMin + 1;

    const spikeRows: ZeroSpikeRow[] = usable.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      canMiss: row.canMiss,
      dist: row.dist,
    }));
    // Spikes exist only in the chance-of-each-result view, same as the chart on
    // screen: the cumulative views already fit inside 0 to 100%, so a marker
    // there would flag a bar that was never cut off. The plan's axis carries
    // the same rounding the chart uses, so a shared picture is labelled the way
    // the chart it came from was.
    const spikes = planZeroSpikes(view === 'pmf' ? spikeRows : []);
    const yMax = view === 'pmf' ? spikes.axis.domainMax : 1;
    const yTicks = view === 'pmf' ? spikes.axis.ticks : [0, 0.25, 0.5, 0.75, 1];

    const xSpan = plotWidth - PLOT_X_PAD * 2;
    const xAt = (value: number): number =>
      plotLeft + PLOT_X_PAD + ((value - globalMin) / (globalMax - globalMin)) * xSpan;
    const yAt = (p: number): number =>
      plotBottom - Math.min(p / yMax, 1) * plotHeight;

    for (const tick of yTicks) {
      const gridY = round(plotBottom - (tick / yMax) * plotHeight);
      const label = `${Math.round(tick * 100)}%`;
      parts.push(
        `<line x1="${plotLeft}" y1="${gridY}" x2="${plotRight}" y2="${gridY}" stroke="${palette.grid}" stroke-width="1"/>`,
      );
      parts.push(
        `<text x="${plotLeft - 8}" y="${gridY + 4}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${palette.muted}">${label}</text>`,
      );
    }

    for (const tick of niceTicks(globalMin, globalMax, 8)) {
      parts.push(
        `<text x="${round(xAt(tick))}" y="${plotBottom + 18}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${palette.muted}">${tick}</text>`,
      );
    }

    const stepWidth = xSpan / Math.max(1, globalMax - globalMin);
    prepared.forEach(({ row, series }, index) => {
      const points: string[] = [];
      for (let x = globalMin; x <= globalMax; x++) {
        const p = evalSeriesAt(series, x, view);
        const y = round(yAt(p));
        if (view === 'pmf') {
          // One flat tread per result, the way the chart draws it. A smooth
          // curve here would turn a spike into a hill the roll cannot make.
          points.push(`${round(xAt(x) - stepWidth / 2)},${y}`);
          points.push(`${round(xAt(x) + stepWidth / 2)},${y}`);
        } else {
          points.push(`${round(xAt(x))},${y}`);
        }
      }
      parts.push(
        `<polyline points="${points.join(' ')}" fill="none" stroke="${row.color}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="${seriesDash(index)}"/>`,
      );
    });

    for (const marker of spikes.markers) {
      const cx = round(xAt(0));
      parts.push(
        `<circle cx="${cx}" cy="${plotTop}" r="4" fill="${marker.color}" stroke="${palette.background}" stroke-width="2"/>`,
      );
      // Under the dot rather than beside it: level with the marker the label
      // would sit on the top gridline and crowd its percentage.
      parts.push(
        `<text x="${cx + 8}" y="${plotTop + 16}" font-family="${MONO}" font-size="11" fill="${marker.color}">${formatMissPercent(marker.probability)}</text>`,
      );
    }

    let listY = plotBottom + AXIS_FOOT + LIST_GAP;
    for (const row of usable) {
      parts.push(
        `<rect x="${PADDING}" y="${listY - 9}" width="10" height="10" rx="2" fill="${row.color}"/>`,
      );
      parts.push(
        `<text x="${PADDING + 20}" y="${listY}" font-family="${SANS}" font-size="13" font-weight="600" fill="${palette.text}">${escapeXml(truncate(row.name, 28))}</text>`,
      );
      parts.push(
        `<text x="${CARD_WIDTH - PADDING}" y="${listY}" text-anchor="end" font-family="${MONO}" font-size="13" fill="${palette.text}">${formatStat(row.mean)} ± ${formatStat(row.stddev)}</text>`,
      );
      parts.push(
        `<text x="${PADDING + 20}" y="${listY + 17}" font-family="${MONO}" font-size="12" fill="${palette.muted}">${escapeXml(truncate(row.notation, 72))}</text>`,
      );
      parts.push(
        `<text x="${CARD_WIDTH - PADDING}" y="${listY + 17}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${palette.muted}">${row.min} to ${row.max}</text>`,
      );
      listY += LIST_LINE;
    }
  }

  parts.push(
    `<text x="${PADDING}" y="${height - PADDING + 6}" font-family="${SANS}" font-size="11" fill="${palette.muted}">built with dice-table.app</text>`,
  );

  const note = (options.note ?? '').trim();
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
