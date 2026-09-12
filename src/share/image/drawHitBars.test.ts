import { describe, expect, it } from 'vitest';
import {
  drawHitBars,
  hitBarCapacity,
  targetOpacity,
  type HitBarColumn,
  type HitBarRow,
  type HitBarsDrawing,
} from './drawHitBars';
import { expressionDistribution } from '../../engine/expression';
import { hitProbability } from '../../engine/stats';
import { rowColor, shareCardPalette } from '../../components/chart/palette';
import type { Expression } from '../../types';

// Block geometry, restated here so every expected number below is arithmetic a
// reader can follow rather than a copy of whatever the module happens to emit.
//
// The chart card hands the bars its full live width: 920 - 28 * 2 = 864, at the
// card's left padding, and 300 + 26 - 18 = 308 of height.
const BLOCK_X = 28;
const BLOCK_WIDTH = 864;
const BLOCK_Y = 100;
const BLOCK_HEIGHT = 308;
// The y-axis labels take a 52px gutter, so the bars own 864 - 52 = 812,
// running from x = 28 + 52 to x = 28 + 864.
const PLOT_LEFT = 80;
const PLOT_RIGHT = 892;
// The key takes 20 + 12 off the top and the row names 22 off the bottom:
// 100 + 32 = 132 down to 100 + 308 - 22 = 386, so a full bar stands 254 tall.
const PLOT_BOTTOM = 386;
const PLOT_SPAN = 254;

const PALETTE = shareCardPalette('light');

function sumExpression(id: string, count: number, sides: number): Expression {
  return {
    id,
    name: id,
    parts: [{ id: `${id}-part`, count, sides }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
}

const coin = expressionDistribution(sumExpression('coin', 1, 2));
const twoD6 = expressionDistribution(sumExpression('two-d6', 2, 6));

// A d2 lands on 0.5 exactly, so these three chances are the extremes and the
// midpoint with no floating point slack to work around.
const CERTAIN = hitProbability(coin, 1, 'gte');
const EVEN = hitProbability(coin, 2, 'gte');
const IMPOSSIBLE = hitProbability(coin, 3, 'gte');

function hitsAgainst(values: number[]): number[] {
  return values.map((value) => hitProbability(twoD6, value, 'gte'));
}

function columnsFor(values: number[]): HitBarColumn[] {
  return values.map((value) => ({ label: `≥${value}` }));
}

function rollsNamed(names: string[], hits: number[]): HitBarRow[] {
  return names.map((name, index) => ({
    id: `roll-${index}`,
    name,
    color: rowColor(index),
    hits,
  }));
}

function rolls(count: number, hits: number[]): HitBarRow[] {
  return rollsNamed(
    Array.from({ length: count }, (_, index) => `Roll ${index + 1}`),
    hits,
  );
}

function drawBlock(rows: HitBarRow[], columns: HitBarColumn[]): HitBarsDrawing {
  return drawHitBars({
    rows,
    columns,
    palette: PALETTE,
    x: BLOCK_X,
    width: BLOCK_WIDTH,
    y: BLOCK_Y,
    height: BLOCK_HEIGHT,
  });
}

function svgOf(drawing: HitBarsDrawing): string {
  return drawing.parts.join('');
}

interface DrawnRect {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
}

// A bar carries its height straight into a fill, while a key swatch is a fixed
// 10 by 10 with a corner radius, so the two shapes never match each other.
const BAR_RECT =
  /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)" fill="([^"]+)" fill-opacity="([\d.-]+)"\/>/g;
const KEY_RECT =
  /<rect x="([\d.-]+)" y="([\d.-]+)" width="10" height="10" rx="2" fill="([^"]+)" fill-opacity="([\d.-]+)"\/>/g;

function barRects(drawing: HitBarsDrawing): DrawnRect[] {
  return [...svgOf(drawing).matchAll(BAR_RECT)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4]),
    fill: match[5] ?? '',
    opacity: Number(match[6]),
  }));
}

// Only the percentage over a bar is set at 10px; the axis ticks and the key sit
// at 11px, so this picks out the bar labels alone.
const BAR_LABEL = /<text[^>]*font-size="10"[^>]*>([^<]*)<\/text>/g;

function barLabels(drawing: HitBarsDrawing): string[] {
  return [...svgOf(drawing).matchAll(BAR_LABEL)].map((match) => match[1] ?? '');
}

function keyRects(drawing: HitBarsDrawing): DrawnRect[] {
  return [...svgOf(drawing).matchAll(KEY_RECT)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    width: 10,
    height: 10,
    fill: match[3] ?? '',
    opacity: Number(match[4]),
  }));
}

