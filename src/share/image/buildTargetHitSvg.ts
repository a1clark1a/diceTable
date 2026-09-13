import type {
  GridSort,
  TargetKindFilter,
  TargetState,
  TargetSubView,
} from '../../types';
import { hitSeries } from '../../engine/stats';
import {
  columnKey,
  rowHitChance,
  targetColumns,
  type TargetColumn,
  type TargetRow,
} from '../../components/target/targetHitRows';
import {
  seriesDash,
  shareCardPalette,
  shareHitColor,
  shareHitWeight,
  type ShareCardPalette,
} from '../../components/chart/palette';
import { formatPercent } from '../../components/chart/format';
import { RULING_SYMBOL, rulingPlainLabel } from '../../components/targetRulingMeta';
import {
  AXIS_GUTTER,
  CARD_WIDTH,
  FOOTER_HEIGHT,
  MONO,
  PADDING,
  PANEL_HEADING,
  SANS,
  escapeXml,
  formatCardPercent,
  headerHeight,
  panelHeading,
  renderCard,
  round,
  rowSwatch,
  scaleFor,
  truncate,
  type ShareImage,
} from './svgPrimitives';

/**
 * One measurable roll: the view's own row, so toTargetRows(expressions) passes
 * straight in with no mapping and the two cannot drift apart.
 */
export type TargetHitCardRow = TargetRow;

export interface TargetHitCardOptions {
  /**
   * In table order, already filtered to rolls the Target hit view can measure.
   * The caller drops unusable and too-complex rolls and counts them in `note`.
   */
  rows: TargetHitCardRow[];
  /** The numeric targets and the shared ruling sum rolls answer to. */
  target: TargetState;
  /** The success counts pool rolls answer to. Always read as "or more". */
  poolTargets: number[];
  /** Which shape the view is drawing, so the picture draws the same one. */
  subView: TargetSubView;
  /** The view's kind filter. Only bites when the table holds both kinds. */
  filter: TargetKindFilter;
  /** The grid's column sort, or null for table order. Grid layout only. */
  sort: GridSort | null;
  theme: 'light' | 'dark';
  /** Optional heading. A blank title leaves the header band out entirely. */
  title?: string;
  /** Optional footer aside, for saying what the picture leaves out. */
  note?: string;
  scale?: number;
}

const GUTTER_W = 208;
const GRID_W = 656;
// Past this the card would letterbox into an unreadable strip in a chat client.
// The cut is disclosed twice, on the board it happened to and in the footer.
const ROW_CAP = 24;

const LEGEND_H = 24;
const BOARD_GAP = 18;
const EMPTY_H = 30;
const STUB_H = 24;
const BOARD_HEAD_H = 32;
const COL_HEAD_H = 26;
const ROW_H = 34;
const BOARD_FOOT_H = 12;
const OVERFLOW_H = 20;

// A roll repeats in every panel of its own kind, so the bars layout grows with
// rolls times targets. This budget is what keeps ten targets from producing a
// six-thousand-pixel card.
const BAR_ROW_BUDGET = 48;
const BAR_HEAD_H = 26;
const BAR_ROW_H = 26;
const BAR_FOOT_H = 10;
const BAR_TRACK_LEFT = 268;
const BAR_TRACK_RIGHT = 792;

const PLOT_HEIGHT = 280;
const AXIS_FOOT = 26;
const CURVE_LEGEND_CAP = 12;
const CURVE_LEGEND_PER_LINE = 3;
const CURVE_LEGEND_LINE = 20;

const NAME_CHARS = 22;
const WASH_OPACITY = 0.14;
// ~px a glyph of 11px semibold sans, and of 11px sans in the legend.
const HEAD_CHAR_W = 6.6;
const LEGEND_CHAR_W = 6.4;

const GRID_LEFT = PADDING + GUTTER_W;

const NO_ROLLS =
  'Add a roll with valid dice to see hit chances against your targets.';
// The view says "Add a target above"; a shared picture has no toolbar above it.
const NO_TARGETS = 'Add a target to see how likely each roll is to hit it.';
const NO_SUM_ROWS =
  'Curves compare rolls that add into a total. Switch a roll to Sum to see it here.';

