import { describe, expect, it } from 'vitest';
import { buildRollOffSvg, type RollOffCardRow } from './buildRollOffSvg';
import { winChances } from '../../engine/compare';
import { toCompareRows } from '../../components/compare/compareRows';
import { expressionNotation } from '../notation';
import { rowColor } from '../../components/chart/palette';
import type { Expression } from '../../types';

// Card geometry, restated here so the expected numbers below are arithmetic a
// reader can follow rather than a copy of whatever the module happens to emit.
const CARD_WIDTH = 920;
// padding*2 (56) + panel heading (22) + headline (24) + footer (34), before a
// single track is drawn and with no title band.
const BASE_HEIGHT = 136;
const TRACK = 52;
const TITLE_HEIGHT = 42;
// The bar spans x=300 to x=760, so the top win fills 460px of track.
const FULL_BAR = 460;
// The headline is drawn 14px into the band that follows the panel heading:
// 28 (padding) + 22 (heading) + 14.
const HEADLINE_Y = 64;
// The same slot pushed down by the title band.
const TITLED_HEADLINE_Y = HEADLINE_Y + TITLE_HEIGHT;
// The too-few-rows line takes the same band 24px down: 28 + 22 + 24.
const EMPTY_Y = 74;
// The light card's grid colour, which paints the empty track under every bar.
const LIGHT_TRACK = '#e3e0d8';

/** Win and tie are stated rather than derived, so the card's own arithmetic is
 * the only thing under test. The colour index doubles as the table position. */
function cardRow(
  name: string,
  win: number,
  tie: number,
  index: number,
): RollOffCardRow {
  return {
    id: `row-${index}`,
    name,
    notation: `${index + 1}d6`,
    color: rowColor(index),
    win,
    tie,
  };
}

/** Table order deliberately differs from win order: the winner sits second. */
function threeRows(): RollOffCardRow[] {
  return [
    cardRow('Bravo', 0.3, 0, 0),
    cardRow('Alpha', 0.6, 0, 1),
    cardRow('Cormac', 0.1, 0, 2),
  ];
}

function textAt(svg: string, y: number): string[] {
  return [...svg.matchAll(/<text x="[\d.]+" y="([\d.]+)"[^>]*>([^<]*)<\/text>/g)]
    .filter((m) => m[1] === String(y))
    .map((m) => m[2] ?? '');
}

function headlineOf(svg: string): string | undefined {
  return textAt(svg, HEADLINE_Y)[0];
}

interface DrawnRow {
  name: string;
  weight: string;
}

/** Row names in draw order, with the weight that marks the winner. */
function drawnRows(svg: string): DrawnRow[] {
  return [
    ...svg.matchAll(
      /<text x="48" y="[\d.]+" font-family="[^"]*" font-size="13" font-weight="(\d+)" fill="[^"]*">([^<]*)<\/text>/g,
    ),
  ].map((m) => ({ name: m[2] ?? '', weight: m[1] ?? '' }));
}

function drawnNotations(svg: string): string[] {
  return [
    ...svg.matchAll(
      /<text x="48" y="[\d.]+" font-family="[^"]*" font-size="11" fill="[^"]*">([^<]*)<\/text>/g,
    ),
  ].map((m) => m[1] ?? '');
}

function winLabels(svg: string): string[] {
  return [
    ...svg.matchAll(
      /<text x="892" y="[\d.]+" text-anchor="end" font-family="[^"]*" font-size="15"[^>]*>([^<]*)<\/text>/g,
    ),
  ].map((m) => m[1] ?? '');
}

// The footer aside is right-aligned at the same x, so the tie line is picked out
// by its monospace face.
function tieLabels(svg: string): string[] {
  return [
    ...svg.matchAll(
      /<text x="892" y="[\d.]+" text-anchor="end" font-family="ui-monospace[^"]*" font-size="11"[^>]*>([^<]*)<\/text>/g,
    ),
  ].map((m) => m[1] ?? '');
}

interface Bar {
  width: number;
  fill: string;
}