describe('targetOpacity', () => {
  it('gives a lone target one fixed weight', () => {
    expect(targetOpacity(0, 1)).toBeCloseTo(0.85, 12);
  });

  it('starts several targets at the heaviest weight', () => {
    expect(targetOpacity(0, 4)).toBeCloseTo(0.9, 12);
  });

  it('ends several targets at the lightest weight', () => {
    expect(targetOpacity(3, 4)).toBeCloseTo(0.35, 12);
  });

  it('gives a pair of targets only the two ends of the ramp', () => {
    expect(targetOpacity(0, 2)).toBeCloseTo(0.9, 12);
    expect(targetOpacity(1, 2)).toBeCloseTo(0.35, 12);
  });

  it('steps evenly between the ends across six targets', () => {
    // 0.9 down to 0.35 over five gaps is 0.11 a step.
    const ramp = [0, 1, 2, 3, 4, 5].map((index) => targetOpacity(index, 6));
    expect(ramp[1]).toBeCloseTo(0.79, 12);
    expect(ramp[2]).toBeCloseTo(0.68, 12);
    expect(ramp[3]).toBeCloseTo(0.57, 12);
    expect(ramp[4]).toBeCloseTo(0.46, 12);
  });
});

describe('hitBarCapacity', () => {
  it('returns a whole number of rolls above zero for every target count', () => {
    for (const targets of [1, 2, 3, 4, 5]) {
      const capacity = hitBarCapacity(BLOCK_WIDTH, targets);
      expect(Number.isInteger(capacity)).toBe(true);
      expect(capacity).toBeGreaterThan(0);
    }
  });

  it('fits fewer rolls as each extra target joins the group', () => {
    // 812 of bar width divided by a group of (targets * 7) + (gaps * 3) + 14:
    //   1 target  -> 7 + 0 + 14 = 21, 812 / 21 = 38.6
    //   2 targets -> 14 + 3 + 14 = 31, 812 / 31 = 26.1
    //   3 targets -> 21 + 6 + 14 = 41, 812 / 41 = 19.8
    //   4 targets -> 28 + 9 + 14 = 51, 812 / 51 = 15.9
    //   5 targets -> 35 + 12 + 14 = 61, 812 / 61 = 13.3
    const capacities = [1, 2, 3, 4, 5].map((targets) =>
      hitBarCapacity(BLOCK_WIDTH, targets),
    );
    expect(capacities).toEqual([38, 26, 19, 15, 13]);
  });

  it('measures a card with no targets as if it carried one', () => {
    expect(hitBarCapacity(BLOCK_WIDTH, 0)).toBe(38);
  });

  it('still promises one roll on a card too narrow to hold any', () => {
    // 40 of width is swallowed whole by the 52px axis gutter.
    expect(hitBarCapacity(40, 3)).toBe(1);
  });
});

describe('drawHitBars with nothing to measure', () => {
  it('draws only a note when no targets are set', () => {
    const drawing = drawBlock(rolls(3, []), []);
    expect(svgOf(drawing)).toContain('No targets to measure against yet.');
    expect(svgOf(drawing)).not.toContain('<rect');
  });

  it('reports nothing shown and nothing hidden when no targets are set', () => {
    const drawing = drawBlock(rolls(3, []), []);
    expect(drawing.shown).toBe(0);
    expect(drawing.hidden).toBe(0);
  });

  it('draws only a note when there are no rolls', () => {
    const drawing = drawBlock([], columnsFor([7, 10]));
    expect(svgOf(drawing)).toContain('No targets to measure against yet.');
    expect(svgOf(drawing)).not.toContain('<rect');
  });

  it('reports nothing shown and nothing hidden when there are no rolls', () => {
    const drawing = drawBlock([], columnsFor([7, 10]));
    expect(drawing.shown).toBe(0);
    expect(drawing.hidden).toBe(0);
  });
});

describe('drawHitBars bars and key', () => {
  const targets = [7, 10];
  const drawing = drawBlock(rolls(3, hitsAgainst(targets)), columnsFor(targets));

  it('draws one bar for every roll in every target column', () => {
    expect(barRects(drawing)).toHaveLength(6);
  });

  it('draws one key swatch for every target column', () => {
    expect(keyRects(drawing)).toHaveLength(2);
  });

  it('names each target beside its key swatch', () => {
    expect(svgOf(drawing)).toContain('>≥7</text>');
    expect(svgOf(drawing)).toContain('>≥10</text>');
  });

  it('reports every roll shown when they all fit', () => {
    expect(drawing.shown).toBe(3);
    expect(drawing.hidden).toBe(0);
  });

  it('paints each roll in the colour the table gave it', () => {
    const fills = barRects(drawing).map((rect) => rect.fill);
    expect(fills).toEqual([
      '#4369b6',
      '#4369b6',
      '#bb6a26',
      '#bb6a26',
      '#0a9564',
      '#0a9564',
    ]);
  });

  it('carries the target ramp onto the bars so the later target reads lighter', () => {
    const [first, second] = barRects(drawing);
    expect(first?.opacity).toBeCloseTo(0.9, 12);
    expect(second?.opacity).toBeCloseTo(0.35, 12);
  });

  it('keeps every bar inside the plot area', () => {
    for (const rect of barRects(drawing)) {
      expect(rect.x).toBeGreaterThanOrEqual(PLOT_LEFT);
      expect(rect.x + rect.width).toBeLessThanOrEqual(PLOT_RIGHT);
    }
  });
});

