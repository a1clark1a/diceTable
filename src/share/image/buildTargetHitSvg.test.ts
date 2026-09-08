import { describe, expect, it } from 'vitest';
import { buildTargetHitSvg, type TargetHitCardOptions } from './buildTargetHitSvg';
import { toTargetRows } from '../../components/target/targetHitRows';
import type { ShareImage } from './svgPrimitives';
import type { Expression, TargetState } from '../../types';

// Card geometry, restated here so the expected sizes below are arithmetic a
// reader can follow rather than a copy of whatever the module happens to emit.
const CARD_WIDTH = 920;
// padding*2 (56) + the panel heading (22) + the footer (34): the card with
// nothing at all drawn between the heading and the credit line.
const SHELL_HEIGHT = 112;
// A fallback sentence stands in for the whole drawing.
const EMPTY_H = 30;
// The reliability legend strip that sits above the boards.
const LEGEND_H = 24;
// A board is a heading (32) + column heads (26) + a foot (12) around its rows.
const BOARD_CHROME = 70;
const ROW_H = 34;
// Past this many rolls the card would letterbox, so the boards are cut.
const ROW_CAP = 24;

const SUM_BOARD = 'SUM ROLLS, MEASURED ON THE TOTAL';
const POOL_BOARD = 'POOL ROLLS, MEASURED IN SUCCESSES';
const LEGEND_TEXT = 'Reliable: 66% or better';

/** 2d6 + n. A bigger n is strictly likelier to clear any fixed target. */
function sumRoll(name: string, modifier: number): Expression {
  return {
    id: `sum-${name}`,
    name,
    parts: [{ id: `sum-part-${name}`, count: 2, sides: 6 }],
    flatModifier: modifier,
    rollMode: 'normal',
    mode: 'sum',
  };
}