const LEGEND: readonly { label: string; key: 'hitGood' | 'hitMid' | 'hitBad' }[] = [
  { label: 'Reliable: 66% or better', key: 'hitGood' },
  { label: 'In between: 33 to 66%', key: 'hitMid' },
  { label: 'Long shot: under 33%', key: 'hitBad' },
];

interface Board {
  heading: string;
  pool: boolean;
  rows: TargetHitCardRow[];
  values: number[];
  /** Rolls of this board's kind that ROW_CAP cut. */
  dropped: number;
}

function plainColumnLabel(
  column: TargetColumn,
  ruling: TargetState['ruling'],
): string {
  return column.pool
    ? `${column.value}+ successes`
    : rulingPlainLabel(ruling, column.value);
}

// The view's own cell rule, clamped: a bar width and a fill opacity both need a
// chance inside [0,1], and floating-point residue can land a hair outside it.
function chanceOf(
  row: TargetHitCardRow,
  column: TargetColumn,
  ruling: TargetState['ruling'],
): number {
  return Math.min(1, Math.max(0, rowHitChance(row, column, ruling)));
}

function overflowNote(count: number): string {
  return `+${count} more not shown`;
}

function stubNote(count: number, pool: boolean): string {
  const kind = pool ? 'pool' : 'sum';
  const what = pool ? 'a success target' : 'a number target';
  return count === 1
    ? `1 ${kind} roll is not shown. Add ${what} to measure it.`
    : `${count} ${kind} rolls are not shown. Add ${what} to measure them.`;
}

// "Top" once a sort is active, because the cut follows the ranking rather
// than the table; without one the rows really are the first N on screen.
function capNote(shown: number, total: number, ranked: boolean): string {
  return `showing the ${ranked ? 'top' : 'first'} ${shown} of ${total} rolls`;
}

function legendStrip(y: number, palette: ShareCardPalette): string[] {
  const parts: string[] = [];
  let x = PADDING;
  for (const item of LEGEND) {
    parts.push(
      `<rect x="${round(x)}" y="${y + 4}" width="10" height="10" rx="2" fill="${palette[item.key]}"/>`,
    );
    parts.push(
      `<text x="${round(x + 16)}" y="${y + 13}" font-family="${SANS}" font-size="11" fill="${palette.muted}">${escapeXml(item.label)}</text>`,
    );
    x += 16 + item.label.length * LEGEND_CHAR_W + 20;
  }
  return parts;
}

// ---------------------------------------------------------------- grid layout

function boardHeight(board: Board): number {
  return (
    BOARD_HEAD_H +
    COL_HEAD_H +
    board.rows.length * ROW_H +
    (board.dropped > 0 ? OVERFLOW_H : 0) +
    BOARD_FOOT_H
  );
}

function gridColumnLabel(
  column: TargetColumn,
  ruling: TargetState['ruling'],
  maxChars: number,
): string {
  const plain = plainColumnLabel(column, ruling);
  if (plain.length <= maxChars) return plain;
  // Words beat a truncated number: cutting "1000 or less" would misstate the
  // target. Only a nine-digit target gets this far.
  const symbolic = column.pool
    ? `${column.value}+`
    : `${RULING_SYMBOL[ruling]}${column.value}`;
  return truncate(symbolic, maxChars);
}