function bars(svg: string): Bar[] {
  return [
    ...svg.matchAll(
      /<rect x="300" y="[\d.]+" width="([\d.]+)" height="16" rx="8" fill="([^"]+)"\/>/g,
    ),
  ].map((m) => ({ width: Number(m[1]), fill: m[2] ?? '' }));
}

/** Only the coloured fills, dropping the empty track each row draws first. */
function fillWidths(svg: string): number[] {
  return bars(svg)
    .filter((b) => b.fill !== LIGHT_TRACK)
    .map((b) => b.width);
}

function trackCount(svg: string): number {
  return bars(svg).filter((b) => b.fill === LIGHT_TRACK).length;
}

/** A plain 1d2. Two of them are perfectly even: each rolls higher a quarter of
 * the time and they land equal the other half. */
function d2(id: string, name: string): Expression {
  return {
    id,
    name,
    parts: [{ id: `${id}-part`, count: 1, sides: 2 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
}

describe('buildRollOffSvg order', () => {
  it('draws the highest win first when the order is win chance', () => {
    const image = buildRollOffSvg({
      rows: threeRows(),
      order: 'win',
      theme: 'light',
    });
    expect(drawnRows(image.svg).map((r) => r.name)).toEqual([
      'Alpha',
      'Bravo',
      'Cormac',
    ]);
  });

  it('keeps the given order when the order is table', () => {
    const image = buildRollOffSvg({
      rows: threeRows(),
      order: 'table',
      theme: 'light',
    });
    expect(drawnRows(image.svg).map((r) => r.name)).toEqual([
      'Bravo',
      'Alpha',
      'Cormac',
    ]);
  });

  it('carries each row own win chance into whichever slot draws it', () => {
    const image = buildRollOffSvg({
      rows: threeRows(),
      order: 'table',
      theme: 'light',
    });
    expect(winLabels(image.svg)).toEqual(['30.0%', '60.0%', '10.0%']);
  });

  it('carries each row own notation into whichever slot draws it', () => {
    const image = buildRollOffSvg({
      rows: threeRows(),
      order: 'win',
      theme: 'light',
    });
    expect(drawnNotations(image.svg)).toEqual(['2d6', '1d6', '3d6']);
  });
});

describe('buildRollOffSvg winner emphasis', () => {
  it('draws the winner semibold when the win order puts it first', () => {
    const image = buildRollOffSvg({
      rows: threeRows(),
      order: 'win',
      theme: 'light',
    });
    expect(drawnRows(image.svg).map((r) => r.weight)).toEqual([
      '600',
      '400',
      '400',
    ]);
  });

  it('still draws the winner semibold when the table order buries it', () => {
    const image = buildRollOffSvg({
      rows: threeRows(),
      order: 'table',
      theme: 'light',
    });
    expect(drawnRows(image.svg).map((r) => r.weight)).toEqual([
      '400',
      '600',
      '400',
    ]);
  });

  it('names the highest win in the headline whichever order draws the rows', () => {
    for (const order of ['win', 'table'] as const) {
      const image = buildRollOffSvg({ rows: threeRows(), order, theme: 'light' });
      expect(headlineOf(image.svg)).toBe(
        'Alpha is most likely to come out on top.',
      );
    }
  });

  it('scales the bars off the highest win when the table order buries it', () => {
    const image = buildRollOffSvg({
      rows: threeRows(),
      order: 'table',
      theme: 'light',
    });
    // Half the top win of 60% is half the track, and a sixth of it is 76.67px.
    expect(fillWidths(image.svg)).toEqual([FULL_BAR / 2, FULL_BAR, 76.67]);
  });
});

describe('buildRollOffSvg headline', () => {
  it('names a clear leader', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(headlineOf(image.svg)).toBe(
      'Alpha is most likely to come out on top.',
    );
  });

  it('calls a gap under one percentage point a coin flip', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.4, 0, 0), cardRow('Bravo', 0.395, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(headlineOf(image.svg)).toBe(
      'It’s nearly a coin flip between Alpha and Bravo.',
    );
  });

  it('names a leader once the gap clears a full percentage point', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.5, 0, 0), cardRow('Bravo', 0.49, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(headlineOf(image.svg)).toBe(
      'Alpha is most likely to come out on top.',
    );
  });

  it('names the coin flip pair in win order, not table order', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Bravo', 0.395, 0, 0), cardRow('Alpha', 0.4, 0, 1)],
      order: 'table',
      theme: 'light',
    });
    expect(headlineOf(image.svg)).toBe(
      'It’s nearly a coin flip between Alpha and Bravo.',
    );
  });

  // Nobody wins outright, so naming a favourite would be a lie and calling it a
  // coin flip would invent a race that never happens.
  it('says the rolls almost always tie when nobody ever wins outright', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0, 1, 0), cardRow('Bravo', 0, 1, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(headlineOf(image.svg)).toBe('These rolls almost always tie.');
  });

  it('says the rolls almost always tie for a top win under half a percent', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.004, 0.99, 0), cardRow('Bravo', 0.001, 0.99, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(headlineOf(image.svg)).toBe('These rolls almost always tie.');
  });

  it('drops the almost-always-tie line once the top win reaches half a percent', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.005, 0.99, 0), cardRow('Bravo', 0, 0.99, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(headlineOf(image.svg)).toBe(
      'It’s nearly a coin flip between Alpha and Bravo.',
    );
  });

  it('leaves the headline out when there is nothing to race', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 1, 0, 0)],
      order: 'win',
      theme: 'light',
    });
    expect(image.svg).not.toContain('most likely to come out on top');
  });
});