/** n d6 scoring a success on a 5 or a 6, so each die succeeds one time in three. */
function poolRoll(name: string, dice: number): Expression {
  return {
    id: `pool-${name}`,
    name,
    parts: [{ id: `pool-part-${name}`, count: dice, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 5 },
  };
}

const SWORD = sumRoll('Sword', 3);
const HORDE = poolRoll('Horde', 5);

function build(
  expressions: Expression[],
  options: Partial<Omit<TargetHitCardOptions, 'rows'>> = {},
): ShareImage {
  return buildTargetHitSvg({
    rows: toTargetRows(expressions),
    target: { values: [8], ruling: 'gte' },
    poolTargets: [2],
    subView: 'grid',
    filter: 'all',
    sort: null,
    theme: 'light',
    ...options,
  });
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Where a drawn string sits in the markup, so draw order can be compared. */
function positionOf(svg: string, content: string): number {
  const at = svg.indexOf(`>${content}</text>`);
  expect(at).toBeGreaterThan(-1);
  return at;
}

/** The y the text carrying `content` is drawn at. */
function yOfText(svg: string, content: string): number {
  const at = svg.indexOf(`>${content}</text>`);
  expect(at).toBeGreaterThan(-1);
  const tag = svg.slice(svg.lastIndexOf('<text ', at), at);
  const match = /y="(-?[\d.]+)"/.exec(tag);
  expect(match).not.toBeNull();
  return Number(match?.[1]);
}

describe('buildTargetHitSvg sub-views', () => {
  it('draws a board per kind of roll in the grid sub-view', () => {
    const { svg } = build([SWORD, HORDE], { subView: 'grid' });
    expect(svg).toContain(SUM_BOARD);
    expect(svg).toContain(POOL_BOARD);
    expect(svg).not.toContain('TARGET: ');
    expect(svg).not.toContain('<polyline');
  });

  it('draws a panel per target in the bars sub-view', () => {
    const { svg } = build([SWORD, HORDE], { subView: 'bars' });
    expect(svg).toContain('TARGET: 8 OR MORE');
    expect(svg).toContain('POOL TARGET: 2+ SUCCESSES');
    expect(svg).not.toContain(SUM_BOARD);
    expect(svg).not.toContain(POOL_BOARD);
    expect(svg).not.toContain('<polyline');
  });

  it('draws a line per sum roll in the curves sub-view', () => {
    const { svg } = build([SWORD, HORDE], { subView: 'curves' });
    expect(countOf(svg, '<polyline')).toBe(1);
    expect(svg).not.toContain(SUM_BOARD);
    expect(svg).not.toContain('TARGET: ');
  });

  it('names a bars panel in words rather than in symbols', () => {
    const { svg } = build([SWORD], {
      subView: 'bars',
      target: { values: [8], ruling: 'lte' },
    });
    expect(svg).toContain('TARGET: 8 OR LESS');
    expect(svg).not.toContain('≤8');
  });
});

describe('buildTargetHitSvg grid board', () => {
  it('sizes a one-row board to the legend plus the board chrome', () => {
    const image = build([SWORD], { poolTargets: [] });
    expect(image.width).toBe(CARD_WIDTH);
    expect(image.height).toBe(SHELL_HEIGHT + LEGEND_H + BOARD_CHROME + ROW_H);
  });

  it('heads each column in words rather than in symbols', () => {
    const { svg } = build([SWORD, HORDE]);
    expect(svg).toContain('>8 or more</text>');
    expect(svg).toContain('>2+ successes</text>');
  });

  it('prints the hit chance of every roll in its own cell', () => {
    const { svg } = build([SWORD, HORDE]);
    // 2d6+3 clears 8 whenever 2d6 rolls 5 or better: 30 of 36.
    expect(svg).toContain('>83.3%</text>');
    // Five dice succeeding one time in three land 2 or more successes 131/243.
    expect(svg).toContain('>53.9%</text>');
  });
});

describe('buildTargetHitSvg kind filter', () => {
  it('drops the pool board when only sum rolls are shown', () => {
    const { svg } = build([SWORD, HORDE], { filter: 'sum' });
    expect(svg).toContain(SUM_BOARD);
    expect(svg).not.toContain(POOL_BOARD);
  });

  it('drops the sum board when only pool rolls are shown', () => {
    const { svg } = build([SWORD, HORDE], { filter: 'pool' });
    expect(svg).toContain(POOL_BOARD);
    expect(svg).not.toContain(SUM_BOARD);
  });

  it('keeps both boards when everything is shown', () => {
    const { svg } = build([SWORD, HORDE], { filter: 'all' });
    expect(svg).toContain(SUM_BOARD);
    expect(svg).toContain(POOL_BOARD);
  });

  it('drops the pool panels from the bars layout when only sum rolls are shown', () => {
    const { svg } = build([SWORD, HORDE], { subView: 'bars', filter: 'sum' });
    expect(svg).toContain('TARGET: 8 OR MORE');
    expect(svg).not.toContain('POOL TARGET');
  });

  // The view only offers the chips when the table holds both kinds, so a choice
  // left over from a mixed table cannot empty a single-kind one.
  it('ignores a stale pool filter on a table holding no pool rolls', () => {
    const { svg } = build([SWORD], { filter: 'pool' });
    expect(svg).toContain(SUM_BOARD);
    expect(svg).toContain('>83.3%</text>');
  });

  it('ignores a stale sum filter on a table holding no sum rolls', () => {
    const { svg } = build([HORDE], { filter: 'sum' });
    expect(svg).toContain(POOL_BOARD);
  });
});

describe('buildTargetHitSvg curves', () => {
  it('plots the sum rolls even while the filter hides them', () => {
    const { svg } = build([SWORD, HORDE], { subView: 'curves', filter: 'pool' });
    expect(countOf(svg, '<polyline')).toBe(1);
    expect(svg).toContain('>Sword</text>');
  });

  it('says so when no roll adds into a total', () => {
    const { svg } = build([HORDE], { subView: 'curves' });
    expect(svg).toContain('Curves compare rolls that add into a total.');
    expect(svg).not.toContain('<polyline');
  });

  it('draws the curves with no target of either kind set', () => {
    const { svg } = build([SWORD, HORDE], {
      subView: 'curves',
      target: { values: [], ruling: 'gte' },
      poolTargets: [],
    });
    expect(countOf(svg, '<polyline')).toBe(1);
    expect(svg).not.toContain('Add a target');
  });

  it('leaves the reliability legend out, having no cell washes to key', () => {
    const { svg } = build([SWORD], { subView: 'curves' });
    expect(svg).not.toContain(LEGEND_TEXT);
  });
});

describe('buildTargetHitSvg grid sort', () => {
  // 2d6+0, +3 and +6 against 12: 1/36, 10/36 and 26/36. Table order matches
  // neither ranking, so a sorted board cannot pass by accident.
  const LOW = sumRoll('Low', 0);
  const MID = sumRoll('Mid', 3);
  const HIGH = sumRoll('High', 6);
  const three = [MID, HIGH, LOW];
  const twelve: TargetState = { values: [12], ruling: 'gte' };

  it('puts the likeliest roll first for a descending numeric sort', () => {
    const { svg } = build(three, {
      target: twelve,
      poolTargets: [],
      sort: { key: 'num-12', dir: 'desc' },
    });
    expect(positionOf(svg, 'High')).toBeLessThan(positionOf(svg, 'Mid'));
    expect(positionOf(svg, 'Mid')).toBeLessThan(positionOf(svg, 'Low'));
  });

  it('puts the least likely roll first for an ascending numeric sort', () => {
    const { svg } = build(three, {
      target: twelve,
      poolTargets: [],
      sort: { key: 'num-12', dir: 'asc' },
    });
    expect(positionOf(svg, 'Low')).toBeLessThan(positionOf(svg, 'Mid'));
    expect(positionOf(svg, 'Mid')).toBeLessThan(positionOf(svg, 'High'));
  });

  it('keeps table order for a sort on a column that is gone', () => {
    const { svg } = build(three, {
      target: twelve,
      poolTargets: [],
      sort: { key: 'num-99', dir: 'desc' },
    });
    expect(positionOf(svg, 'Mid')).toBeLessThan(positionOf(svg, 'High'));
    expect(positionOf(svg, 'High')).toBeLessThan(positionOf(svg, 'Low'));
  });

  it('leads with the pool board when the sort is on a pool column', () => {
    const { svg } = build([SWORD, HORDE], { sort: { key: 'pool-2', dir: 'desc' } });
    expect(positionOf(svg, POOL_BOARD)).toBeLessThan(positionOf(svg, SUM_BOARD));
  });

  it('leads with the sum board when the sort is on a numeric column', () => {
    const { svg } = build([SWORD, HORDE], { sort: { key: 'num-8', dir: 'desc' } });
    expect(positionOf(svg, SUM_BOARD)).toBeLessThan(positionOf(svg, POOL_BOARD));
  });

  it('leads with the sum board when nothing is sorted', () => {
    const { svg } = build([SWORD, HORDE], { sort: null });
    expect(positionOf(svg, SUM_BOARD)).toBeLessThan(positionOf(svg, POOL_BOARD));
  });
});

describe('buildTargetHitSvg row cap', () => {
  // Twenty-six rolls whose best odds sit at the end of the table: 2d6+n only
  // reaches 20 once n is large. Capping in table order would cut exactly those.
  const many = Array.from({ length: 26 }, (_, n) => sumRoll(`Roll ${n}`, n));
  const ranked: Partial<Omit<TargetHitCardOptions, 'rows'>> = {
    target: { values: [20], ruling: 'gte' },
    poolTargets: [],
    sort: { key: 'num-20', dir: 'desc' },
  };

  it('keeps a top-ranked roll that sits at the end of the table', () => {
    const { svg } = build(many, ranked);
    expect(svg).toContain('>Roll 25</text>');
    expect(svg).toContain('>Roll 24</text>');
  });

  it('draws no more rolls than the cap allows', () => {
    const { svg } = build(many, ranked);
    const shown = many.filter((expr) => svg.includes(`>${expr.name}</text>`));
    expect(shown).toHaveLength(ROW_CAP);
  });

  it('says in the footer how many of the rolls it showed', () => {
    const { svg } = build(many, ranked);
    expect(svg).toContain('>showing the top 24 of 26 rolls</text>');
  });

  it('calls them the first rolls when no sort is ranking them', () => {
    const { svg } = build(many, { ...ranked, sort: null });
    expect(svg).toContain('>showing the first 24 of 26 rolls</text>');
  });

  it('marks the board with the rolls it cut', () => {
    const { svg } = build(many, ranked);
    expect(svg).toContain('>+2 more not shown</text>');
  });
});

describe('buildTargetHitSvg stub sentence', () => {
  // Twenty sum rolls with no number target beside twelve pool rolls with one.
  // The cap keeps 15 of the sums, and the stub must not report that number.
  const mixed = [
    ...Array.from({ length: 20 }, (_, n) => sumRoll(`Sum ${n}`, n)),
    ...Array.from({ length: 12 }, (_, n) => poolRoll(`Pool ${n}`, n + 1)),
  ];
  const noNumberTarget: Partial<Omit<TargetHitCardOptions, 'rows'>> = {
    target: { values: [], ruling: 'gte' },
    poolTargets: [2],
  };

  it('counts every sum roll in the stub, not only the ones the cap kept', () => {
    const { svg } = build(mixed, noNumberTarget);
    expect(svg).toContain(
      '20 sum rolls are not shown. Add a number target to measure them.',
    );
    expect(svg).not.toContain('15 sum rolls');
  });

  it('writes the stub in the singular for a single roll', () => {
    const { svg } = build([SWORD, HORDE], noNumberTarget);
    expect(svg).toContain(
      '1 sum roll is not shown. Add a number target to measure it.',
    );
  });

  it('asks for a success target when the pool rolls have none', () => {
    const { svg } = build([SWORD, HORDE], { poolTargets: [] });
    expect(svg).toContain(
      '1 pool roll is not shown. Add a success target to measure it.',
    );
  });

  it('draws at most one stub, whichever kind is missing its target', () => {
    const { svg } = build([SWORD, HORDE], noNumberTarget);
    expect(countOf(svg, ' not shown. Add ')).toBe(1);
    expect(svg).not.toContain('pool roll is not shown');
  });

  it('keeps the stub clear of the reliability legend it sits under', () => {
    const { svg } = build(mixed, noNumberTarget);
    expect(svg).toContain(LEGEND_TEXT);
    const stub = yOfText(
      svg,
      '20 sum rolls are not shown. Add a number target to measure them.',
    );
    expect(stub).toBeGreaterThan(yOfText(svg, LEGEND_TEXT) + LEGEND_H);
  });

  // The cap is shared out per kind rather than taken off the front of one
  // combined list, so a kind that owns a target always keeps at least one row.
  // Without that, a table of many sum rolls beside one pool roll could cap the
  // pool roll away and leave the card with a legend, no board, and a stub
  // riding up into the heading.
  it('still draws a board when the cap falls on the only roll of its kind', () => {
    const lopsided = [
      ...Array.from({ length: 25 }, (_, n) => sumRoll(`Sum ${n}`, n)),
      poolRoll('Lonely', 5),
    ];
    const { svg } = build(lopsided, {
      target: { values: [], ruling: 'gte' },
      poolTargets: [2],
    });
    expect(svg).toContain('POOL ROLLS, MEASURED IN SUCCESSES');
    expect(svg).toContain('Lonely');
    const stub = yOfText(
      svg,
      '25 sum rolls are not shown. Add a number target to measure them.',
    );
    expect(stub).toBeGreaterThan(yOfText(svg, 'CHANCE OF HITTING EACH TARGET'));
  });
});

describe('buildTargetHitSvg empty states', () => {
  it('asks for a roll when the table holds none', () => {
    const image = build([]);
    expect(image.svg).toContain(
      'Add a roll with valid dice to see hit chances against your targets.',
    );
    expect(image.height).toBe(SHELL_HEIGHT + EMPTY_H);
  });

  it('asks for a target when neither kind has one', () => {
    const image = build([SWORD, HORDE], {
      target: { values: [], ruling: 'gte' },
      poolTargets: [],
    });
    expect(image.svg).toContain(
      'Add a target to see how likely each roll is to hit it.',
    );
    expect(image.height).toBe(SHELL_HEIGHT + EMPTY_H);
  });

  it('asks for a roll before it asks for a target', () => {
    const { svg } = build([], {
      target: { values: [], ruling: 'gte' },
      poolTargets: [],
    });
    expect(svg).toContain('Add a roll with valid dice');
    expect(svg).not.toContain('Add a target');
  });
});

describe('buildTargetHitSvg safety', () => {
  it('resolves every theme token to a literal colour in all three layouts', () => {
    for (const subView of ['grid', 'bars', 'curves'] as const) {
      for (const theme of ['light', 'dark'] as const) {
        const { svg } = build([SWORD, HORDE], { subView, theme });
        expect(svg).not.toMatch(/hit\.|purple\.|colorPalette/);
      }
    }
  });

  it('escapes a row name that looks like markup', () => {
    const nasty = { ...sumRoll('Ork', 3), name: `<b>Ork's</b> & "axe"` };
    const { svg } = build([nasty]);
    expect(svg).toContain('&lt;b&gt;Ork&apos;s&lt;/b&gt; &amp; &quot;axe&quot;');
    expect(svg).not.toContain('<b>');
  });

  it('escapes a row name that tries to close the card in the bars layout', () => {
    const nasty = { ...sumRoll('Ork', 3), name: '</svg><script>' };
    const { svg } = build([nasty], { subView: 'bars' });
    expect(svg).toContain('&lt;/svg&gt;&lt;script&gt;');
    expect(countOf(svg, '</svg>')).toBe(1);
  });

  it('escapes a row name in the curves legend', () => {
    const nasty = { ...sumRoll('Ork', 3), name: '</svg><script>' };
    const { svg } = build([nasty], { subView: 'curves' });
    expect(svg).toContain('&lt;/svg&gt;&lt;script&gt;');
    expect(countOf(svg, '</svg>')).toBe(1);
  });
});