function drawBoard(
  board: Board,
  originY: number,
  cellWidth: number,
  ruling: TargetState['ruling'],
  palette: ShareCardPalette,
): string[] {
  const parts: string[] = [];
  const width = GUTTER_W + board.values.length * cellWidth;
  const height = boardHeight(board);
  const accent = board.pool ? palette.poolAccent : palette.muted;
  const cellX = (index: number): number => GRID_LEFT + index * cellWidth;
  const columns: TargetColumn[] = board.values.map((value) => ({
    value,
    pool: board.pool,
  }));

  parts.push(
    `<rect x="${PADDING}" y="${originY}" width="${round(width)}" height="${height}" rx="8" fill="${palette.panel}" stroke="${palette.border}" stroke-width="1"/>`,
  );
  if (board.pool) {
    // The card's stand-in for the purple left rule the view puts on its pool
    // bar panels, said louder because here it marks a whole separate board.
    parts.push(
      `<rect x="${PADDING}" y="${originY + 1}" width="3" height="${height - 2}" rx="1.5" fill="${palette.poolAccent}"/>`,
    );
  }

  parts.push(
    `<text x="${PADDING + 16}" y="${originY + 22}" font-family="${SANS}" font-size="11" font-weight="600" letter-spacing="0.6" fill="${accent}">${escapeXml(board.heading.toUpperCase())}</text>`,
  );

  const headChars = Math.max(4, Math.floor((cellWidth - 20) / HEAD_CHAR_W));
  columns.forEach((column, ci) => {
    parts.push(
      `<text x="${round(cellX(ci) + cellWidth - 10)}" y="${originY + 48}" text-anchor="end" font-family="${SANS}" font-size="11" font-weight="600" fill="${board.pool ? palette.poolAccent : palette.text}">${escapeXml(gridColumnLabel(column, ruling, headChars))}</text>`,
    );
  });
  parts.push(
    `<line x1="${PADDING + 16}" y1="${originY + 56}" x2="${round(PADDING + width - 12)}" y2="${originY + 56}" stroke="${palette.border}" stroke-width="1"/>`,
  );

  const gridTop = originY + BOARD_HEAD_H + COL_HEAD_H;

  // The wash is the only mark big enough to survive a chat client's downscale,
  // so it carries the reliability read at paste size and is laid first.
  board.rows.forEach((row, ri) => {
    const top = gridTop + ri * ROW_H;
    columns.forEach((column, ci) => {
      const tone = shareHitColor(chanceOf(row, column, ruling), palette);
      parts.push(
        `<rect x="${round(cellX(ci) + 3)}" y="${top + 3}" width="${round(cellWidth - 6)}" height="28" rx="3" fill="${tone}" fill-opacity="${WASH_OPACITY}"/>`,
      );
    });
  });

  // Drawn over the washes so they read as continuous. The first is the name
  // gutter's divider, matching the view's sticky-name border.
  const gridBottom = gridTop + board.rows.length * ROW_H;
  columns.forEach((_, ci) => {
    parts.push(
      `<line x1="${round(cellX(ci))}" y1="${originY + 56}" x2="${round(cellX(ci))}" y2="${gridBottom}" stroke="${palette.border}" stroke-width="1"/>`,
    );
  });

  board.rows.forEach((row, ri) => {
    const top = gridTop + ri * ROW_H;
    parts.push(rowSwatch(PADDING + 16, top + 21, row.color));
    parts.push(
      `<text x="${PADDING + 34}" y="${top + 21}" font-family="${SANS}" font-size="12" fill="${palette.text}">${escapeXml(truncate(row.name, NAME_CHARS))}</text>`,
    );
    columns.forEach((column, ci) => {
      const p = chanceOf(row, column, ruling);
      const tone = shareHitColor(p, palette);
      const trackX = cellX(ci) + 10;
      const trackW = cellWidth - 20;
      parts.push(
        `<rect x="${round(trackX)}" y="${top + 21}" width="${round(trackW)}" height="8" rx="4" fill="${palette.grid}"/>`,
      );
      if (p > 0) {
        parts.push(
          `<rect x="${round(trackX)}" y="${top + 21}" width="${round(Math.max(3, p * trackW))}" height="8" rx="4" fill="${tone}"/>`,
        );
      }
      parts.push(
        `<text x="${round(cellX(ci) + cellWidth - 10)}" y="${top + 17}" text-anchor="end" font-family="${MONO}" font-size="13" font-weight="${shareHitWeight(p)}" fill="${tone}">${formatPercent(p)}</text>`,
      );
    });
  });

  if (board.dropped > 0) {
    parts.push(
      `<text x="${PADDING + 34}" y="${gridBottom + 14}" font-family="${SANS}" font-size="11" fill="${palette.muted}">${escapeXml(overflowNote(board.dropped))}</text>`,
    );
  }

  return parts;
}

// ---------------------------------------------------------------- bars layout