describe('buildRollOffSvg headline name budget', () => {
  it('cuts a leader name longer than twenty-four characters', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('a'.repeat(40), 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(headlineOf(image.svg)).toBe(
      `${'a'.repeat(23)}… is most likely to come out on top.`,
    );
  });

  it('leaves a leader name of exactly twenty-four characters whole', () => {
    const name = 'a'.repeat(24);
    const image = buildRollOffSvg({
      rows: [cardRow(name, 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(headlineOf(image.svg)).toBe(
      `${name} is most likely to come out on top.`,
    );
  });

  it('cuts both names in the coin flip sentence', () => {
    const image = buildRollOffSvg({
      rows: [
        cardRow('a'.repeat(40), 0.4, 0, 0),
        cardRow('b'.repeat(40), 0.395, 0, 1),
      ],
      order: 'win',
      theme: 'light',
    });
    expect(headlineOf(image.svg)).toBe(
      `It’s nearly a coin flip between ${'a'.repeat(23)}… and ${'b'.repeat(23)}….`,
    );
  });
});

describe('buildRollOffSvg tie line', () => {
  it('prints a ties line for a tie of half a percent', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.6, 0.005, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(tieLabels(image.svg)).toEqual(['ties 0.5%']);
  });

  it('prints nothing for a tie just under half a percent', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.6, 0.004, 0), cardRow('Bravo', 0.3, 0.004, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(tieLabels(image.svg)).toEqual([]);
  });

  it('prints a ties line beside every row that has one', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.6, 0.125, 0), cardRow('Bravo', 0.3, 0.25, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(tieLabels(image.svg)).toEqual(['ties 12.5%', 'ties 25.0%']);
  });
});

describe('buildRollOffSvg bars', () => {
  it('fills the whole track for the highest win', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(fillWidths(image.svg)).toEqual([FULL_BAR, FULL_BAR / 2]);
  });

  it('paints each bar in the colour the table gave the row', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(bars(image.svg).map((b) => b.fill)).toEqual([
      LIGHT_TRACK,
      '#2563eb',
      LIGHT_TRACK,
      '#ea580c',
    ]);
  });

  it('draws the empty track and no fill for a win of exactly zero', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.6, 0, 0), cardRow('Never', 0, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(trackCount(image.svg)).toBe(2);
    expect(fillWidths(image.svg)).toEqual([FULL_BAR]);
    // The second track is left bare: its own colour never reaches the bar.
    expect(bars(image.svg).map((b) => b.fill)).toEqual([
      LIGHT_TRACK,
      '#2563eb',
      LIGHT_TRACK,
    ]);
  });

  it('still labels a win of exactly zero', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.6, 0, 0), cardRow('Never', 0, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(winLabels(image.svg)).toEqual(['60.0%', '0.0%']);
  });

  it('keeps a visible sliver for a tiny but real win', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.6, 0, 0), cardRow('Faint', 1e-6, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(fillWidths(image.svg)).toEqual([FULL_BAR, 2]);
  });
});

