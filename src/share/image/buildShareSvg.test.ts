import { describe, expect, it } from 'vitest';
import { buildShareSvg, type ShareImageRow } from './buildShareSvg';
import { expressionDistribution } from '../../engine/expression';
import { computeRowStats } from '../../state/rowStats';
import { expressionNotation } from '../notation';
import { rowColor } from '../../components/chart/palette';
import type { Expression } from '../../types';

// Card geometry, restated here so the expected numbers below are arithmetic a
// reader can follow rather than a copy of whatever the module happens to emit.
const CARD_WIDTH = 920;
// padding*2 + plot + axis foot + list gap + footer, with no title and no rows.
const BASE_HEIGHT = 438;
const TITLE_HEIGHT = 42;
const LIST_LINE = 46;

function toRow(expr: Expression, index: number): ShareImageRow {
  const dist = expressionDistribution(expr);
  const stats = computeRowStats(dist);
  return {
    id: expr.id,
    name: expr.name,
    notation: expressionNotation(expr),
    color: rowColor(index),
    dist,
    canMiss: expr.mode === 'check',
    mean: stats.mean,
    stddev: stats.stddev,
    min: stats.min,
    max: stats.max,
  };
}

/** 2d6 plus the given modifier: results run from 3 + n to 13 + n. */
function sumRow(n: number): Expression {
  return {
    id: `sum-${n}`,
    name: `Roll ${n}`,
    parts: [{ id: `part-${n}`, count: 2, sides: 6 }],
    flatModifier: n,
    rollMode: 'normal',
    mode: 'sum',
  };
}

// 1d20+7 against 15, crit on a 20, nothing on a failure. Faces 1-7 fail, so the
// row lands on 0 exactly 7/20 of the time: the spike the card has to cap.
const checkRow: Expression = {
  id: 'check-1',
  name: 'Longsword',
  parts: [{ id: 'check-part', count: 1, sides: 20 }],
  flatModifier: 7,
  rollMode: 'normal',
  mode: 'check',
  check: {
    threshold: { direction: 'gte', value: 15 },
    effect: { parts: [{ id: 'effect-part', count: 1, sides: 8 }], flatModifier: 4 },
    onSuccess: 'full',
    onFailure: 'none',
    crit: { onFaces: [20], effect: 'doubleDice' },
  },
};

const emptyRow: Expression = {
  id: 'empty-1',
  name: 'Not built yet',
  parts: [],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};

/** A drawable row whose notation string is set directly, so it can be pushed
 * past the character budget without inventing a 90-character expression. */
function notationRow(notation: string): ShareImageRow {
  return {
    id: 'notation-1',
    name: 'Row',
    notation,
    color: rowColor(0),
    dist: new Map([
      [1, 0.5],
      [2, 0.5],
    ]),
    canMiss: false,
    mean: 1.5,
    stddev: 0.5,
    min: 1,
    max: 2,
  };
}

/** A flat row spanning 0 to 100, wide enough that the x-axis has to thin its
 * labels instead of printing one per result. */
function wideRow(): ShareImageRow {
  return {
    id: 'wide-1',
    name: 'Wide',
    notation: 'd101 - 1',
    color: rowColor(0),
    dist: new Map(Array.from({ length: 101 }, (_, i): [number, number] => [i, 1 / 101])),
    canMiss: false,
    mean: 50,
    stddev: 29.15,
    min: 0,
    max: 100,
  };
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function polylinePoints(svg: string): string[][] {
  return [...svg.matchAll(/<polyline points="([^"]*)"/g)].map((m) =>
    (m[1] ?? '').split(' '),
  );
}