interface BarSection {
  column: TargetColumn;
  rows: { row: TargetHitCardRow; p: number }[];
  dropped: number;
}

function barSectionHeight(section: BarSection): number {
  return (
    BAR_HEAD_H +
    section.rows.length * BAR_ROW_H +
    (section.dropped > 0 ? OVERFLOW_H : 0) +
    BAR_FOOT_H
  );
}

function drawBarSection(
  section: BarSection,
  originY: number,
  ruling: TargetState['ruling'],
  palette: ShareCardPalette,
): string[] {
  const parts: string[] = [];
  const height = barSectionHeight(section);
  const pool = section.column.pool;
  const width = CARD_WIDTH - PADDING * 2;

  parts.push(
    `<rect x="${PADDING}" y="${originY}" width="${width}" height="${height}" rx="8" fill="${palette.panel}" stroke="${palette.border}" stroke-width="1"/>`,
  );
  if (pool) {
    parts.push(
      `<rect x="${PADDING}" y="${originY + 1}" width="3" height="${height - 2}" rx="1.5" fill="${palette.poolAccent}"/>`,
    );
  }

  const heading = pool
    ? `Pool target: ${section.column.value}+ successes`
    : `Target: ${plainColumnLabel(section.column, ruling)}`;
  parts.push(
    `<text x="${PADDING + 16}" y="${originY + 18}" font-family="${SANS}" font-size="11" font-weight="600" letter-spacing="0.6" fill="${pool ? palette.poolAccent : palette.muted}">${escapeXml(heading.toUpperCase())}</text>`,
  );

  section.rows.forEach(({ row, p }, ri) => {
    const baseline = originY + BAR_HEAD_H + ri * BAR_ROW_H + 16;
    const tone = shareHitColor(p, palette);
    parts.push(rowSwatch(PADDING + 16, baseline, row.color));
    parts.push(
      `<text x="${PADDING + 34}" y="${baseline}" font-family="${SANS}" font-size="12" fill="${palette.text}">${escapeXml(truncate(row.name, NAME_CHARS))}</text>`,
    );
    parts.push(
      `<rect x="${BAR_TRACK_LEFT}" y="${baseline - 9}" width="${BAR_TRACK_RIGHT - BAR_TRACK_LEFT}" height="10" rx="5" fill="${palette.grid}"/>`,
    );
    if (p > 0) {
      parts.push(
        `<rect x="${BAR_TRACK_LEFT}" y="${baseline - 9}" width="${round(Math.max(3, p * (BAR_TRACK_RIGHT - BAR_TRACK_LEFT)))}" height="10" rx="5" fill="${tone}"/>`,
      );
    }
    parts.push(
      `<text x="${CARD_WIDTH - PADDING - 12}" y="${baseline}" text-anchor="end" font-family="${MONO}" font-size="13" font-weight="${shareHitWeight(p)}" fill="${tone}">${formatPercent(p)}</text>`,
    );
  });

  if (section.dropped > 0) {
    parts.push(
      `<text x="${PADDING + 34}" y="${originY + BAR_HEAD_H + section.rows.length * BAR_ROW_H + 14}" font-family="${SANS}" font-size="11" fill="${palette.muted}">${escapeXml(overflowNote(section.dropped))}</text>`,
    );
  }

  return parts;
}

// -------------------------------------------------------------- curves layout

interface CurvesPlan {
  rows: TargetHitCardRow[];
  lo: number;
  hi: number;
}

function planCurves(
  rows: TargetHitCardRow[],
  target: TargetState,
): CurvesPlan | null {
  const sumRows = rows.filter((r) => !r.isPool);
  if (sumRows.length === 0) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of sumRows) {
    if (row.min < lo) lo = row.min;
    if (row.max > hi) hi = row.max;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  for (const value of target.values) {
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  }
  return { rows: sumRows, lo, hi };
}

function curvesHeight(plan: CurvesPlan): number {
  const shown = Math.min(plan.rows.length, CURVE_LEGEND_CAP);
  const entries = shown + (plan.rows.length > CURVE_LEGEND_CAP ? 1 : 0);
  const lines = Math.max(1, Math.ceil(entries / CURVE_LEGEND_PER_LINE));
  return PLOT_HEIGHT + AXIS_FOOT + 12 + lines * CURVE_LEGEND_LINE;
}