describe('drawHitBars legibility floor', () => {
  const targets = [4, 6, 8, 10, 12];
  const hits = hitsAgainst(targets);
  const columns = columnsFor(targets);

  it('draws only as many rolls as the width can hold', () => {
    // Five targets leave room for thirteen groups at this width.
    const drawing = drawBlock(rolls(15, hits), columns);
    expect(drawing.shown).toBe(13);
  });

  it('counts the rolls it had to leave out', () => {
    const drawing = drawBlock(rolls(15, hits), columns);
    expect(drawing.hidden).toBe(2);
  });

  it('leaves no trace of a roll it could not draw', () => {
    const drawing = drawBlock(rolls(15, hits), columns);
    expect(svgOf(drawing)).toContain('>Roll 13</text>');
    expect(svgOf(drawing)).not.toContain('>Roll 14</text>');
    expect(svgOf(drawing)).not.toContain('>Roll 15</text>');
    expect(barRects(drawing)).toHaveLength(65);
  });

  it('hides nothing when the rolls exactly fill the width', () => {
    const drawing = drawBlock(rolls(13, hits), columns);
    expect(drawing.shown).toBe(13);
    expect(drawing.hidden).toBe(0);
  });

  it('leaves the percentage off a bar too thin to hold it', () => {
    // Thirteen groups of five bars leaves each bar near 7px, and a three
    // character percentage needs about 18px of monospace.
    const drawing = drawBlock(rolls(13, hits), columns);
    expect(barLabels(drawing)).toHaveLength(0);
    expect(barRects(drawing)).toHaveLength(65);
  });
});

describe('drawHitBars extreme chances', () => {
  const drawing = drawBlock(
    rollsNamed(['Sure thing'], [CERTAIN, IMPOSSIBLE]),
    columnsFor([1, 3]),
  );

  it('draws a full-height bar for a certainty', () => {
    const [certain] = barRects(drawing);
    expect(certain?.height).toBe(PLOT_SPAN);
    expect(certain?.y).toBe(PLOT_BOTTOM - PLOT_SPAN);
  });

  it('draws a bar of no height for a chance of zero', () => {
    const [, impossible] = barRects(drawing);
    expect(impossible?.height).toBe(0);
    expect(impossible?.y).toBe(PLOT_BOTTOM);
  });

  it('writes no NaN into a card carrying both extremes', () => {
    expect(svgOf(drawing)).not.toContain('NaN');
  });

  it('labels the two extremes as whole percentages', () => {
    expect(barLabels(drawing)).toEqual(['100%', '0%']);
  });
});

describe('drawHitBars bar heights', () => {
  const drawing = drawBlock(
    [
      { id: 'sure', name: 'Sure thing', color: rowColor(0), hits: [CERTAIN] },
      { id: 'coin', name: 'Coin flip', color: rowColor(1), hits: [EVEN] },
    ],
    columnsFor([1]),
  );

  it('draws a certain roll taller than an even one', () => {
    const [certain, even] = barRects(drawing);
    expect(certain?.height).toBeGreaterThan(even?.height ?? 0);
  });

  it('halves the bar height for an even chance', () => {
    const [, even] = barRects(drawing);
    expect(even?.height).toBe(PLOT_SPAN / 2);
  });
});

describe('drawHitBars roll names', () => {
  const columns = columnsFor([7]);
  const hits = hitsAgainst([7]);

  it('escapes a roll name that looks like markup', () => {
    const drawing = drawBlock(rollsNamed(['<script>&"x"'], hits), columns);
    expect(svgOf(drawing)).toContain('&lt;script&gt;&amp;&quot;x&quot;');
    expect(svgOf(drawing)).not.toContain('<script>');
  });

  it('escapes an apostrophe in a roll name', () => {
    const drawing = drawBlock(rollsNamed(["Ork's axe"], hits), columns);
    expect(svgOf(drawing)).toContain('Ork&apos;s axe');
  });

  it('cuts a long roll name down to the card name budget', () => {
    // One group owns all 812px, far past the 28 character cap the cards share.
    const drawing = drawBlock(rollsNamed(['b'.repeat(40)], hits), columns);
    expect(svgOf(drawing)).toContain(`>${'b'.repeat(27)}…</text>`);
    expect(svgOf(drawing)).not.toContain('b'.repeat(28));
  });

  it('cuts a roll name harder once the groups are narrow', () => {
    // Ten groups across 812px is 81.2 each, and one character per 6.6px of
    // group leaves room for twelve.
    const names = Array.from({ length: 10 }, () => 'b'.repeat(40));
    const drawing = drawBlock(rollsNamed(names, hits), columns);
    expect(svgOf(drawing)).toContain(`>${'b'.repeat(11)}…</text>`);
    expect(svgOf(drawing)).not.toContain('b'.repeat(12));
  });
});