describe('buildShareSvg card size', () => {
  it('draws a single row at the fixed card width', () => {
    const image = buildShareSvg({ rows: [toRow(sumRow(1), 0)], view: 'pmf', theme: 'light' });
    expect(image.width).toBe(CARD_WIDTH);
    expect(image.height).toBe(BASE_HEIGHT + LIST_LINE);
    expect(image.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" ')).toBe(true);
    expect(image.svg.endsWith('</svg>')).toBe(true);
  });

  it('grows the card by one line for every extra row', () => {
    const rows = [1, 2, 3, 4, 5].map((n) => toRow(sumRow(n), n - 1));
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'dark' });
    expect(image.height).toBe(BASE_HEIGHT + LIST_LINE * 5);
    expect(countOf(image.svg, '<polyline')).toBe(5);
  });

  it('draws no rows at all for an empty table', () => {
    const image = buildShareSvg({ rows: [], view: 'pmf', theme: 'light' });
    expect(image.height).toBe(BASE_HEIGHT);
    expect(image.svg).toContain('No rolls to compare yet.');
    expect(image.svg).not.toContain('<polyline');
  });

  it('leaves out a row that has no distribution to draw', () => {
    const image = buildShareSvg({
      rows: [toRow(emptyRow, 0), toRow(sumRow(1), 1)],
      view: 'pmf',
      theme: 'light',
    });
    expect(image.height).toBe(BASE_HEIGHT + LIST_LINE);
    expect(countOf(image.svg, '<polyline')).toBe(1);
    expect(image.svg).not.toContain('Not built yet');
  });

  it('still draws a row whose result never varies', () => {
    const flat: ShareImageRow = {
      id: 'flat',
      name: 'Always four',
      notation: '4',
      color: rowColor(0),
      dist: new Map([[4, 1]]),
      canMiss: false,
      mean: 4,
      stddev: 0,
      min: 4,
      max: 4,
    };
    const image = buildShareSvg({ rows: [flat], view: 'pmf', theme: 'light' });
    expect(countOf(image.svg, '<polyline')).toBe(1);
    // A single result has no span, so the axis is widened by one to keep the
    // horizontal scale from dividing by zero.
    expect(polylinePoints(image.svg)[0]).toHaveLength(4);
    expect(image.svg).not.toContain('NaN');
    expect(image.svg).toContain('>4.00 ± 0.00</text>');
  });

  it('writes the card size into the svg and keeps the viewBox at card units', () => {
    const image = buildShareSvg({ rows: [toRow(sumRow(1), 0)], view: 'pmf', theme: 'light' });
    expect(image.svg).toContain('width="920" height="484"');
    expect(image.svg).toContain('viewBox="0 0 920 484"');
  });
});

describe('buildShareSvg scale option', () => {
  const rows = [toRow(sumRow(1), 0)];

  it('renders at card size when no scale is given', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light' });
    expect(image.width).toBe(920);
    expect(image.height).toBe(484);
  });

  it('doubles the pixel size at scale two without touching the viewBox', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light', scale: 2 });
    expect(image.width).toBe(1840);
    expect(image.height).toBe(968);
    expect(image.svg).toContain('width="1840" height="968"');
    expect(image.svg).toContain('viewBox="0 0 920 484"');
  });

  it('halves the pixel size at scale one half', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light', scale: 0.5 });
    expect(image.width).toBe(460);
    expect(image.height).toBe(242);
  });

  it('falls back to card size for a scale of zero', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light', scale: 0 });
    expect(image.width).toBe(920);
    expect(image.height).toBe(484);
  });

  it('falls back to card size for a negative scale', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light', scale: -3 });
    expect(image.width).toBe(920);
    expect(image.height).toBe(484);
  });
});