function drawCurves(
  plan: CurvesPlan,
  originY: number,
  target: TargetState,
  palette: ShareCardPalette,
): string[] {
  const parts: string[] = [];
  const plotLeft = PADDING + AXIS_GUTTER;
  const plotRight = CARD_WIDTH - PADDING;
  // Headroom for the target chips, which sit above the plot rather than on the
  // axis baseline where they would print over the lo/hi labels.
  const plotTop = originY + 24;
  const plotBottom = originY + PLOT_HEIGHT;
  const span = Math.max(1, plan.hi - plan.lo);
  const x = (v: number): number =>
    plotLeft + ((v - plan.lo) / span) * (plotRight - plotLeft);
  // The 100% line sits a little below the plot top, so a curve at certainty
  // reads as a line rather than as the plot's own edge.
  const yTop = plotTop + 8;
  const y = (p: number): number => plotBottom - p * (plotBottom - yTop);

  for (const tick of [0, 0.25, 0.5, 0.75, 1]) {
    const gridY = round(y(tick));
    parts.push(
      `<line x1="${plotLeft}" y1="${gridY}" x2="${plotRight}" y2="${gridY}" stroke="${palette.grid}" stroke-width="1"/>`,
    );
    parts.push(
      `<text x="${plotLeft - 8}" y="${gridY + 4}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${palette.muted}">${formatCardPercent(tick)}</text>`,
    );
  }

  // Outside a row's own range the curve is flat, so a far-away target widens
  // the axis with two extra points instead of thousands of samples.
  const leftVal = target.ruling === 'gte' || target.ruling === 'gt' ? 1 : 0;
  const rightVal = target.ruling === 'lte' || target.ruling === 'lt' ? 1 : 0;
  plan.rows.forEach((row) => {
    const points: string[] = [];
    const push = (v: number, p: number): void => {
      points.push(`${round(x(v))},${round(y(p))}`);
    };
    if (plan.lo < row.min) {
      push(plan.lo, leftVal);
      if (row.min - 1 > plan.lo) push(row.min - 1, leftVal);
    }
    hitSeries(row.dist, row.min, row.max, target.ruling).forEach((p, i) =>
      push(row.min + i, p),
    );
    if (plan.hi > row.max) {
      if (row.max + 1 < plan.hi) push(row.max + 1, rightVal);
      push(plan.hi, rightVal);
    }
    // Dashed by index the way the comparison card is: a static picture has no
    // hover to separate two lines that run together.
    parts.push(
      `<polyline points="${points.join(' ')}" fill="none" stroke="${row.color}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="${seriesDash(row.slot)}"/>`,
    );
  });

  for (const value of target.values) {
    const markerX = round(x(value));
    parts.push(
      `<line x1="${markerX}" y1="${plotTop}" x2="${markerX}" y2="${plotBottom}" stroke="${palette.muted}" stroke-width="1" stroke-dasharray="4 3"/>`,
    );
    // A target sitting on either end of the range would hang its label over the
    // plot edge, so the anchor flips there instead.
    const anchor =
      markerX <= plotLeft + 12
        ? 'start'
        : markerX >= plotRight - 12
          ? 'end'
          : 'middle';
    parts.push(
      `<text x="${markerX}" y="${plotTop - 7}" text-anchor="${anchor}" font-family="${MONO}" font-size="11" font-weight="600" fill="${palette.text}">${value}</text>`,
    );
  }

  parts.push(
    `<text x="${plotLeft}" y="${plotBottom + 18}" font-family="${MONO}" font-size="11" fill="${palette.muted}">${plan.lo}</text>`,
  );
  parts.push(
    `<text x="${plotRight}" y="${plotBottom + 18}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${palette.muted}">${plan.hi}</text>`,
  );

  const shown = plan.rows.slice(0, CURVE_LEGEND_CAP);
  const entries: { name: string; color: string | null }[] = shown.map((r) => ({
    name: r.name,
    color: r.color,
  }));
  if (plan.rows.length > CURVE_LEGEND_CAP) {
    entries.push({
      name: `+${plan.rows.length - CURVE_LEGEND_CAP} more`,
      color: null,
    });
  }
  const columnWidth = (CARD_WIDTH - PADDING * 2) / CURVE_LEGEND_PER_LINE;
  entries.forEach((entry, i) => {
    const line = Math.floor(i / CURVE_LEGEND_PER_LINE);
    const slot = i % CURVE_LEGEND_PER_LINE;
    const ex = PADDING + slot * columnWidth;
    const ey = plotBottom + AXIS_FOOT + 12 + line * CURVE_LEGEND_LINE;
    if (entry.color !== null) {
      parts.push(rowSwatch(ex, ey, entry.color));
    }
    parts.push(
      `<text x="${round(ex + 18)}" y="${ey}" font-family="${SANS}" font-size="11" fill="${entry.color === null ? palette.muted : palette.text}">${escapeXml(truncate(entry.name, 30))}</text>`,
    );
  });

  return parts;
}

