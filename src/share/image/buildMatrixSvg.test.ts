import { describe, expect, it } from 'vitest';
import { buildMatrixSvg, type MatrixCardRow } from './buildMatrixSvg';
import { expressionDistribution } from '../../engine/expression';
import { uniformDistribution } from '../../engine/distribution';
import { rowColor } from '../../components/chart/palette';
import type { Distribution, Expression } from '../../types';

// Card geometry, restated here so the expected numbers below are arithmetic a
// reader can follow rather than a copy of whatever the module happens to emit.
const CARD_WIDTH = 920;
// padding*2 (56) + panel heading (22) + tie line (16) + column band (40) +
// footer (34), before any cell row is added.
const BASE_HEIGHT = 168;
const CELL_HEIGHT = 30;
// The empty state trades the tie line, the column band and the cells for a
// single 30px line: 56 + 22 + 30 + 34.
const EMPTY_HEIGHT = 142;
// The name gutter is 190 wide, so the lattice starts at 28 + 190 = 218 and the
// columns share the 920 - 28 - 218 = 674 that are left. Two columns are 337
// wide, centered at 218 + 168.5 and 218 + 337 + 168.5.
const COL_LEFT_X = 386.5;
const COL_RIGHT_X = 723.5;
// The first cell row starts at 28 (heading top) + 22 + 16 + 40 = 106, and text
// sits on a baseline 20 below the top of its row.
const FIRST_BASELINE = 126;
const SECOND_BASELINE = FIRST_BASELINE + CELL_HEIGHT;

const ELLIPSIS = '…';
// The diagonal is blanked with an em dash instead of a percentage.
const BLANK = '\u2014';

// The share card leaves the app, so it cannot carry theme tokens. These are the
// literal hexes the two palettes ship instead.
const LIGHT_GROUND = '#ffffff';
const LIGHT_TEXT = '#0f172a';
const LIGHT_MID = '#845209';
const DARK_GROUND = '#0b1220';
const DARK_TEXT = '#e2e8f0';
const DARK_MID = '#facc15';