describe('buildShareSvg title', () => {
  const rows = [toRow(sumRow(1), 0)];

  it('adds a header band when a title is set', () => {
    const image = buildShareSvg({
      rows,
      view: 'pmf',
      theme: 'light',
      title: 'Weapon pass',
    });
    expect(image.height).toBe(BASE_HEIGHT + LIST_LINE + TITLE_HEIGHT);
    expect(image.svg).toContain('>Weapon pass</text>');
    expect(image.svg).toContain('font-size="20"');
  });

  it('leaves the header band out when no title is given', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light' });
    expect(image.height).toBe(BASE_HEIGHT + LIST_LINE);
    expect(image.svg).not.toContain('font-size="20"');
  });

  it('leaves the header band out for a title that is only whitespace', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light', title: '   ' });
    expect(image.height).toBe(BASE_HEIGHT + LIST_LINE);
    expect(image.svg).not.toContain('font-size="20"');
  });

  it('trims the surrounding whitespace off a title', () => {
    const image = buildShareSvg({
      rows,
      view: 'pmf',
      theme: 'light',
      title: '  Weapon pass  ',
    });
    expect(image.svg).toContain('>Weapon pass</text>');
  });

  it('cuts a title longer than seventy characters down to an ellipsis', () => {
    const image = buildShareSvg({
      rows,
      view: 'pmf',
      theme: 'light',
      title: 'a'.repeat(80),
    });
    expect(image.svg).toContain(`>${'a'.repeat(69)}…</text>`);
    expect(image.svg).not.toContain('a'.repeat(70));
  });

  it('leaves a title of exactly seventy characters whole', () => {
    const title = 'a'.repeat(70);
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light', title });
    expect(image.svg).toContain(`>${title}</text>`);
    expect(image.svg).not.toContain('…');
  });

  it('cuts a title one character over the budget', () => {
    const image = buildShareSvg({
      rows,
      view: 'pmf',
      theme: 'light',
      title: 'a'.repeat(71),
    });
    expect(image.svg).toContain(`>${'a'.repeat(69)}…</text>`);
    expect(image.svg).not.toContain('a'.repeat(70));
  });

  // An emoji is two UTF-16 units. A cut that lands between them leaves a lone
  // surrogate, and encodeURIComponent throws on it while rasterizing.
  it('cuts by whole characters so an emoji cannot be split at the boundary', () => {
    const image = buildShareSvg({
      rows,
      view: 'pmf',
      theme: 'light',
      title: `${'a'.repeat(68)}😀${'a'.repeat(5)}`,
    });
    expect(image.svg).toContain(`>${'a'.repeat(68)}😀…</text>`);
    expect(() => encodeURIComponent(image.svg)).not.toThrow();
  });
});

describe('buildShareSvg themes', () => {
  const rows = [toRow(sumRow(1), 0)];

  it('paints a light card on white', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light' });
    expect(image.svg).toContain(
      '<rect x="0" y="0" width="920" height="484" fill="#ffffff"/>',
    );
    expect(image.svg).toContain('fill="#0f172a"');
    expect(image.svg).not.toContain('#0b1220');
  });

  it('paints a dark card on near-black', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'dark' });
    expect(image.svg).toContain(
      '<rect x="0" y="0" width="920" height="484" fill="#0b1220"/>',
    );
    expect(image.svg).toContain('fill="#e2e8f0"');
    expect(image.svg).not.toContain('#ffffff');
  });

  it('keeps the row color the table gave it in both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      const image = buildShareSvg({ rows, view: 'pmf', theme });
      expect(image.svg).toContain('stroke="#2563eb"');
    }
  });
});