// -------------------------------------------------------------------- builder

/** What the card would draw instead of a picture, or null when it has one. */
export type TargetHitCardBlock = 'noRows' | 'noTargets' | 'noSumRows';

/** Everything the block rule reads. The drawing options are a superset. */
export type TargetHitCardInput = Pick<
  TargetHitCardOptions,
  'rows' | 'target' | 'poolTargets' | 'subView' | 'filter'
>;

interface Selection {
  filtered: TargetHitCardRow[];
  columns: TargetColumn[];
}

function select(options: TargetHitCardInput): Selection {
  const anyPool = options.rows.some((r) => r.isPool);
  const anySum = options.rows.some((r) => !r.isPool);
  // The filter chips only appear when the table holds both kinds, so a stale
  // choice cannot empty a single-kind table. Same rule the view applies.
  const filter = anyPool && anySum ? options.filter : 'all';
  const filtered =
    filter === 'all'
      ? options.rows
      : options.rows.filter((r) => (filter === 'pool') === r.isPool);

  // Columns follow the filtered rows, so hiding one kind takes its axis with
  // it rather than leaving a run of columns nothing can answer.
  return {
    filtered,
    columns: targetColumns(
      options.target,
      options.poolTargets,
      filtered.some((r) => r.isPool),
      filtered.some((r) => !r.isPool),
    ),
  };
}

function blockFor(
  rowCount: number,
  subView: TargetSubView,
  curvesPlan: CurvesPlan | null,
  columnCount: number,
): TargetHitCardBlock | null {
  // Rolls first, targets second: a table with nothing measurable needs to hear
  // about its rolls, the precedence the view documents.
  if (rowCount === 0) return 'noRows';
  if (subView === 'curves') return curvesPlan === null ? 'noSumRows' : null;
  return columnCount === 0 ? 'noTargets' : null;
}

/**
 * Whether the card would be nothing but an empty-state sentence. The share
 * actions ask before they offer a picture, so the navbar never hands over a
 * PNG of a line telling the reader to go add something.
 */
export function targetHitCardBlock(
  options: TargetHitCardInput,
): TargetHitCardBlock | null {
  const curvesPlan =
    options.subView === 'curves'
      ? planCurves(options.rows, options.target)
      : null;
  return blockFor(
    options.rows.length,
    options.subView,
    curvesPlan,
    select(options).columns.length,
  );
}

const BLOCK_MESSAGE: Record<TargetHitCardBlock, string> = {
  noRows: NO_ROLLS,
  noTargets: NO_TARGETS,
  noSumRows: NO_SUM_ROWS,
};