describe('buildRollOffSvg too few rows', () => {
  it('asks for a second roll when only one row can be raced', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 1, 0, 0)],
      order: 'win',
      theme: 'light',
    });
    expect(textAt(image.svg, EMPTY_Y)).toEqual([
      'Add at least two rolls with valid dice to start the roll-off.',
    ]);
  });

  it('asks for two rolls when the table has none at all', () => {
    const image = buildRollOffSvg({ rows: [], order: 'win', theme: 'light' });
    expect(textAt(image.svg, EMPTY_Y)).toEqual([
      'Add at least two rolls with valid dice to start the roll-off.',
    ]);
  });

  it('draws no row and no track for a single roll', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 1, 0, 0)],
      order: 'win',
      theme: 'light',
    });
    expect(drawnRows(image.svg)).toEqual([]);
    expect(bars(image.svg)).toEqual([]);
  });
});

describe('buildRollOffSvg card size', () => {
  it('draws two rows at the fixed card width', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(image.width).toBe(CARD_WIDTH);
    expect(image.height).toBe(BASE_HEIGHT + TRACK * 2);
    expect(image.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" ')).toBe(
      true,
    );
    expect(image.svg).toContain('viewBox="0 0 920 240"');
  });

  it('grows the card by one track for every extra row', () => {
    const image = buildRollOffSvg({
      rows: threeRows(),
      order: 'win',
      theme: 'light',
    });
    expect(image.height).toBe(BASE_HEIGHT + TRACK * 3);
  });

  it('keeps a track of room for the too-few-rows line', () => {
    const image = buildRollOffSvg({ rows: [], order: 'win', theme: 'light' });
    expect(image.height).toBe(BASE_HEIGHT + TRACK);
  });

  it('pushes the headline down under a title band', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('Alpha', 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
      title: 'Opposed rolls',
    });
    expect(image.height).toBe(BASE_HEIGHT + TRACK * 2 + TITLE_HEIGHT);
    expect(textAt(image.svg, TITLED_HEADLINE_Y)).toEqual([
      'Alpha is most likely to come out on top.',
    ]);
  });
});

describe('buildRollOffSvg footer', () => {
  const rows = [cardRow('Alpha', 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)];

  it('adds the scale caveat when the table mixes scales', () => {
    const image = buildRollOffSvg({
      rows,
      order: 'win',
      theme: 'light',
      mixedScales: true,
    });
    expect(image.svg).toContain(
      '>Pool rows are counted in successes, not totals</text>',
    );
  });

  it('leaves the scale caveat out when the scales agree', () => {
    const image = buildRollOffSvg({
      rows,
      order: 'win',
      theme: 'light',
      mixedScales: false,
    });
    expect(image.svg).not.toContain('Pool rows are counted');
  });

  it('leaves the scale caveat out when nothing says the scales are mixed', () => {
    const image = buildRollOffSvg({ rows, order: 'win', theme: 'light' });
    expect(image.svg).not.toContain('Pool rows are counted');
  });

  it('joins the caveat onto a note the card was already carrying', () => {
    const image = buildRollOffSvg({
      rows,
      order: 'win',
      theme: 'light',
      note: '1 roll left out (nothing to measure)',
      mixedScales: true,
    });
    expect(image.svg).toContain(
      '>1 roll left out (nothing to measure). Pool rows are counted in successes, not totals</text>',
    );
  });
});