describe('buildShareSvg views', () => {
  const rows = [toRow(sumRow(1), 0)];

  it('labels the chance-of-each-result view and ends its axis on the rounded peak', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light' });
    // 2d6 peaks at 6/36, so the nice axis stops at 20%, not 100%.
    expect(image.svg).toContain('>Chance of each result</text>');
    expect(image.svg).toContain('>20%</text>');
    expect(image.svg).not.toContain('>100%</text>');
  });

  it('draws two points per result in the chance-of-each-result view', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light' });
    // 3 to 13 is eleven results, each drawn as a flat tread.
    expect(polylinePoints(image.svg)[0]).toHaveLength(22);
  });

  it('draws the target view as hit-rate bars, not a line chart', () => {
    const image = buildShareSvg({
      rows,
      view: 'target',
      target: { values: [8, 12], ruling: 'gte' },
      theme: 'light',
    });
    expect(image.svg).toContain('>Chance of hitting each target</text>');
    expect(image.svg).not.toContain('<polyline');
    expect(image.svg).toContain('>≥8</text>');
    expect(image.svg).toContain('>≥12</text>');
  });

  // The target view has nothing to measure against with an empty list, so it
  // falls back the way the chart does rather than drawing an empty axis.
  it('falls back to chance-of-each-result when no target is set', () => {
    const image = buildShareSvg({ rows, view: 'target', theme: 'light' });
    expect(image.svg).toContain('>Chance of each result</text>');
    expect(polylinePoints(image.svg)[0]).toHaveLength(22);
  });

  it('labels the at-most view and runs its axis to one hundred percent', () => {
    const image = buildShareSvg({ rows, view: 'cdf', theme: 'light' });
    expect(image.svg).toContain('>Chance of rolling at most</text>');
    expect(image.svg).toContain('>100%</text>');
    expect(polylinePoints(image.svg)[0]).toHaveLength(11);
  });

  it('starts the at-most curve at the chance of the lowest result', () => {
    const image = buildShareSvg({ rows, view: 'cdf', theme: 'light' });
    const points = polylinePoints(image.svg)[0] ?? [];
    // Rolling 3 on 2d6+1 is 1/36, which is 7.83 of the 282px plot above y=328.
    expect(points[0]).toBe('94,320.17');
    expect(points[points.length - 1]).toBe('878,46');
  });

  it('labels the at-least view and starts it at certainty', () => {
    const image = buildShareSvg({ rows, view: 'ccdf', theme: 'light' });
    const points = polylinePoints(image.svg)[0] ?? [];
    expect(image.svg).toContain('>Chance of rolling at least</text>');
    expect(image.svg).toContain('>100%</text>');
    expect(points[0]).toBe('94,46');
  });

  it('gives each series its own dash so overlapping lines stay apart', () => {
    const rowsTwo = [toRow(sumRow(1), 0), toRow(sumRow(2), 1)];
    const image = buildShareSvg({ rows: rowsTwo, view: 'pmf', theme: 'light' });
    expect(image.svg).toContain('stroke-dasharray="0"');
    expect(image.svg).toContain('stroke-dasharray="7 4"');
  });
});

describe('buildShareSvg row list', () => {
  it('prints the name, notation, stats and range of a row', () => {
    const image = buildShareSvg({
      rows: [toRow(sumRow(1), 0)],
      view: 'pmf',
      theme: 'light',
    });
    expect(image.svg).toContain('>Roll 1</text>');
    expect(image.svg).toContain('>2d6 + 1</text>');
    // 2d6+1 averages 8 with a spread of sqrt(35/6).
    expect(image.svg).toContain('>8.00 ± 2.42</text>');
    expect(image.svg).toContain('>3 to 13</text>');
  });

  it('draws a color swatch beside each row name', () => {
    const image = buildShareSvg({
      rows: [toRow(sumRow(1), 0)],
      view: 'pmf',
      theme: 'light',
    });
    expect(image.svg).toContain('<rect x="28" y="367" width="10" height="10" rx="2" fill="#2563eb"/>');
  });

  it('cuts a row name longer than twenty-eight characters down to an ellipsis', () => {
    const long = { ...sumRow(1), name: 'b'.repeat(40) };
    const image = buildShareSvg({ rows: [toRow(long, 0)], view: 'pmf', theme: 'light' });
    expect(image.svg).toContain(`>${'b'.repeat(27)}…</text>`);
    expect(image.svg).not.toContain('b'.repeat(28));
  });

  it('leaves a row name of exactly twenty-eight characters whole', () => {
    const named = { ...sumRow(1), name: 'b'.repeat(28) };
    const image = buildShareSvg({ rows: [toRow(named, 0)], view: 'pmf', theme: 'light' });
    expect(image.svg).toContain(`>${'b'.repeat(28)}</text>`);
    expect(image.svg).not.toContain('…');
  });

  it('cuts a notation longer than seventy-two characters down to an ellipsis', () => {
    const image = buildShareSvg({
      rows: [notationRow('d'.repeat(90))],
      view: 'pmf',
      theme: 'light',
    });
    expect(image.svg).toContain(`>${'d'.repeat(71)}…</text>`);
    expect(image.svg).not.toContain('d'.repeat(72));
  });

  it('leaves a notation of exactly seventy-two characters whole', () => {
    const notation = 'd'.repeat(72);
    const image = buildShareSvg({ rows: [notationRow(notation)], view: 'pmf', theme: 'light' });
    expect(image.svg).toContain(`>${notation}</text>`);
    expect(image.svg).not.toContain('…');
  });

  it('thins the result labels rather than printing one per result', () => {
    // 0 to 100 asks for a label every 13 results, and 91 + 13 overshoots, so the
    // top of the range is appended instead of skipped.
    const image = buildShareSvg({ rows: [wideRow()], view: 'pmf', theme: 'light' });
    expect(countOf(image.svg, 'text-anchor="middle"')).toBe(9);
    expect(image.svg).toContain('>13</text>');
    expect(image.svg).toContain('>91</text>');
    expect(image.svg).toContain('>100</text>');
  });
});

