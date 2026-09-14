import { MATRIX_CARD_ROW_LIMIT, type Distribution } from '../../types';
import { beatMatrix } from '../../engine/compare';
import { shareCardPalette, shareHitColor } from '../../components/chart/palette';
import { EM_DASH, formatPercent } from '../../components/chart/format';
import {
  CARD_WIDTH,
  MIXED_SCALE_CARD_NOTE,
  FOOTER_HEIGHT,
  MONO,
  PADDING,
  PANEL_HEADING,
  SANS,
  escapeXml,
  headerHeight,
  panelHeading,
  renderCard,
  round,
  rowSwatch,
  scaleFor,
  truncate,
  type ShareImage,
} from './svgPrimitives';

export interface MatrixCardRow {
  id: string;
  name: string;
  color: string;
  dist: Distribution;
}

export interface MatrixCardOptions {
  rows: MatrixCardRow[];
  theme: 'light' | 'dark';
  title?: string;
  note?: string;
  scale?: number;
  /** True when the table mixes totals with success counts. */
  mixedScales?: boolean;
}

const GUTTER = 190;
const HEAD_HEIGHT = 40;
const CELL_HEIGHT = 30;
const NAME_CHARS = 24;
// ~px per glyph of 11px sans, used to fit a column heading into its cell.
const HEAD_CHAR_WIDTH = 6.4;

// The heading already says row beats column; the footer adds only what the
// lattice cannot show, which is where the tie mass went.
const TIE_NOTE = 'Ties are not counted as wins.';
const SUBHEAD = 16;

// The view bolds a cell at 50% or better, because in a one-on-one the question
// is only "is this row ahead". That is a different question from the hit ramp's
// reliable / mixed / long-shot bands, so the emphasis break is different too.
function cellWeight(win: number): number {
  return win >= 0.5 ? 600 : 400;
}

function capNote(total: number): string {
  return `showing the first ${MATRIX_CARD_ROW_LIMIT} of ${total} rolls`;
}

export function buildMatrixSvg(options: MatrixCardOptions): ShareImage {
  const palette = shareCardPalette(options.theme);
  const scale = scaleFor(options.scale);
  const title = (options.title ?? '').trim();

  const rows = options.rows.slice(0, MATRIX_CARD_ROW_LIMIT);
  const dropped = options.rows.length - rows.length;
  const enough = rows.length >= 2;

  const height =
    PADDING * 2 +
    headerHeight(title) +
    PANEL_HEADING +
    (enough ? SUBHEAD + HEAD_HEIGHT + rows.length * CELL_HEIGHT : 30) +
    FOOTER_HEIGHT;

  const body: string[] = [];
  let y = PADDING + headerHeight(title);
  body.push(panelHeading('Head-to-head. Row beats column', y, palette));
  y += PANEL_HEADING;

  if (enough) {
    body.push(
      `<text x="${PADDING}" y="${y + 12}" font-family="${SANS}" font-size="11" fill="${palette.muted}">${escapeXml(TIE_NOTE)}</text>`,
    );
    y += SUBHEAD;
  }

  if (!enough) {
    body.push(
      `<text x="${PADDING}" y="${y + 20}" font-family="${SANS}" font-size="13" fill="${palette.muted}">Add at least two rolls with valid dice to compare head-to-head.</text>`,
    );
  } else {
    const wins = beatMatrix(rows.map((r) => r.dist));
    const gridLeft = PADDING + GUTTER;
    const cellWidth = (CARD_WIDTH - PADDING - gridLeft) / rows.length;
    const headChars = Math.max(3, Math.floor(cellWidth / HEAD_CHAR_WIDTH));

    rows.forEach((column, ci) => {
      const centerX = gridLeft + cellWidth * ci + cellWidth / 2;
      body.push(
        `<rect x="${round(centerX - 5)}" y="${y + 4}" width="10" height="10" rx="2" fill="${column.color}"/>`,
      );
      body.push(
        `<text x="${round(centerX)}" y="${y + 30}" text-anchor="middle" font-family="${SANS}" font-size="11" fill="${palette.muted}">${escapeXml(truncate(column.name, headChars))}</text>`,
      );
    });
    y += HEAD_HEIGHT;

    rows.forEach((row, ri) => {
      const rowTop = y + CELL_HEIGHT * ri;
      const baseline = rowTop + 20;
      body.push(rowSwatch(PADDING, baseline, row.color));
      body.push(
        `<text x="${PADDING + 20}" y="${baseline}" font-family="${SANS}" font-size="12" fill="${palette.text}">${escapeXml(truncate(row.name, NAME_CHARS))}</text>`,
      );

      rows.forEach((_column, ci) => {
        const centerX = gridLeft + cellWidth * ci + cellWidth / 2;
        if (ri === ci) {
          body.push(
            `<text x="${round(centerX)}" y="${baseline}" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${palette.muted}">${EM_DASH}</text>`,
          );
          return;
        }
        const win = wins[ri]?.[ci]?.win ?? 0;
        const tone = shareHitColor(win, palette);
        // A wash of the tone behind the figure, so the lattice reads as bands
        // at a glance; the weight climb carries the same signal without hue.
        body.push(
          `<rect x="${round(centerX - cellWidth / 2 + 2)}" y="${rowTop + 3}" width="${round(cellWidth - 4)}" height="${CELL_HEIGHT - 6}" rx="3" fill="${tone}" fill-opacity="0.1"/>`,
        );
        body.push(
          `<text x="${round(centerX)}" y="${baseline}" text-anchor="middle" font-family="${MONO}" font-size="12" font-weight="${cellWeight(win)}" fill="${tone}">${formatPercent(win)}</text>`,
        );
      });
    });
  }

  const notes = [(options.note ?? '').trim()];
  if (dropped > 0) notes.push(capNote(options.rows.length));
  if (options.mixedScales === true) notes.push(MIXED_SCALE_CARD_NOTE);

  return renderCard({
    palette,
    height,
    scale,
    title,
    note: notes.filter((n) => n.length > 0).join('. '),
    body,
  });
}
