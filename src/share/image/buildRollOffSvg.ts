import type { RollOffSort } from '../../types';
import { shareCardPalette } from '../../components/chart/palette';
import { formatPercent } from '../../components/chart/format';
import { TIE_FLOOR, rollOffHeadline } from '../../components/compare/compareRows';
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

export interface RollOffCardRow {
  id: string;
  name: string;
  notation: string;
  color: string;
  /** Chance of producing the single highest result. */
  win: number;
  /** Chance of tying for best without winning outright. */
  tie: number;
}

export interface RollOffCardOptions {
  rows: RollOffCardRow[];
  /** The view's own sort chip, so the picture keeps the order on screen. */
  order: RollOffSort;
  theme: 'light' | 'dark';
  title?: string;
  note?: string;
  scale?: number;
  /** True when the table mixes totals with success counts. */
  mixedScales?: boolean;
}

const HEADLINE = 24;
const TRACK = 52;
const NAME_CHARS = 26;
const NOTATION_CHARS = 34;
// The headline is the one line that interpolates two names, so each gets its
// own budget: at 13px sans the card holds roughly 125 characters, and two
// 24-character names plus the longest fixed phrasing lands well inside that.
const HEADLINE_NAME_CHARS = 24;
const BAR_LEFT = 300;
const BAR_RIGHT = 760;
const BAR_HEIGHT = 16;

// Each track is 52px tall, so an uncapped table would letterbox into a canvas
// past what a phone browser will rasterize and hand back nothing at all. The
// cut is disclosed in the footer rather than happening silently.
const ROW_CAP = 24;

// "Top", not "first": the cut is by win chance, whichever order is on screen.
function capNote(shown: number, total: number): string {
  return `showing the top ${shown} of ${total} rolls`;
}

function headline(rows: RollOffCardRow[]): string {
  const top = rows[0];
  const second = rows[1];
  if (top === undefined || second === undefined) return '';
  return rollOffHeadline(
    { name: truncate(top.name, HEADLINE_NAME_CHARS), win: top.win },
    { name: truncate(second.name, HEADLINE_NAME_CHARS), win: second.win },
  );
}

export function buildRollOffSvg(options: RollOffCardOptions): ShareImage {
  const palette = shareCardPalette(options.theme);
  const scale = scaleFor(options.scale);
  const title = (options.title ?? '').trim();

  // The winner, the headline and the bar scale always come from the win
  // ranking, the way the view reads them off byWin whatever the sort chip says.
  // Only the drawing order follows the chip.
  const byWin = [...options.rows].sort((a, b) => b.win - a.win);
  // Rank first, then cut, the way the target card does: capping in table order
  // would be free to drop the winner the headline is about to name.
  const kept = byWin.slice(0, ROW_CAP);
  const keptIds = new Set(kept.map((r) => r.id));
  const rows =
    options.order === 'table'
      ? options.rows.filter((r) => keptIds.has(r.id))
      : kept;
  const maxWin = Math.max(byWin[0]?.win ?? 0, 1e-9);

  const height =
    PADDING * 2 +
    headerHeight(title) +
    PANEL_HEADING +
    HEADLINE +
    Math.max(1, rows.length) * TRACK +
    FOOTER_HEIGHT;

  const body: string[] = [];
  let y = PADDING + headerHeight(title);
  body.push(panelHeading('Chance to win the roll-off', y, palette));
  y += PANEL_HEADING;

  if (rows.length < 2) {
    body.push(
      `<text x="${PADDING}" y="${y + 24}" font-family="${SANS}" font-size="13" fill="${palette.muted}">Add at least two rolls with valid dice to start the roll-off.</text>`,
    );
  } else {
    body.push(
      `<text x="${PADDING}" y="${y + 14}" font-family="${SANS}" font-size="13" fill="${palette.text}">${escapeXml(headline(byWin))}</text>`,
    );
    y += HEADLINE;

    const winnerId = byWin[0]?.id;
    for (const row of rows) {
      const nameY = y + 22;
      body.push(rowSwatch(PADDING, nameY, row.color));
      body.push(
        `<text x="${PADDING + 20}" y="${nameY}" font-family="${SANS}" font-size="13" font-weight="${row.id === winnerId ? 600 : 400}" fill="${palette.text}">${escapeXml(truncate(row.name, NAME_CHARS))}</text>`,
      );
      body.push(
        `<text x="${PADDING + 20}" y="${nameY + 16}" font-family="${MONO}" font-size="11" fill="${palette.muted}">${escapeXml(truncate(row.notation, NOTATION_CHARS))}</text>`,
      );

      const trackY = y + 12;
      body.push(
        `<rect x="${BAR_LEFT}" y="${trackY}" width="${BAR_RIGHT - BAR_LEFT}" height="${BAR_HEIGHT}" rx="${BAR_HEIGHT / 2}" fill="${palette.grid}"/>`,
      );
      // A tiny but real chance keeps a visible sliver; an exact zero draws an
      // empty track so it never suggests a chance that does not exist.
      if (row.win > 0) {
        const width = Math.max(
          2,
          (row.win / maxWin) * (BAR_RIGHT - BAR_LEFT),
        );
        body.push(
          `<rect x="${BAR_LEFT}" y="${trackY}" width="${round(width)}" height="${BAR_HEIGHT}" rx="${BAR_HEIGHT / 2}" fill="${row.color}"/>`,
        );
      }

      body.push(
        `<text x="${CARD_WIDTH - PADDING}" y="${trackY + 13}" text-anchor="end" font-family="${MONO}" font-size="15" font-weight="600" fill="${palette.text}">${formatPercent(row.win)}</text>`,
      );
      if (row.tie >= TIE_FLOOR) {
        body.push(
          `<text x="${CARD_WIDTH - PADDING}" y="${trackY + 29}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${palette.muted}">ties ${formatPercent(row.tie)}</text>`,
        );
      }
      y += TRACK;
    }
  }

  const notes = [(options.note ?? '').trim()];
  if (rows.length < options.rows.length) {
    notes.push(capNote(rows.length, options.rows.length));
  }
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