describe('buildShareSvg capped zero spike', () => {
  it('marks the capped bar with its real percentage', () => {
    const image = buildShareSvg({
      rows: [toRow(checkRow, 0), toRow(sumRow(2), 1)],
      view: 'pmf',
      theme: 'light',
    });
    // Faces 1 to 7 of the d20 fail and deal nothing: 7/20 of the time. The
    // marker sits on the first result, half a tread in from the axis: 0 to 20
    // is 21 results across an 812px plot, so the inset is 812 / 42 = 19.33.
    expect(image.svg).toContain('>35%</text>');
    expect(image.svg).toContain(
      '<circle cx="99.33" cy="46" r="4" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>',
    );
  });

  it('marks nothing when no row can come up empty', () => {
    const image = buildShareSvg({
      rows: [toRow(sumRow(1), 0), toRow(sumRow(2), 1)],
      view: 'pmf',
      theme: 'light',
    });
    expect(image.svg).not.toContain('<circle');
  });

  // The cumulative views draw the full 0 to 100% axis, so no bar is ever cut
  // off there and the on-screen chart shows no markers either.
  it('marks nothing in the cumulative views even when a row can miss', () => {
    for (const view of ['cdf', 'ccdf'] as const) {
      const image = buildShareSvg({
        rows: [toRow(checkRow, 0), toRow(sumRow(2), 1)],
        view,
        theme: 'light',
      });
      expect(image.svg).not.toContain('<circle');
      expect(image.svg).toContain('>100%</text>');
    }
  });
});

describe('buildShareSvg footer note', () => {
  const rows = [toRow(sumRow(1), 0)];

  it('always credits the app', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light' });
    expect(image.svg).toContain('>built with dice-table.app</text>');
  });

  it('says when pool rows were left out of the picture', () => {
    const image = buildShareSvg({
      rows,
      view: 'pmf',
      theme: 'light',
      note: '2 pool rolls are not in this picture',
    });
    expect(image.svg).toContain('>2 pool rolls are not in this picture</text>');
    // The aside is the only right-aligned line in the footer's sans face.
    expect(countOf(image.svg, 'text-anchor="end" font-family="system-ui')).toBe(1);
  });

  it('leaves the aside out when the note is blank', () => {
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light', note: '  ' });
    expect(countOf(image.svg, 'text-anchor="end" font-family="system-ui')).toBe(0);
  });

  it('cuts a note past the budget down to an ellipsis', () => {
    const image = buildShareSvg({
      rows,
      view: 'pmf',
      theme: 'light',
      note: 'c'.repeat(130),
    });
    expect(image.svg).toContain(`>${'c'.repeat(119)}…</text>`);
    expect(image.svg).not.toContain('c'.repeat(120));
  });

  it('leaves a note of exactly the budget whole', () => {
    const note = 'c'.repeat(120);
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light', note });
    expect(image.svg).toContain(`>${note}</text>`);
    expect(image.svg).not.toContain('…');
  });

  // Two notes at once, with two-digit counts: an aside near the top of the
  // budget (37 + 2 + 31 code points) must survive whole.
  it('keeps a pair of notes whole when both are present', () => {
    const note = '99 rolls are on a different scale here. 99 rolls left out (too complex)';
    const image = buildShareSvg({ rows, view: 'pmf', theme: 'light', note });
    expect(image.svg).toContain(`>${note}</text>`);
    expect(image.svg).not.toContain('…');
  });
});

