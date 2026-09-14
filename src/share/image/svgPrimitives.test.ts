import { describe, expect, it } from 'vitest';
import {
  MIXED_SCALE_CARD_NOTE,
  formatCardPercent,
  headerHeight,
  panelHeading,
  renderCard,
  round,
  rowSwatch,
  scaleFor,
  type CardShellOptions,
} from './svgPrimitives';
import { shareCardPalette } from '../../components/chart/palette';

// Card geometry, restated here so the expected numbers below are arithmetic a
// reader can follow rather than a copy of whatever the module happens to emit.
const CARD_WIDTH = 920;
const PADDING = 28;
// The band a non-blank title reserves above the first panel.
const TITLE_HEIGHT = 42;
// The height every card in this file is drawn at, and the two baselines that
// follow from it: the title sits 22px below the top padding, and the footer
// line 22px above the bottom edge (the 28px padding, less the 6px the text is
// nudged back down by).
const HEIGHT = 200;
const TITLE_BASELINE = PADDING + 22;
const FOOTER_BASELINE = HEIGHT - PADDING + 6;
// The footer aside is anchored to the far padding: 920 - 28.
const NOTE_RIGHT = CARD_WIDTH - PADDING;
// Text budgets, counted in code points and including the ellipsis.
const TITLE_BUDGET = 70;
const NOTE_BUDGET = 120;

const LIGHT = shareCardPalette('light');