export function buildTargetHitSvg(options: TargetHitCardOptions): ShareImage {
  const palette = shareCardPalette(options.theme);
  const scale = scaleFor(options.scale);
  const title = (options.title ?? '').trim();
  const ruling = options.target.ruling;

  const { filtered, columns } = select(options);

  const body: string[] = [];
  let y = PADDING + headerHeight(title);
  body.push(panelHeading('Chance of hitting each target', y, palette));
  y += PANEL_HEADING;

  const notes = [(options.note ?? '').trim()];
  let contentHeight = EMPTY_H;
  let contentParts: string[];

  const curvesPlan =
    options.subView === 'curves'
      ? // Curves always plot totals, whatever the kind filter says, exactly as
        // the view passes its unfiltered sum rows in.
        planCurves(options.rows, options.target)
      : null;
  const block = blockFor(
    options.rows.length,
    options.subView,
    curvesPlan,
    columns.length,
  );

  if (block !== null) {
    contentParts = [emptyLine(BLOCK_MESSAGE[block], y, palette)];
  } else if (curvesPlan !== null) {
    contentHeight = curvesHeight(curvesPlan);
    contentParts = drawCurves(curvesPlan, y, options.target, palette);
  } else if (options.subView === 'bars') {
    const sections = planBarSections(filtered, columns, ruling, notes);
    contentHeight =
      LEGEND_H +
      sections.reduce((sum, s) => sum + barSectionHeight(s), 0) +
      BOARD_GAP * Math.max(0, sections.length - 1);
    contentParts = legendStrip(y, palette);
    let cursor = y + LEGEND_H;
    for (const section of sections) {
      contentParts.push(...drawBarSection(section, cursor, ruling, palette));
      cursor += barSectionHeight(section) + BOARD_GAP;
    }
  } else {
    const plan = planGrid(filtered, options, columns, ruling, notes);
    // The reliability legend keys the cell washes, so it earns its space only
    // when there are cells. With no board admitted the card is just the stub.
    const hasBoards = plan.boards.length > 0;
    contentHeight =
      (hasBoards ? LEGEND_H : 0) +
      plan.boards.reduce((sum, b) => sum + boardHeight(b), 0) +
      BOARD_GAP * Math.max(0, plan.boards.length - 1) +
      (plan.stub.length > 0 ? STUB_H : 0);
    contentParts = hasBoards ? legendStrip(y, palette) : [];
    let cursor = y + (hasBoards ? LEGEND_H : 0);
    for (const board of plan.boards) {
      contentParts.push(...drawBoard(board, cursor, plan.cellWidth, ruling, palette));
      cursor += boardHeight(board) + BOARD_GAP;
    }
    if (plan.stub.length > 0) {
      // Only unwind a gap that was actually added, or the stub climbs into
      // whatever sits above it.
      if (hasBoards) cursor -= BOARD_GAP;
      contentParts.push(
        `<text x="${PADDING}" y="${cursor + 16}" font-family="${SANS}" font-size="12" fill="${palette.muted}">${escapeXml(plan.stub)}</text>`,
      );
    }
  }

  body.push(...contentParts);

  const height =
    PADDING * 2 + headerHeight(title) + PANEL_HEADING + contentHeight + FOOTER_HEIGHT;

  return renderCard({
    palette,
    height,
    scale,
    title,
    note: notes.filter((n) => n.length > 0).join('. '),
    body,
  });
}

function emptyLine(
  message: string,
  y: number,
  palette: ShareCardPalette,
): string {
  return `<text x="${PADDING}" y="${y + 20}" font-family="${SANS}" font-size="13" fill="${palette.muted}">${escapeXml(message)}</text>`;
}

function planBarSections(
  rows: TargetHitCardRow[],
  columns: TargetColumn[],
  ruling: TargetState['ruling'],
  notes: string[],
): BarSection[] {
  // Every roll repeats per panel of its kind, so the budget is shared out
  // across the panels rather than applied to each one.
  const perSection = Math.max(3, Math.floor(BAR_ROW_BUDGET / columns.length));
  let cut = 0;
  const sections = columns.map((column) => {
    const scored = rows
      .filter((row) => row.isPool === column.pool)
      .map((row) => ({ row, p: chanceOf(row, column, ruling) }));
    scored.sort((a, b) => b.p - a.p);
    const dropped = Math.max(0, scored.length - perSection);
    if (dropped > cut) cut = dropped;
    return { column, rows: scored.slice(0, perSection), dropped };
  });
  if (cut > 0) notes.push(`each target shows its top ${perSection} rolls`);
  return sections;
}