describe('buildShareSvg escaping', () => {
  it('escapes a row name that looks like markup', () => {
    const nasty = { ...sumRow(1), name: '<script>&"x"' };
    const image = buildShareSvg({ rows: [toRow(nasty, 0)], view: 'pmf', theme: 'light' });
    expect(image.svg).toContain('&lt;script&gt;&amp;&quot;x&quot;');
    expect(image.svg).not.toContain('<script>');
  });

  it('escapes an apostrophe in a row name', () => {
    const named = { ...sumRow(1), name: "Ork's axe" };
    const image = buildShareSvg({ rows: [toRow(named, 0)], view: 'pmf', theme: 'light' });
    expect(image.svg).toContain('Ork&apos;s axe');
  });

  it('escapes a title that tries to close the svg', () => {
    const image = buildShareSvg({
      rows: [toRow(sumRow(1), 0)],
      view: 'pmf',
      theme: 'light',
      title: '</svg><script>alert(1)</script>',
    });
    expect(image.svg).toContain('&lt;/svg&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(image.svg).not.toContain('</svg><script>');
    expect(countOf(image.svg, '</svg>')).toBe(1);
  });

  it('escapes a notation that looks like markup', () => {
    const image = buildShareSvg({
      rows: [notationRow('<b>2d6</b> & "x"')],
      view: 'pmf',
      theme: 'light',
    });
    expect(image.svg).toContain('&lt;b&gt;2d6&lt;/b&gt; &amp; &quot;x&quot;');
    expect(image.svg).not.toContain('<b>');
  });

  it('escapes a note that looks like markup', () => {
    const image = buildShareSvg({
      rows: [toRow(sumRow(1), 0)],
      view: 'pmf',
      theme: 'light',
      note: '<b>2 pools</b>',
    });
    expect(image.svg).toContain('&lt;b&gt;2 pools&lt;/b&gt;');
    expect(image.svg).not.toContain('<b>');
  });
});

describe('buildShareSvg self-containment', () => {
  it('references nothing outside the file', () => {
    const image = buildShareSvg({
      rows: [toRow(checkRow, 0), toRow(sumRow(1), 1)],
      view: 'pmf',
      theme: 'dark',
      title: 'Attack',
      note: 'pools left out',
    });
    expect(image.svg).not.toContain('foreignObject');
    expect(image.svg).not.toContain('@font-face');
    expect(image.svg).not.toContain('xlink:href');
    expect(image.svg).not.toContain('<image');
    expect(image.svg).not.toContain('url(');
  });

  it('carries the svg namespace as its only URL', () => {
    const image = buildShareSvg({
      rows: [toRow(sumRow(1), 0)],
      view: 'pmf',
      theme: 'light',
      title: 'Attack',
    });
    const urls = image.svg.match(/https?:\/\/[^"']+/g) ?? [];
    expect(urls).toEqual(['http://www.w3.org/2000/svg']);
  });

  it('matches the card drawn for a single row in light mode', () => {
    const image = buildShareSvg({
      rows: [toRow(sumRow(1), 0)],
      view: 'pmf',
      theme: 'light',
    });
    expect(image.svg).toMatchSnapshot();
  });
});
