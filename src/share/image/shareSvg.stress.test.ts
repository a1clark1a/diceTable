import { describe, expect, it } from 'vitest';
import { buildShareSvg, type ShareImageRow } from './buildShareSvg';
import { uniformDistribution } from '../../engine/distribution';
import { rowColorHex } from '../../components/chart/palette';

// The card's text budgets, in code points and including the ellipsis: 28 for a
// row name, 70 for the title, 120 for the footer note, 72 for a notation.
const NAME_BUDGET = 28;
const TITLE_BUDGET = 70;
const NOTE_BUDGET = 120;
const NOTATION_BUDGET = 72;

// Seven code points: four people joined by three zero-width joiners.
const ZWJ_FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}';
// Two code points that render as one accented letter.
const COMBINING = 'é';
const RTL_NAME = 'הקוסם מטיל אש';
const HOSTILE_MIX = `🎲δ⚔️${COMBINING}ש&<>"'${ZWJ_FAMILY}`;

function namedRow(name: string, notation = '1d6'): ShareImageRow {
  return {
    id: 'stress-row',
    name,
    notation,
    slot: 0,
    color: rowColorHex(0, 'light'),
    dist: uniformDistribution(6),
    canMiss: false,
    mean: 3.5,
    stddev: 1.71,
    min: 1,
    max: 6,
  };
}

function svgFor(name: string): string {
  return buildShareSvg({ rows: [namedRow(name)], totalsView: 'pmf', successesView: 'pmf', theme: 'light' }).svg;
}

/** True when the string holds a surrogate half without its partner. */
function hasLoneSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

/** The budget the card promises: cut in code points, ellipsis when cut. */
function cutToBudget(value: string, budget: number): string {
  const chars = Array.from(value);
  if (chars.length <= budget) return value;
  return `${chars.slice(0, budget - 1).join('')}…`;
}

