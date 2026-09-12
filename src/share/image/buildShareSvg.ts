import type { ChartView, Distribution, TargetState } from '../../types';
import { sortedKeys } from '../../engine/distribution';
import { hitProbability } from '../../engine/stats';
import {
  seriesDash,
  shareCardPalette,
  type ShareCardPalette,
} from '../../components/chart/palette';
import { effectiveChartView } from '../../components/chart/effectiveView';
import { RULING_SYMBOL } from '../../components/targetRulingMeta';
import { buildSeriesEval, evalSeriesAt } from '../../components/chart/seriesEval';
import {
  formatMissPercent,
  planZeroSpikes,
  type ZeroSpikeRow,
} from '../../components/chart/zeroSpike';
import { drawHitBars, type HitBarColumn } from './drawHitBars';
import {
  AXIS_FOOT,
  AXIS_GUTTER,
  CARD_WIDTH,
  FOOTER_HEIGHT,
  LIST_GAP,
  LIST_LINE,
  MONO,
  NAME_CHARS,
  NOTATION_CHARS,
  PADDING,
  PANEL_HEADING,
  PLOT_HEIGHT,
  PLOT_X_PAD,
  SANS,
  escapeXml,
  formatCardPercent,
  formatStat,
  headerHeight,
  panelHeading,
  renderCard,
  round,
  rowSwatch,
  scaleFor,
  truncate,
  type ShareImage,
} from './svgPrimitives';

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
  /**
   * One view per panel, because the two panels own their view separately on
   * screen and the picture mirrors the screen. Each still resolves the target
   * view against its own target.
   */
  totalsView: ChartView;
  successesView: ChartView;
  theme: 'light' | 'dark';
  /** Optional heading. The header band is left out entirely when it is blank. */
  title?: string;
  /** Optional footer aside, for saying what the picture leaves out. */
  note?: string;
  scale?: number;
  /** The numeric targets the totals panel measures against in the target view. */
  target?: TargetState;
  /**
   * Pool rows count successes, so they cannot share an axis with totals. They
   * get their own panel stacked under the totals one, the way the chart splits
   * on screen.
   */
  poolRows?: ShareImageRow[];
  /**
   * The pool targets the successes panel measures against. It resolves the
   * target view on its own, so Successes can show hit bars while the numeric
   * list is empty and Totals falls back to the chance of each result.
   */
  poolTarget?: TargetState;
}

const NO_TARGET: TargetState = { values: [], ruling: 'gte' };

const VIEW_LABELS: Record<ChartView, string> = {
  pmf: 'Chance of each result',
  cdf: 'Chance of rolling at most',
  ccdf: 'Chance of rolling at least',
  target: 'Chance of hitting each target',
};

function niceTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  const step = Math.max(1, Math.round((max - min) / count));
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);
  const last = ticks[ticks.length - 1] ?? min;
  if (last !== max) {
    if (max - last >= step / 2) ticks.push(max);
    else ticks[ticks.length - 1] = max;
  }
  return ticks;
}

// Flat treads are drawn half a step either side of their result, so a domain of
// a handful of results needs half a step of margin or the end treads run off the
// card: a 5d6 pool counting 0 to 5 successes puts its last edge 36px past the
// right rule. Reserving half a band resolves the circularity (the band width
// depends on the span, which depends on the margin) and collapses back to the
// plain inset once the results are dense enough not to need it.
function plotInset(results: number, plotWidth: number, view: ChartView): number {
  if (view !== 'pmf') return PLOT_X_PAD;
  return Math.max(PLOT_X_PAD, plotWidth / (2 * Math.max(1, results)));
}

function targetColumns(target: TargetState): HitBarColumn[] {
  const symbol = RULING_SYMBOL[target.ruling];
  return target.values.map((value) => ({ label: `${symbol}${value}` }));
}

interface PanelSpec {
  /** Already filtered to rows with something to draw. */
  rows: ShareImageRow[];
  view: ChartView;
  target: TargetState;
  palette: ShareCardPalette;
  originY: number;
  /** Null on a single-panel card, which reads as one chart needing no label. */
  heading: string | null;
  /** Successes panels carry the same purple the chart titles them with. */
  pool: boolean;
}

interface PanelDrawing {
  parts: string[];
  height: number;
  /** Rows the target bars could not fit, for the caller's footer note. */
  hidden: number;
}

