import { describe, expect, it } from 'vitest';
import { system } from './theme';
import {
  ROW_PALETTE_DARK,
  ROW_PALETTE_LIGHT,
} from './components/chart/palette';

// Written out by hand rather than read back from the module: the point is to
// catch the shipped palette changing, so an expectation sourced from theme.ts
// would agree with any mistake made in it. These are the measured values from
// the design handoff.
const LIGHT: Record<string, string> = {
  bg: '#f2f1ed',
  'bg-subtle': '#eae8e3',
  'bg-muted': '#dedcd5',
  'bg-emphasized': '#dedcd5',
  'bg-panel': '#fbfaf8',
  'bg-inverted': '#23231f',
  fg: '#22221f',
  'fg-muted': '#5c5952',
  'fg-subtle': '#63605a',
  'fg-inverted': '#fbfaf8',
  border: '#d6d2c9',
  'border-subtle': '#e3e0d8',
  'border-emphasized': '#bdb8ac',
  'blue-solid': '#3a5fb0',
  'blue-fg': '#2f4f96',
  'blue-subtle': '#e5e9f4',
  'purple-solid': '#6b4ea8',
  'purple-fg': '#5b3f94',
  'purple-subtle': '#ede9f3',
  'hit-good': '#206949',
  'hit-mid': '#7f5507',
  'hit-bad': '#963839',
  'green-subtle': '#e4ede5',
  'orange-subtle': '#f3ebdc',
  'red-subtle': '#f4e4e1',
};

const DARK: Record<string, string> = {
  bg: '#131519',
  'bg-subtle': '#181b20',
  'bg-muted': '#21252b',
  'bg-emphasized': '#262b32',
  'bg-panel': '#1a1d22',
  'bg-inverted': '#e8eaed',
  fg: '#e4e7eb',
  'fg-muted': '#a5acb6',
  'fg-subtle': '#9aa3ae',
  'fg-inverted': '#14161a',
  border: '#303640',
  'border-subtle': '#252a31',
  'border-emphasized': '#414855',
  'blue-solid': '#3d6bcc',
  'blue-fg': '#93b4f6',
  'blue-subtle': '#1b2333',
  'purple-solid': '#6f55bc',
  'purple-fg': '#b7a2f0',
  'purple-subtle': '#241e36',
  'hit-good': '#58be92',
  'hit-mid': '#dda857',
  'hit-bad': '#e4726a',
  'green-subtle': '#16231d',
  'orange-subtle': '#241e14',
  'red-subtle': '#251a19',
};

type Decls = Record<string, string>;

function tokensFor(mode: 'light' | 'dark'): Decls {
  const layer = system.getTokenCss()['@layer tokens'] as Record<string, Decls>;
  const selector = Object.keys(layer).find((s) =>
    mode === 'dark' ? s.startsWith('.dark') : s.startsWith(':root'),
  );
  if (selector === undefined) throw new Error(`no ${mode} token selector`);
  return layer[selector]!;
}

describe('theme semantic colors', () => {
  it.each(Object.entries(LIGHT))(
    'resolves %s to %s in light mode',
    (name, hex) => {
      expect(tokensFor('light')[`--chakra-colors-${name}`]).toBe(hex);
    },
  );

  it.each(Object.entries(DARK))(
    'resolves %s to %s in dark mode',
    (name, hex) => {
      expect(tokensFor('dark')[`--chakra-colors-${name}`]).toBe(hex);
    },
  );

  it('gives every overridden token a different value per mode', () => {
    // bg.muted and bg.emphasized deliberately share a light value, so this
    // checks light against dark rather than sibling against sibling.
    const light = tokensFor('light');
    const dark = tokensFor('dark');
    for (const name of Object.keys(LIGHT)) {
      const key = `--chakra-colors-${name}`;
      expect(light[key], name).not.toBe(dark[key]);
    }
  });
});

describe('row palette tokens', () => {
  // The only place in the suite that reads both sides on purpose: the point is
  // cross-file agreement, not the values, which palette.test.ts pins by hand.
  // The app paints from these tokens and the share image from the arrays, so a
  // drift here would ship a picture that did not match the screen it came from.
  it.each([
    ['light', ROW_PALETTE_LIGHT],
    ['dark', ROW_PALETTE_DARK],
  ] as const)('mirrors the %s share palette slot for slot', (mode, palette) => {
    const tokens = tokensFor(mode);
    palette.forEach((hex, i) => {
      expect(tokens[`--chakra-colors-row-${i + 1}`], `row-${i + 1}`).toBe(hex);
    });
  });

  it('defines exactly one token per palette slot', () => {
    const names = Object.keys(tokensFor('light')).filter((n) =>
      n.startsWith('--chakra-colors-row-'),
    );
    expect(names).toHaveLength(ROW_PALETTE_LIGHT.length);
  });
});

describe('theme raw ramps', () => {
  // The handoff remapped gray.800 to a near-white in dark. Ported here it would
  // take dark border, bg.emphasized, gray.muted and gray.border with it, since
  // all four resolve through that one ramp entry.
  it('leaves gray.800 on Chakra’s own ramp in both modes', () => {
    expect(tokensFor('light')['--chakra-colors-gray-800']).toBeUndefined();
    expect(tokensFor('dark')['--chakra-colors-gray-800']).toBeUndefined();
  });

  it('keeps dark borders dark rather than near-white', () => {
    const darkBorder = tokensFor('dark')['--chakra-colors-border'];
    expect(darkBorder).toBe('#303640');
  });
});