function escapeForSvg(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function unescapeFromSvg(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function expectWellFormedXml(svg: string): void {
  const doc = new DOMParser().parseFromString(svg, 'text/xml');
  expect(doc.querySelector('parsererror')).toBeNull();
}

describe('lone surrogate helper', () => {
  it('spots either half of a split emoji on its own', () => {
    expect(hasLoneSurrogate('😀'.charAt(0))).toBe(true);
    expect(hasLoneSurrogate(`x${'😀'.charAt(1)}y`)).toBe(true);
  });

  it('accepts intact pairs and plain text', () => {
    expect(hasLoneSurrogate('')).toBe(false);
    expect(hasLoneSurrogate('plain ascii')).toBe(false);
    expect(hasLoneSurrogate('😀🎲👨‍👩‍👧‍👦')).toBe(false);
  });
});

describe('buildShareSvg hostile row names', () => {
  // 36 code points total, with the emoji stepped across the 28-point cut.
  const boundaryName = (pos: number): string =>
    `${'a'.repeat(pos)}😀${'a'.repeat(35 - pos)}`;

  it('never leaves a lone surrogate wherever an emoji sits against the cut', () => {
    for (let pos = 20; pos <= 35; pos++) {
      const svg = svgFor(boundaryName(pos));
      expect(hasLoneSurrogate(svg), `emoji at position ${pos}`).toBe(false);
      expect(() => encodeURIComponent(svg), `emoji at position ${pos}`).not.toThrow();
    }
  });

  it('cuts at the same code point wherever the emoji sits', () => {
    for (let pos = 20; pos <= 35; pos++) {
      const name = boundaryName(pos);
      const svg = svgFor(name);
      expect(svg, `emoji at position ${pos}`).toContain(
        `>${cutToBudget(name, NAME_BUDGET)}</text>`,
      );
      expect(svg, `emoji at position ${pos}`).not.toContain(name);
    }
  });

  it('cuts an all-emoji name emoji by emoji, never mid pair', () => {
    const svg = svgFor('🎲'.repeat(40));
    expect(hasLoneSurrogate(svg)).toBe(false);
    expect(svg).toContain(`>${'🎲'.repeat(NAME_BUDGET - 1)}…</text>`);
    expect(svg).not.toContain('🎲'.repeat(NAME_BUDGET));
  });

  it('survives a name of joined family emoji cut mid-sequence', () => {
    const svg = svgFor(ZWJ_FAMILY.repeat(8));
    expect(hasLoneSurrogate(svg)).toBe(false);
    expect(() => encodeURIComponent(svg)).not.toThrow();
    expect(svg).toContain('…');
    expectWellFormedXml(svg);
  });

  it('keeps combining marks from breaking the cut', () => {
    const name = COMBINING.repeat(30);
    const svg = svgFor(name);
    expect(hasLoneSurrogate(svg)).toBe(false);
    expect(svg).toContain(`>${cutToBudget(name, NAME_BUDGET)}</text>`);
  });

  it('renders a right-to-left name untouched when it fits the budget', () => {
    const svg = svgFor(RTL_NAME);
    expect(svg).toContain(`>${RTL_NAME}</text>`);
    expect(svg).not.toContain('…');
  });

  it('truncates a long right-to-left name by code points', () => {
    const name = `${RTL_NAME} `.repeat(4);
    const svg = svgFor(name);
    expect(svg).toContain(`>${cutToBudget(name, NAME_BUDGET)}</text>`);
    expect(svg).not.toContain(name);
  });

  it('escapes a name made entirely of markup metacharacters even after the cut', () => {
    const name = `&<>"'`.repeat(10);
    const svg = svgFor(name);
    expect(svg).toContain(`>${escapeForSvg(cutToBudget(name, NAME_BUDGET))}</text>`);
    expectWellFormedXml(svg);
  });
});

describe('buildShareSvg hostile titles and notes', () => {
  it('cuts the title by code points with an emoji walked across its boundary', () => {
    // 74 code points total against the 70-point budget.
    for (let pos = 66; pos <= 72; pos++) {
      const title = `${'a'.repeat(pos)}😀${'a'.repeat(73 - pos)}`;
      const { svg } = buildShareSvg({
        rows: [namedRow('Row')],
        totalsView: 'pmf', successesView: 'pmf',
        theme: 'light',
        title,
      });
      expect(hasLoneSurrogate(svg), `emoji at position ${pos}`).toBe(false);
      expect(svg, `emoji at position ${pos}`).toContain(
        `>${cutToBudget(title, TITLE_BUDGET)}</text>`,
      );
    }
  });

  it('cuts the note by code points with an emoji walked across its boundary', () => {
    // 124 code points total against the 120-point budget.
    for (let pos = 116; pos <= 122; pos++) {
      const note = `${'a'.repeat(pos)}😀${'a'.repeat(123 - pos)}`;
      const { svg } = buildShareSvg({
        rows: [namedRow('Row')],
        totalsView: 'pmf', successesView: 'pmf',
        theme: 'light',
        note,
      });
      expect(hasLoneSurrogate(svg), `emoji at position ${pos}`).toBe(false);
      expect(svg, `emoji at position ${pos}`).toContain(
        `>${cutToBudget(note, NOTE_BUDGET)}</text>`,
      );
    }
  });

  it('cuts an all-emoji notation without splitting a pair', () => {
    const notation = '🎯'.repeat(80);
    const { svg } = buildShareSvg({
      rows: [namedRow('Row', notation)],
      totalsView: 'pmf', successesView: 'pmf',
      theme: 'light',
    });
    expect(hasLoneSurrogate(svg)).toBe(false);
    expect(svg).toContain(`>${'🎯'.repeat(NOTATION_BUDGET - 1)}…</text>`);
    expect(svg).not.toContain('🎯'.repeat(NOTATION_BUDGET));
  });
});

describe('buildShareSvg hostile mega mix', () => {
  const mix = HOSTILE_MIX.repeat(12);
  const image = buildShareSvg({
    rows: [namedRow(mix, mix)],
    totalsView: 'pmf', successesView: 'pmf',
    theme: 'dark',
    title: mix,
    note: mix,
  });

  it('stays encodable with every text slot full of hostile content', () => {
    expect(hasLoneSurrogate(image.svg)).toBe(false);
    expect(() => encodeURIComponent(image.svg)).not.toThrow();
  });

  it('stays well-formed xml with every text slot full of hostile content', () => {
    expectWellFormedXml(image.svg);
  });

  it('keeps every drawn text within the widest budget', () => {
    const contents = [...image.svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(
      (m) => unescapeFromSvg(m[1] ?? ''),
    );
    expect(contents.length).toBeGreaterThan(0);
    const widest = Math.max(NAME_BUDGET, TITLE_BUDGET, NOTE_BUDGET, NOTATION_BUDGET);
    for (const content of contents) {
      expect(Array.from(content).length, content).toBeLessThanOrEqual(widest);
    }
  });
});

describe('buildShareSvg truncation semantics', () => {
  it('counts an emoji as one character of the budget, not two', () => {
    const name = '🎲'.repeat(NAME_BUDGET);
    const svg = svgFor(name);
    expect(svg).toContain(`>${name}</text>`);
    expect(svg).not.toContain('…');
  });

  it('adds the ellipsis only when something was actually cut', () => {
    const over = svgFor('🎲'.repeat(NAME_BUDGET + 1));
    expect(over).toContain('…');
    expect(over).toContain(`>${'🎲'.repeat(NAME_BUDGET - 1)}…</text>`);
  });

  it('round-trips an untruncated mixed-script name exactly', () => {
    const name = `🎲 ${RTL_NAME} ${COMBINING}`;
    const svg = svgFor(name);
    expect(svg).toContain(`>${name}</text>`);
    expect(svg).not.toContain('…');
  });

  it('leaves a title exactly on budget whole even when it ends in an emoji', () => {
    const title = `${'a'.repeat(TITLE_BUDGET - 1)}😀`;
    const { svg } = buildShareSvg({
      rows: [namedRow('Row')],
      totalsView: 'pmf', successesView: 'pmf',
      theme: 'light',
      title,
    });
    expect(svg).toContain(`>${title}</text>`);
    expect(svg).not.toContain('…');
  });
});