function drawPanel({
  rows,
  view,
  target,
  palette,
  originY,
  heading,
  pool,
}: PanelSpec): PanelDrawing {
  const parts: string[] = [];
  let hidden = 0;
  let y = originY;

  if (heading !== null) {
    parts.push(
      panelHeading(heading, y, palette, pool ? palette.poolAccent : palette.text),
    );
    y += PANEL_HEADING;
  }

  const plotLeft = PADDING + AXIS_GUTTER;
  const plotRight = CARD_WIDTH - PADDING;
  const plotTop = y + 18;
  const plotBottom = y + PLOT_HEIGHT;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  // Over the plot, not over the y-axis gutter: at x = PADDING this caption
  // sits 12px above the topmost tick label and the two run together.
  parts.push(
    `<text x="${plotLeft}" y="${y + 10}" font-family="${SANS}" font-size="11" fill="${palette.muted}">${escapeXml(VIEW_LABELS[view])}</text>`,
  );

  if (rows.length === 0) {
    parts.push(
      `<text x="${PADDING}" y="${plotTop + 40}" font-family="${SANS}" font-size="13" fill="${palette.muted}">No rolls to compare yet.</text>`,
    );
  } else if (view === 'target') {
    // The chart swaps its curves for grouped bars here, so the picture does too
    // rather than substituting a line chart the user was not looking at.
    const bars = drawHitBars({
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color,
        hits: target.values.map((v) =>
          hitProbability(row.dist, v, target.ruling),
        ),
      })),
      columns: targetColumns(target),
      palette,
      x: PADDING,
      width: CARD_WIDTH - PADDING * 2,
      y: plotTop,
      height: PLOT_HEIGHT + AXIS_FOOT - 18,
    });
    parts.push(...bars.parts);
    hidden = bars.hidden;
  } else {
    let globalMin = Infinity;
    let globalMax = -Infinity;
    const prepared = rows.map((row) => {
      const keys = sortedKeys(row.dist);
      const rowMin = keys[0] ?? 0;
      const rowMax = keys[keys.length - 1] ?? 0;
      if (rowMin < globalMin) globalMin = rowMin;
      if (rowMax > globalMax) globalMax = rowMax;
      return { row, series: buildSeriesEval(row.dist, rowMin, rowMax) };
    });
    if (globalMax <= globalMin) globalMax = globalMin + 1;

    const spikeRows: ZeroSpikeRow[] = rows.map((row) => ({
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

    const inset = plotInset(globalMax - globalMin + 1, plotWidth, view);
    const xSpan = plotWidth - inset * 2;
    const xAt = (value: number): number =>
      plotLeft + inset + ((value - globalMin) / (globalMax - globalMin)) * xSpan;
    const yAt = (p: number): number =>
      plotBottom - Math.min(p / yMax, 1) * plotHeight;

    for (const tick of yTicks) {
      const gridY = round(plotBottom - (tick / yMax) * plotHeight);
      parts.push(
        `<line x1="${plotLeft}" y1="${gridY}" x2="${plotRight}" y2="${gridY}" stroke="${palette.grid}" stroke-width="1"/>`,
      );
      parts.push(
        `<text x="${plotLeft - 8}" y="${gridY + 4}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${palette.muted}">${formatCardPercent(tick)}</text>`,
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
  }

  let listY = plotBottom + AXIS_FOOT + LIST_GAP;
  for (const row of rows) {
    parts.push(rowSwatch(PADDING, listY, row.color));
    parts.push(
      `<text x="${PADDING + 20}" y="${listY}" font-family="${SANS}" font-size="13" font-weight="600" fill="${palette.text}">${escapeXml(truncate(row.name, NAME_CHARS))}</text>`,
    );
    parts.push(
      `<text x="${CARD_WIDTH - PADDING}" y="${listY}" text-anchor="end" font-family="${MONO}" font-size="13" fill="${palette.text}">${formatStat(row.mean)} ± ${formatStat(row.stddev)}</text>`,
    );
    parts.push(
      `<text x="${PADDING + 20}" y="${listY + 17}" font-family="${MONO}" font-size="12" fill="${palette.muted}">${escapeXml(truncate(row.notation, NOTATION_CHARS))}</text>`,
    );
    parts.push(
      `<text x="${CARD_WIDTH - PADDING}" y="${listY + 17}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${palette.muted}">${row.min} to ${row.max}</text>`,
    );
    listY += LIST_LINE;
  }

  return {
    parts,
    hidden,
    height:
      (heading !== null ? PANEL_HEADING : 0) +
      PLOT_HEIGHT +
      AXIS_FOOT +
      LIST_GAP +
      rows.length * LIST_LINE,
  };
}

function unfitNote(count: number): string {
  return count === 1
    ? '1 roll does not fit these bars'
    : `${count} rolls do not fit these bars`;
}

export function buildShareSvg(options: ShareImageOptions): ShareImage {
  const { rows, theme } = options;
  const target = options.target ?? NO_TARGET;
  const poolTarget = options.poolTarget ?? NO_TARGET;
  const view = effectiveChartView(options.totalsView, target.values.length > 0);
  const poolView = effectiveChartView(
    options.successesView,
    poolTarget.values.length > 0,
  );
  const palette = shareCardPalette(theme);
  const scale = scaleFor(options.scale);
  const title = (options.title ?? '').trim();

  const usable = rows.filter((r) => r.dist.size > 0);
  const poolUsable = (options.poolRows ?? []).filter((r) => r.dist.size > 0);
  // Headings only earn their space once a Successes panel exists, the same rule
  // the chart uses on screen: an all-sum card keeps the unlabeled single-chart
  // look, and a pool-only card gets the heading that carries its unit.
  const showHeadings = poolUsable.length > 0;

  const specs: Omit<PanelSpec, 'originY'>[] = [];
  // The empty totals panel still draws when there is nothing else at all, so a
  // table with no drawable rows says so instead of rendering a bare footer.
  if (usable.length > 0 || !showHeadings) {
    specs.push({
      rows: usable,
      view,
      target,
      palette,
      heading: showHeadings ? 'Totals' : null,
      pool: false,
    });
  }
  if (showHeadings) {
    specs.push({
      rows: poolUsable,
      view: poolView,
      target: poolTarget,
      palette,
      heading: 'Successes',
      pool: true,
    });
  }

  let cursor = PADDING + headerHeight(title);
  const body: string[] = [];
  let hidden = 0;
  for (const spec of specs) {
    const drawing = drawPanel({ ...spec, originY: cursor });
    body.push(...drawing.parts);
    cursor += drawing.height;
    hidden += drawing.hidden;
  }
  const height = cursor + FOOTER_HEIGHT + PADDING;

  const notes = [(options.note ?? '').trim()];
  if (hidden > 0) notes.push(unfitNote(hidden));

  return renderCard({
    palette,
    height,
    scale,
    title,
    note: notes.filter((n) => n.length > 0).join('. '),
    body,
  });
}