/** One plain die as a lattice row, built through the real engine. */
function dieRow(name: string, sides: number, index: number): MatrixCardRow {
  const expr: Expression = {
    id: `${name}-${sides}`,
    name,
    parts: [{ id: `part-${name}-${sides}`, count: 1, sides }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
  return {
    id: expr.id,
    name,
    color: rowColor(index),
    dist: expressionDistribution(expr),
  };
}

function uniformRow(name: string, sides: number, index: number): MatrixCardRow {
  return { id: name, name, color: rowColor(index), dist: uniformDistribution(sides) };
}

function customRow(name: string, dist: Distribution, index: number): MatrixCardRow {
  return { id: name, name, color: rowColor(index), dist };
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

interface MatrixCell {
  x: number;
  y: number;
  weight: number | null;
  fill: string;
  text: string;
}

/** Every 12px centered figure in the lattice: the percentages and the blanks. */
function cells(svg: string): MatrixCell[] {
  const re =
    /<text x="([\d.]+)" y="([\d.]+)" text-anchor="middle" font-family="[^"]*" font-size="12"(?: font-weight="(\d+)")? fill="([^"]*)">([^<]*)<\/text>/g;
  return [...svg.matchAll(re)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    weight: m[3] === undefined ? null : Number(m[3]),
    fill: m[4] ?? '',
    text: m[5] ?? '',
  }));
}

function cellAt(svg: string, x: number, y: number): MatrixCell | undefined {
  return cells(svg).find((c) => c.x === x && c.y === y);
}

function cellsReading(svg: string, text: string): MatrixCell[] {
  return cells(svg).filter((c) => c.text === text);
}

/** The names down the left edge, in drawing order. */
function gutterNames(svg: string): string[] {
  return [...svg.matchAll(/<text x="48" y="[\d.]+"[^>]*>([^<]*)<\/text>/g)].map(
    (m) => m[1] ?? '',
  );
}

/** The names across the top, in drawing order. */
function columnHeadings(svg: string): string[] {
  const re =
    /text-anchor="middle" font-family="[^"]*" font-size="11" fill="[^"]*">([^<]*)<\/text>/g;
  return [...svg.matchAll(re)].map((m) => m[1] ?? '');
}

function twoDice(): MatrixCardRow[] {
  return [uniformRow('Sword', 6, 0), uniformRow('Axe', 6, 1)];
}

function manyDice(count: number): MatrixCardRow[] {
  return Array.from({ length: count }, (_, i) => dieRow(`Roll ${i + 1}`, 6, i));
}

describe('buildMatrixSvg lattice', () => {
  it('tints one cell for every ordered pair of different rolls', () => {
    const rows = [dieRow('Dagger', 4, 0), dieRow('Sword', 6, 1), dieRow('Maul', 12, 2)];
    const image = buildMatrixSvg({ rows, theme: 'light' });
    // Three rolls face each other six ways once the diagonal is left out.
    expect(countOf(image.svg, 'fill-opacity="0.1"')).toBe(6);
  });

  it('blanks the diagonal instead of comparing a roll with itself', () => {
    const image = buildMatrixSvg({ rows: twoDice(), theme: 'light' });
    expect(cellsReading(image.svg, BLANK)).toHaveLength(2);
    expect(cellAt(image.svg, COL_LEFT_X, FIRST_BASELINE)?.text).toBe(BLANK);
    expect(cellAt(image.svg, COL_RIGHT_X, SECOND_BASELINE)?.text).toBe(BLANK);
  });

  it('leaves the diagonal untinted', () => {
    const image = buildMatrixSvg({ rows: twoDice(), theme: 'light' });
    expect(countOf(image.svg, 'fill-opacity="0.1"')).toBe(2);
  });

  it('grows the card by one line for every roll in the lattice', () => {
    const two = buildMatrixSvg({ rows: twoDice(), theme: 'light' });
    const four = buildMatrixSvg({ rows: manyDice(4), theme: 'light' });
    expect(two.width).toBe(CARD_WIDTH);
    expect(two.height).toBe(BASE_HEIGHT + CELL_HEIGHT * 2);
    expect(four.height).toBe(BASE_HEIGHT + CELL_HEIGHT * 4);
  });
});

describe('buildMatrixSvg cell values', () => {
  it('prints how often the row beats the column, to one decimal', () => {
    const image = buildMatrixSvg({ rows: twoDice(), theme: 'light' });
    // Two d6 land on 36 equally likely pairs, 15 of which the first wins.
    expect(cellAt(image.svg, COL_RIGHT_X, FIRST_BASELINE)?.text).toBe('41.7%');
    expect(cellAt(image.svg, COL_LEFT_X, SECOND_BASELINE)?.text).toBe('41.7%');
  });

  it('reads row beats column, not the other way round', () => {
    const rows = [dieRow('Big', 20, 0), dieRow('Small', 4, 1)];
    const image = buildMatrixSvg({ rows, theme: 'light' });
    // A d20 clears a d4 outright on 16 of its faces, plus a quarter, a half and
    // three quarters on faces 2, 3 and 4: 17.5 of 20.
    expect(cellAt(image.svg, COL_RIGHT_X, FIRST_BASELINE)?.text).toBe('87.5%');
    // The d4 only wins when the d20 rolls under it: 6 of 80 pairs.
    expect(cellAt(image.svg, COL_LEFT_X, SECOND_BASELINE)?.text).toBe('7.5%');
  });

  it('counts a tie for neither side, so the mirror cell is not the complement', () => {
    const image = buildMatrixSvg({ rows: twoDice(), theme: 'light' });
    // 15 wins each way and 6 ties out of 36. Both directions read 41.7%, and
    // neither reads the 58.3% that treating a tie as a loss would give.
    expect(cellsReading(image.svg, '41.7%')).toHaveLength(2);
    expect(image.svg).not.toContain('58.3%');
  });
});

describe('buildMatrixSvg emphasis', () => {
  it('bolds a cell that sits exactly on half', () => {
    // 1 or 4 against 2 or 3 never ties, and each side wins on one of its two
    // faces, so both cells land on an exact 50%.
    const rows = [
      customRow(
        'Split',
        new Map([
          [1, 0.5],
          [4, 0.5],
        ]),
        0,
      ),
      customRow(
        'Middle',
        new Map([
          [2, 0.5],
          [3, 0.5],
        ]),
        1,
      ),
    ];
    const image = buildMatrixSvg({ rows, theme: 'light' });
    expect(cellAt(image.svg, COL_RIGHT_X, FIRST_BASELINE)?.text).toBe('50.0%');
    expect(cellAt(image.svg, COL_RIGHT_X, FIRST_BASELINE)?.weight).toBe(600);
  });

  it('leaves a cell below half at normal weight', () => {
    const image = buildMatrixSvg({ rows: twoDice(), theme: 'light' });
    expect(cellAt(image.svg, COL_RIGHT_X, FIRST_BASELINE)?.weight).toBe(400);
  });

  it('breaks the weight at half even where the color band does not change', () => {
    const rows = [dieRow('Sword', 6, 0), dieRow('Axe', 6, 1), dieRow('Dagger', 4, 2)];
    const image = buildMatrixSvg({ rows, theme: 'light' });
    // Both figures sit in the ramp's middle band, between 33% and 66%, so hue
    // says nothing about which roll is ahead and only the weight does.
    const behind = cellsReading(image.svg, '41.7%');
    const ahead = cellsReading(image.svg, '58.3%');
    expect(behind.map((c) => c.weight)).toEqual([400, 400]);
    expect(ahead.map((c) => c.weight)).toEqual([600, 600]);
    expect(behind.map((c) => c.fill)).toEqual([LIGHT_MID, LIGHT_MID]);
    expect(ahead.map((c) => c.fill)).toEqual([LIGHT_MID, LIGHT_MID]);
  });
});

describe('buildMatrixSvg row cap', () => {
  it('draws only the first twelve rolls', () => {
    const image = buildMatrixSvg({ rows: manyDice(14), theme: 'light' });
    // Twelve rolls face each other 132 ways, with twelve blanks down the middle.
    expect(countOf(image.svg, 'fill-opacity="0.1"')).toBe(132);
    expect(cellsReading(image.svg, BLANK)).toHaveLength(12);
    expect(image.height).toBe(BASE_HEIGHT + CELL_HEIGHT * 12);
  });

  it('leaves the thirteenth roll out of the lattice entirely', () => {
    const image = buildMatrixSvg({ rows: manyDice(14), theme: 'light' });
    expect(gutterNames(image.svg)).toHaveLength(12);
    expect(image.svg).not.toContain('Roll 13');
  });

  it('says how many rolls the lattice left out', () => {
    const image = buildMatrixSvg({ rows: manyDice(14), theme: 'light' });
    expect(image.svg).toContain('>showing the first 12 of 14 rolls</text>');
  });

  it('leaves the cap note out at exactly twelve rolls', () => {
    const image = buildMatrixSvg({ rows: manyDice(12), theme: 'light' });
    expect(cellsReading(image.svg, BLANK)).toHaveLength(12);
    expect(image.svg).not.toContain('showing the first');
  });
});

describe('buildMatrixSvg empty state', () => {
  it('asks for a second roll when only one is given', () => {
    const image = buildMatrixSvg({ rows: [dieRow('Sword', 6, 0)], theme: 'light' });
    expect(image.svg).toContain(
      'Add at least two rolls with valid dice to compare head-to-head.',
    );
    expect(image.svg).not.toContain('fill-opacity="0.1"');
  });

  it('asks for a second roll when the table is empty', () => {
    const image = buildMatrixSvg({ rows: [], theme: 'light' });
    expect(image.svg).toContain(
      'Add at least two rolls with valid dice to compare head-to-head.',
    );
    expect(image.height).toBe(EMPTY_HEIGHT);
  });

  it('leaves the tie convention out when there is no lattice to explain', () => {
    const image = buildMatrixSvg({ rows: [dieRow('Sword', 6, 0)], theme: 'light' });
    expect(image.svg).not.toContain('Ties are not counted as wins.');
  });
});

describe('buildMatrixSvg notes', () => {
  it('puts the tie convention directly under the heading', () => {
    const image = buildMatrixSvg({ rows: twoDice(), theme: 'light' });
    // The heading prints on y=40 and the panel band is 22 tall, so the tie line
    // lands on 62, above the first column heading at 96.
    expect(image.svg).toMatch(
      /<text x="28" y="40"[^>]*>HEAD-TO-HEAD\. ROW BEATS COLUMN<\/text>/,
    );
    expect(image.svg).toMatch(
      /<text x="28" y="62"[^>]*>Ties are not counted as wins\.<\/text>/,
    );
  });

  it('adds the scale caveat to the footer when the table mixes scales', () => {
    const image = buildMatrixSvg({ rows: twoDice(), theme: 'light', mixedScales: true });
    expect(image.svg).toContain('>Pool rows are counted in successes, not totals</text>');
  });

  it('leaves the scale caveat out when every roll is on one scale', () => {
    const image = buildMatrixSvg({ rows: twoDice(), theme: 'light', mixedScales: false });
    expect(image.svg).not.toContain('Pool rows are counted');
  });

  it('joins the scale caveat onto the cap note', () => {
    const image = buildMatrixSvg({
      rows: manyDice(14),
      theme: 'light',
      mixedScales: true,
    });
    expect(image.svg).toContain(
      '>showing the first 12 of 14 rolls. Pool rows are counted in successes, not totals</text>',
    );
  });

  it('keeps a caller note ahead of the caveats the card adds itself', () => {
    const image = buildMatrixSvg({
      rows: manyDice(14),
      theme: 'light',
      note: '2 rolls left out (too complex)',
    });
    expect(image.svg).toContain(
      '>2 rolls left out (too complex). showing the first 12 of 14 rolls</text>',
    );
  });
});

describe('buildMatrixSvg themes', () => {
  it('paints the light card and its ramp in the light hexes', () => {
    const image = buildMatrixSvg({ rows: twoDice(), theme: 'light' });
    expect(image.svg).toContain(`fill="${LIGHT_GROUND}"`);
    expect(image.svg).toContain(`fill="${LIGHT_TEXT}"`);
    expect(cellAt(image.svg, COL_RIGHT_X, FIRST_BASELINE)?.fill).toBe(LIGHT_MID);
    expect(image.svg).not.toContain(DARK_GROUND);
    expect(image.svg).not.toContain(DARK_MID);
  });

  it('paints the dark card and its ramp in the dark hexes', () => {
    const image = buildMatrixSvg({ rows: twoDice(), theme: 'dark' });
    expect(image.svg).toContain(`fill="${DARK_GROUND}"`);
    expect(image.svg).toContain(`fill="${DARK_TEXT}"`);
    expect(cellAt(image.svg, COL_RIGHT_X, FIRST_BASELINE)?.fill).toBe(DARK_MID);
    expect(image.svg).not.toContain(LIGHT_GROUND);
    expect(image.svg).not.toContain(LIGHT_MID);
  });

  it('lets no theme token reach the markup in either theme', () => {
    for (const theme of ['light', 'dark'] as const) {
      const image = buildMatrixSvg({ rows: manyDice(3), theme });
      expect(image.svg).not.toMatch(/hit\.|colorPalette/);
    }
  });

  it('keeps the row color the table gave it', () => {
    const image = buildMatrixSvg({ rows: twoDice(), theme: 'dark' });
    expect(image.svg).toContain('fill="#2563eb"');
    expect(image.svg).toContain('fill="#ea580c"');
  });
});

describe('buildMatrixSvg names', () => {
  it('cuts a long name down to an ellipsis in the row gutter', () => {
    const rows = twoDice();
    const image = buildMatrixSvg({
      rows: [{ ...rows[0]!, name: 'b'.repeat(40) }, rows[1]!],
      theme: 'light',
    });
    expect(gutterNames(image.svg)[0]).toBe(`${'b'.repeat(23)}${ELLIPSIS}`);
  });

  it('leaves a name of exactly twenty-four characters whole in the gutter', () => {
    const rows = twoDice();
    const name = 'b'.repeat(24);
    const image = buildMatrixSvg({
      rows: [{ ...rows[0]!, name }, rows[1]!],
      theme: 'light',
    });
    expect(gutterNames(image.svg)[0]).toBe(name);
  });

  it('cuts a column heading down to what its cell can hold', () => {
    const rows = manyDice(12);
    const image = buildMatrixSvg({
      rows: [{ ...rows[0]!, name: 'A'.repeat(20) }, ...rows.slice(1)],
      theme: 'light',
    });
    // Twelve columns leave 674 / 12 = 56.2px a cell, which is eight glyphs of
    // 11px sans, so seven characters and an ellipsis fit.
    expect(columnHeadings(image.svg)[0]).toBe(`${'A'.repeat(7)}${ELLIPSIS}`);
    // The gutter is far wider and keeps the same name whole.
    expect(gutterNames(image.svg)[0]).toBe('A'.repeat(20));
  });

  it('escapes a name that looks like markup in both the gutter and the heading', () => {
    const rows = twoDice();
    const image = buildMatrixSvg({
      rows: [{ ...rows[0]!, name: '<script>&"x"' }, rows[1]!],
      theme: 'light',
    });
    const escaped = '&lt;script&gt;&amp;&quot;x&quot;';
    expect(gutterNames(image.svg)[0]).toBe(escaped);
    expect(columnHeadings(image.svg)[0]).toBe(escaped);
    expect(image.svg).not.toContain('<script>');
  });

  it('escapes an apostrophe in a name', () => {
    const rows = twoDice();
    const image = buildMatrixSvg({
      rows: [{ ...rows[0]!, name: "Ork's axe" }, rows[1]!],
      theme: 'light',
    });
    expect(gutterNames(image.svg)[0]).toBe('Ork&apos;s axe');
  });
});