describe('buildRollOffSvg escaping and truncation', () => {
  it('escapes a row name that looks like markup', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('<b>Alpha</b>', 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(image.svg).toContain('&lt;b&gt;Alpha&lt;/b&gt;');
    expect(image.svg).not.toContain('<b>');
  });

  it('escapes a name that reaches the headline too', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('<b>Alpha</b>', 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(image.svg).toContain(
      '&lt;b&gt;Alpha&lt;/b&gt; is most likely to come out on top.',
    );
  });

  it('escapes an apostrophe in a row name', () => {
    const image = buildRollOffSvg({
      rows: [cardRow("Ork's axe", 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(drawnRows(image.svg)[0]?.name).toBe('Ork&apos;s axe');
  });

  it('escapes a notation that looks like markup', () => {
    const row = { ...cardRow('Alpha', 0.6, 0, 0), notation: '<b>2d6</b> & "x"' };
    const image = buildRollOffSvg({
      rows: [row, cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(drawnNotations(image.svg)[0]).toBe(
      '&lt;b&gt;2d6&lt;/b&gt; &amp; &quot;x&quot;',
    );
  });

  it('cuts a row name longer than twenty-six characters', () => {
    const image = buildRollOffSvg({
      rows: [cardRow('b'.repeat(40), 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(drawnRows(image.svg)[0]?.name).toBe(`${'b'.repeat(25)}…`);
  });

  it('leaves a row name of exactly twenty-six characters whole', () => {
    const name = 'b'.repeat(26);
    const image = buildRollOffSvg({
      rows: [cardRow(name, 0.6, 0, 0), cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(drawnRows(image.svg)[0]?.name).toBe(name);
  });

  it('cuts a notation longer than thirty-four characters', () => {
    const row = { ...cardRow('Alpha', 0.6, 0, 0), notation: 'd'.repeat(40) };
    const image = buildRollOffSvg({
      rows: [row, cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(drawnNotations(image.svg)[0]).toBe(`${'d'.repeat(33)}…`);
  });

  it('leaves a notation of exactly thirty-four characters whole', () => {
    const notation = 'd'.repeat(34);
    const row = { ...cardRow('Alpha', 0.6, 0, 0), notation };
    const image = buildRollOffSvg({
      rows: [row, cardRow('Bravo', 0.3, 0, 1)],
      order: 'win',
      theme: 'light',
    });
    expect(drawnNotations(image.svg)[0]).toBe(notation);
  });

  // A cut through a surrogate pair leaves a lone surrogate, and
  // encodeURIComponent refuses it while rasterizing.
  it('cuts a name by whole characters so an emoji cannot be split', () => {
    const image = buildRollOffSvg({
      rows: [
        cardRow(`${'b'.repeat(24)}😀${'b'.repeat(5)}`, 0.6, 0, 0),
        cardRow('Bravo', 0.3, 0, 1),
      ],
      order: 'win',
      theme: 'light',
    });
    expect(drawnRows(image.svg)[0]?.name).toBe(`${'b'.repeat(24)}😀…`);
    expect(() => encodeURIComponent(image.svg)).not.toThrow();
  });
});

describe('buildRollOffSvg against the engine', () => {
  it('prints the win and tie chances the engine computes for two even rolls', () => {
    const compared = toCompareRows([d2('a', 'Alpha'), d2('b', 'Bravo')]);
    const chances = winChances(compared.map((r) => r.dist));
    // Two 1d2: each is higher on 2 against 1, a quarter of the time, and they
    // land equal the other half.
    expect(chances[0]?.win).toBeCloseTo(0.25, 12);
    expect(chances[0]?.tie).toBeCloseTo(0.5, 12);

    const image = buildRollOffSvg({
      rows: compared.map((r, i) => ({
        id: r.expr.id,
        name: r.expr.name,
        notation: expressionNotation(r.expr),
        color: r.color,
        win: chances[i]?.win ?? 0,
        tie: chances[i]?.tie ?? 0,
      })),
      order: 'win',
      theme: 'light',
    });
    expect(winLabels(image.svg)).toEqual(['25.0%', '25.0%']);
    expect(tieLabels(image.svg)).toEqual(['ties 50.0%', 'ties 50.0%']);
    expect(headlineOf(image.svg)).toBe(
      'It’s nearly a coin flip between Alpha and Bravo.',
    );
    expect(fillWidths(image.svg)).toEqual([FULL_BAR, FULL_BAR]);
  });
});
