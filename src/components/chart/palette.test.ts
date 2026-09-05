import { describe, expect, it } from 'vitest';
import {
  hitColor,
  hitWeight,
  rowColor,
  seriesDash,
  SHARE_CARD_DARK,
  SHARE_CARD_LIGHT,
  shareCardPalette,
} from './palette';

// Written out by hand rather than read back from the module: the point of these
// tests is to catch the shipped tables changing, so an assertion sourced from
// the tables themselves would agree with any mistake made in them.
const EXPECTED_DASHES = ['0', '7 4', '2 4', '9 4 2 4', '5 5', '1 4', '12 5', '4 4'] as const;
const EXPECTED_COLORS = [
  '#2563eb',
  '#ea580c',
  '#16a34a',
  '#9333ea',
  '#db2777',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
] as const;

const TABLE_LENGTH = 8;

describe('seriesDash', () => {
  it('draws the first series solid', () => {
    expect(seriesDash(0)).toBe('0');
  });

  it('gives each of the first eight series its own dash', () => {
    const dashes = Array.from({ length: TABLE_LENGTH }, (_, i) => seriesDash(i));
    expect(dashes).toEqual([...EXPECTED_DASHES]);
    expect(new Set(dashes).size).toBe(TABLE_LENGTH);
  });

  it('wraps back to the first dash past the end of the table', () => {
    expect(seriesDash(TABLE_LENGTH)).toBe(EXPECTED_DASHES[0]);
    // Index 9 lands on a dashed entry, so a lookup that ran off the end and
    // fell back to solid cannot pass this the way index 8 alone would.
    expect(seriesDash(TABLE_LENGTH + 1)).toBe(EXPECTED_DASHES[1]);
  });

  it('keeps wrapping for an index far past the end of the table', () => {
    expect(seriesDash(TABLE_LENGTH * 3 + 2)).toBe(EXPECTED_DASHES[2]);
  });

  it('counts a negative index back from the end of the table', () => {
    expect(seriesDash(-1)).toBe(EXPECTED_DASHES[7]);
  });

  it('counts back a whole table and more for a far negative index', () => {
    expect(seriesDash(-9)).toBe(EXPECTED_DASHES[7]);
    expect(seriesDash(-TABLE_LENGTH)).toBe(EXPECTED_DASHES[0]);
    expect(seriesDash(-TABLE_LENGTH - 3)).toBe(EXPECTED_DASHES[5]);
  });
});

describe('rowColor', () => {
  it('gives each of the first eight rows its own color', () => {
    const colors = Array.from({ length: TABLE_LENGTH }, (_, i) => rowColor(i));
    expect(colors).toEqual([...EXPECTED_COLORS]);
    expect(new Set(colors).size).toBe(TABLE_LENGTH);
  });

  it('wraps back to the first color past the end of the palette', () => {
    expect(rowColor(TABLE_LENGTH)).toBe(EXPECTED_COLORS[0]);
    expect(rowColor(TABLE_LENGTH + 1)).toBe(EXPECTED_COLORS[1]);
  });

  it('counts a negative index back from the end of the palette', () => {
    expect(rowColor(-1)).toBe(EXPECTED_COLORS[7]);
    expect(rowColor(-13)).toBe(EXPECTED_COLORS[3]);
  });
});

describe('hitColor', () => {
  it('calls a two-thirds-or-better chance good', () => {
    expect(hitColor(0.66)).toBe('hit.good');
    expect(hitColor(0.9)).toBe('hit.good');
    expect(hitColor(1)).toBe('hit.good');
  });

  it('calls the band from one third up to two thirds mid', () => {
    expect(hitColor(0.33)).toBe('hit.mid');
    expect(hitColor(0.5)).toBe('hit.mid');
    expect(hitColor(0.6599)).toBe('hit.mid');
  });

  it('calls anything under one third bad', () => {
    expect(hitColor(0.3299)).toBe('hit.bad');
    expect(hitColor(0.1)).toBe('hit.bad');
    expect(hitColor(0)).toBe('hit.bad');
  });
});

describe('hitWeight', () => {
  it('climbs with the percentage so the bands read without colour', () => {
    expect(hitWeight(0)).toBe('normal');
    expect(hitWeight(0.3299)).toBe('normal');
    expect(hitWeight(0.33)).toBe('medium');
    expect(hitWeight(0.6599)).toBe('medium');
    expect(hitWeight(0.66)).toBe('semibold');
    expect(hitWeight(1)).toBe('semibold');
  });

  it('changes band on exactly the thresholds hitColor uses', () => {
    for (const p of [0, 0.2, 0.33, 0.5, 0.66, 0.8, 1]) {
      const sameBand =
        (hitColor(p) === 'hit.bad' && hitWeight(p) === 'normal') ||
        (hitColor(p) === 'hit.mid' && hitWeight(p) === 'medium') ||
        (hitColor(p) === 'hit.good' && hitWeight(p) === 'semibold');
      expect(sameBand).toBe(true);
    }
  });
});

describe('shareCardPalette', () => {
  it('hands back the dark card for the dark theme', () => {
    expect(shareCardPalette('dark')).toBe(SHARE_CARD_DARK);
  });

  it('hands back the light card for the light theme', () => {
    expect(shareCardPalette('light')).toBe(SHARE_CARD_LIGHT);
    expect(shareCardPalette('light').background).toBe('#ffffff');
  });

  it('keeps text readable against the background in both cards', () => {
    expect(SHARE_CARD_LIGHT.text).not.toBe(SHARE_CARD_LIGHT.background);
    expect(SHARE_CARD_DARK.text).not.toBe(SHARE_CARD_DARK.background);
    expect(SHARE_CARD_DARK.background).not.toBe(SHARE_CARD_LIGHT.background);
    expect(SHARE_CARD_DARK.text).not.toBe(SHARE_CARD_LIGHT.text);
  });

  it.each(['light', 'dark'] as const)(
    'ships every %s card colour as a six-digit lowercase hex literal',
    (theme) => {
      // The card is rasterised outside the Chakra theme, so a token such as
      // 'bg.panel' or a #fff shorthand would reach the PNG as an invalid colour.
      for (const [role, color] of Object.entries(shareCardPalette(theme))) {
        expect(color, `${theme} ${role}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    },
  );
});