interface GridPlan {
  boards: Board[];
  cellWidth: number;
  stub: string;
}

function planGrid(
  filtered: TargetHitCardRow[],
  options: TargetHitCardOptions,
  columns: TargetColumn[],
  ruling: TargetState['ruling'],
  notes: string[],
): GridPlan {
  const numericValues = columns.filter((c) => !c.pool).map((c) => c.value);
  const poolValues = columns.filter((c) => c.pool).map((c) => c.value);
  const sort = options.sort;

  // A sort can point at a column the current filter took away; the view drops
  // it rather than re-pointing it, and so does the card. Resolving it once also
  // tells the footer whether the rows it is about to count were ranked at all.
  const sortedColumn = (pool: boolean): TargetColumn | null => {
    if (sort === null) return null;
    const values = pool ? poolValues : numericValues;
    const value = values.find((v) => columnKey({ value: v, pool }) === sort.key);
    return value === undefined ? null : { value, pool };
  };

  const order = (rows: TargetHitCardRow[], pool: boolean): TargetHitCardRow[] => {
    const column = sortedColumn(pool);
    if (column === null || sort === null) return rows;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort(
      (a, b) => dir * (chanceOf(a, column, ruling) - chanceOf(b, column, ruling)),
    );
  };

  const allSum = filtered.filter((r) => !r.isPool);
  const allPool = filtered.filter((r) => r.isPool);

  // A kind with no target of its own gets no board, so it takes no share of the
  // cap either: budgeting for a board that is never drawn would halve the rows
  // the one real board can hold and leave the footer counting rows nothing
  // rendered. Those rolls are what the stub sentence below is for.
  const sumSlots = numericValues.length > 0 ? allSum.length : 0;
  const poolSlots = poolValues.length > 0 ? allPool.length : 0;
  const measurable = sumSlots + poolSlots;

  // Rank first, then cut. Capping in table order would drop exactly the rolls
  // an active sort put at the top. The cap is shared in proportion so one kind
  // cannot starve the other off the card.
  const share = (n: number): number => {
    if (n === 0) return 0;
    if (measurable <= ROW_CAP) return n;
    return Math.max(1, Math.floor((n / measurable) * ROW_CAP));
  };
  const sumRows = order(allSum, false).slice(0, share(sumSlots));
  const poolRows = order(allPool, true).slice(0, share(poolSlots));
  const shown = sumRows.length + poolRows.length;
  const ranked = sortedColumn(false) !== null || sortedColumn(true) !== null;
  if (shown < measurable) notes.push(capNote(shown, measurable, ranked));

  const boards: Board[] = [];
  if (sumRows.length > 0 && numericValues.length > 0) {
    boards.push({
      heading: 'Sum rolls, measured on the total',
      pool: false,
      rows: sumRows,
      values: numericValues,
      dropped: allSum.length - sumRows.length,
    });
  }
  if (poolRows.length > 0 && poolValues.length > 0) {
    boards.push({
      heading: 'Pool rolls, measured in successes',
      pool: true,
      rows: poolRows,
      values: poolValues,
      dropped: allPool.length - poolRows.length,
    });
  }
  // The sorted board leads, so a ranking the reader asked for is the first
  // thing on the card rather than the second.
  const sortedIsPool =
    sort !== null &&
    poolValues.some((value) => columnKey({ value, pool: true }) === sort.key);
  if (sortedIsPool) boards.reverse();

  // At most one can fire: both target lists empty means no column at all, and
  // the caller is in the no-targets empty state instead. Counts come from the
  // full lists, so the sentence never reports a cap-truncated number.
  const stub =
    allSum.length > 0 && numericValues.length === 0
      ? stubNote(allSum.length, false)
      : allPool.length > 0 && poolValues.length === 0
        ? stubNote(allPool.length, true)
        : '';

  // One cell width for the whole card, so a bar of a given length means the
  // same thing on either board. A board with fewer targets draws narrower.
  const maxCols = boards.reduce((n, b) => Math.max(n, b.values.length), 0);
  return { boards, cellWidth: maxCols > 0 ? GRID_W / maxCols : GRID_W, stub };
}