/** A card with nothing on it, so each test only has to say what it changes. */
function card(options: Partial<CardShellOptions> = {}) {
  return renderCard({
    palette: LIGHT,
    height: HEIGHT,
    scale: 1,
    title: '',
    note: '',
    body: [],
    ...options,
  });
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('renderCard shell', () => {
  it('paints the ground rect at the height it was handed', () => {
    const { svg } = card({ height: 260 });
    expect(svg).toContain('<rect x="0" y="0" width="920" height="260" fill="#f2f1ed"/>');
  });

  it('paints the ground in the palette it was handed', () => {
    const { svg } = card({ palette: shareCardPalette('dark') });
    expect(svg).toContain(`width="920" height="${HEIGHT}" fill="#131519"/>`);
  });

  it('credits the app even on a card with nothing drawn on it', () => {
    const { svg } = card();
    expect(svg).toContain('>built with dice-table.app</text>');
  });

  it('sets the credit on the footer baseline at the left padding', () => {
    const { svg } = card();
    expect(svg).toContain(`<text x="${PADDING}" y="${FOOTER_BASELINE}" `);
  });

  it('credits the app exactly once', () => {
    const { svg } = card({ title: 'Attack', note: 'pools left out' });
    expect(countOf(svg, 'built with dice-table.app')).toBe(1);
  });

  it('copies the body parts into the card verbatim', () => {
    const { svg } = card({
      body: ['<rect id="panel" width="4" height="4"/>', '<text>drawn</text>'],
    });
    expect(svg).toContain('<rect id="panel" width="4" height="4"/>');
    expect(svg).toContain('<text>drawn</text>');
  });

  it('keeps the body parts in the order it was given them', () => {
    const { svg } = card({ body: ['<g id="first"/>', '<g id="second"/>'] });
    expect(svg.indexOf('first')).toBeLessThan(svg.indexOf('second'));
  });

  it('draws the body over the ground and under the credit', () => {
    const { svg } = card({ body: ['<g id="drawing"/>'] });
    expect(svg.indexOf('<rect x="0" y="0"')).toBeLessThan(svg.indexOf('drawing'));
    expect(svg.indexOf('drawing')).toBeLessThan(svg.indexOf('built with'));
  });

  it('joins the parts with no separator between them', () => {
    const { svg } = card({ body: ['<g id="a"/>', '<g id="b"/>'] });
    expect(svg).toContain('<g id="a"/><g id="b"/>');
  });

  it('wraps the whole card in a single svg element', () => {
    const { svg } = card({ title: 'Attack', body: ['<g/>'], note: 'aside' });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" ')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(countOf(svg, '<svg')).toBe(1);
    expect(countOf(svg, '</svg>')).toBe(1);
  });

  it('writes the card size into the svg at scale one', () => {
    const { svg } = card();
    expect(svg).toContain(`width="${CARD_WIDTH}" height="${HEIGHT}"`);
  });

  it('reports the card size at scale one', () => {
    const image = card();
    expect(image.width).toBe(CARD_WIDTH);
    expect(image.height).toBe(HEIGHT);
  });

  it('multiplies both pixel sizes by the scale', () => {
    const image = card({ scale: 3 });
    expect(image.width).toBe(2760);
    expect(image.height).toBe(600);
    expect(image.svg).toContain('width="2760" height="600"');
  });

  it('shrinks the pixel size for a scale under one', () => {
    const image = card({ scale: 0.5 });
    expect(image.width).toBe(460);
    expect(image.height).toBe(100);
  });

  it('leaves the viewBox in card units whatever the scale', () => {
    for (const scale of [0.5, 1, 3]) {
      expect(card({ scale }).svg).toContain(`viewBox="0 0 ${CARD_WIDTH} ${HEIGHT}"`);
    }
  });
});

describe('renderCard title', () => {
  it('leaves the header band out when the title is blank', () => {
    const { svg } = card({ title: '' });
    expect(svg).not.toContain('font-size="20"');
  });

  // renderCard takes an already-trimmed title, and headerHeight reserves the
  // band for the same strings, so an untrimmed one is drawn rather than dropped.
  it('still draws a header band for a whitespace-only title', () => {
    const { svg } = card({ title: '   ' });
    expect(svg).toContain('font-size="20"');
  });

  it('sets the title on the header baseline at the left padding', () => {
    const { svg } = card({ title: 'Weapon pass' });
    expect(svg).toContain(`<text x="${PADDING}" y="${TITLE_BASELINE}" `);
    expect(svg).toContain('>Weapon pass</text>');
  });

  it('cuts a title past seventy characters down to an ellipsis', () => {
    const { svg } = card({ title: 'a'.repeat(TITLE_BUDGET + 10) });
    expect(svg).toContain(`>${'a'.repeat(TITLE_BUDGET - 1)}…</text>`);
    expect(svg).not.toContain('a'.repeat(TITLE_BUDGET));
  });

  it('leaves a title of exactly seventy characters whole', () => {
    const title = 'a'.repeat(TITLE_BUDGET);
    const { svg } = card({ title });
    expect(svg).toContain(`>${title}</text>`);
    expect(svg).not.toContain('…');
  });

  it('escapes a title that looks like markup', () => {
    const { svg } = card({ title: '<b>Ork\'s & "axe"</b>' });
    expect(svg).toContain('&lt;b&gt;Ork&apos;s &amp; &quot;axe&quot;&lt;/b&gt;');
    expect(svg).not.toContain('<b>');
  });
});

describe('renderCard note', () => {
  it('leaves the footer aside out when the note is blank', () => {
    const { svg } = card({ note: '' });
    expect(svg).not.toContain('text-anchor="end"');
  });

  it('anchors the note to the far padding on the footer baseline', () => {
    const { svg } = card({ note: '2 pool rolls are not in this picture' });
    expect(svg).toContain(
      `<text x="${NOTE_RIGHT}" y="${FOOTER_BASELINE}" text-anchor="end" `,
    );
    expect(svg).toContain('>2 pool rolls are not in this picture</text>');
  });

  it('cuts a note past one hundred and twenty characters down to an ellipsis', () => {
    const { svg } = card({ note: 'c'.repeat(NOTE_BUDGET + 10) });
    expect(svg).toContain(`>${'c'.repeat(NOTE_BUDGET - 1)}…</text>`);
    expect(svg).not.toContain('c'.repeat(NOTE_BUDGET));
  });

  it('leaves a note of exactly one hundred and twenty characters whole', () => {
    const note = 'c'.repeat(NOTE_BUDGET);
    const { svg } = card({ note });
    expect(svg).toContain(`>${note}</text>`);
    expect(svg).not.toContain('…');
  });

  // The budget is 120, not the 90 the footer would fit if the credit shared the
  // line evenly, so a note in the nineties has to survive whole.
  it('leaves a note of ninety characters whole', () => {
    const note = 'c'.repeat(90);
    const { svg } = card({ note });
    expect(svg).toContain(`>${note}</text>`);
    expect(svg).not.toContain('…');
  });

  it('escapes a note that looks like markup', () => {
    const { svg } = card({ note: '<b>2 pools</b>' });
    expect(svg).toContain('&lt;b&gt;2 pools&lt;/b&gt;');
    expect(svg).not.toContain('<b>');
  });
});

describe('headerHeight', () => {
  it('reserves nothing when there is no title', () => {
    expect(headerHeight('')).toBe(0);
  });

  it('reserves the header band for a real title', () => {
    expect(headerHeight('Weapon pass')).toBe(TITLE_HEIGHT);
  });

  // Agreeing with renderCard matters more than the reading: a band the card
  // draws but the height leaves out would push the footer off the bottom.
  it('reserves the band for a whitespace-only title, the way the card draws one', () => {
    expect(headerHeight('   ')).toBe(TITLE_HEIGHT);
  });
});

describe('scaleFor', () => {
  it('falls back to card size when no scale is given', () => {
    expect(scaleFor(undefined)).toBe(1);
  });

  it('falls back to card size for a scale of zero', () => {
    expect(scaleFor(0)).toBe(1);
  });

  it('falls back to card size for a negative scale', () => {
    expect(scaleFor(-3)).toBe(1);
  });

  it('passes a positive scale through untouched', () => {
    expect(scaleFor(2)).toBe(2);
    expect(scaleFor(0.5)).toBe(0.5);
  });
});

describe('formatCardPercent', () => {
  it('writes a chance as a whole percent', () => {
    expect(formatCardPercent(0.35)).toBe('35%');
  });

  it('writes an impossible result as zero percent', () => {
    expect(formatCardPercent(0)).toBe('0%');
  });

  it('writes a certainty as one hundred percent', () => {
    expect(formatCardPercent(1)).toBe('100%');
  });

  it('rounds a fraction of a percent to the nearest whole one', () => {
    expect(formatCardPercent(0.1234)).toBe('12%');
    expect(formatCardPercent(0.125)).toBe('13%');
  });

  it('rounds a chance under half a percent down to zero percent', () => {
    expect(formatCardPercent(0.004)).toBe('0%');
  });
});

describe('round', () => {
  it('keeps two decimal places', () => {
    expect(round(12.3456)).toBe(12.35);
  });

  it('rounds up rather than cutting the tail off', () => {
    expect(round(12.999)).toBe(13);
  });

  it('leaves a whole number alone', () => {
    expect(round(12)).toBe(12);
  });

  it('rounds a negative coordinate the same way', () => {
    expect(round(-12.3456)).toBe(-12.35);
  });
});

describe('panelHeading', () => {
  it('uppercases the heading it is given', () => {
    expect(panelHeading('Totals', 100, LIGHT)).toContain('>TOTALS</text>');
  });

  it('sets the label twelve pixels under the panel origin', () => {
    expect(panelHeading('Totals', 100, LIGHT)).toContain(`<text x="${PADDING}" y="112" `);
  });

  it('uses the card text colour when no colour is given', () => {
    expect(panelHeading('Totals', 100, LIGHT)).toContain('fill="#22221f"');
  });

  it('takes the colour it is given over the card text colour', () => {
    const heading = panelHeading('Successes', 100, LIGHT, '#5b3f94');
    expect(heading).toContain('fill="#5b3f94"');
    expect(heading).not.toContain('#22221f');
  });

  it('escapes a heading that looks like markup', () => {
    const heading = panelHeading('<b>hits & misses', 100, LIGHT);
    expect(heading).toContain('&lt;B&gt;HITS &amp; MISSES');
    expect(heading).not.toContain('<b>');
  });
});

describe('rowSwatch', () => {
  it('draws a ten by ten chip in the row colour', () => {
    expect(rowSwatch(PADDING, 100, '#2563eb')).toContain(
      'width="10" height="10" rx="2" fill="#2563eb"',
    );
  });

  it('lifts the chip nine pixels above the name baseline', () => {
    expect(rowSwatch(PADDING, 100, '#2563eb')).toContain('<rect x="28" y="91" ');
  });

  it('rounds a fractional position to two decimals', () => {
    expect(rowSwatch(28.456, 100.456, '#2563eb')).toContain('<rect x="28.46" y="91.46" ');
  });
});

describe('MIXED_SCALE_CARD_NOTE', () => {
  it('fits inside the footer note budget', () => {
    expect(Array.from(MIXED_SCALE_CARD_NOTE).length).toBeLessThanOrEqual(NOTE_BUDGET);
  });

  it('prints whole in a card footer', () => {
    const { svg } = card({ note: MIXED_SCALE_CARD_NOTE });
    expect(svg).toContain(`>${MIXED_SCALE_CARD_NOTE}</text>`);
    expect(svg).not.toContain('…');
  });
});
