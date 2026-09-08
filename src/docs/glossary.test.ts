import { describe, expect, it } from 'vitest';
import {
  GLOSSARY_GROUP_ORDER,
  getEntry,
  glossaryEntries,
  tipForId,
} from './glossary';
import { tipForKeep } from './dynamicTips';
import { checkOutcomeChances } from '../engine/check';
import { halveFloor } from '../engine/distribution';
import { expressionNotation } from '../share/notation';
import { MAX_TARGETS, type Expression } from '../types';

const LEGACY_TIP_KEYS = [
  'pmf',
  'cdf',
  'ccdf',
  'targetView',
  'sigma',
  'mean',
  'meanSigma',
  'range',
  'mode',
  'mod',
  'hit',
  'roll',
  'target',
  'rollMode',
  'rollModeNormal',
  'rollModeAdvantage',
  'rollModeDisadvantage',
  'keep',
  'reroll',
  'explode',
  'inspectDistribution',
  'inspectMean',
  'inspectMode',
  'inspectSigma',
  'share',
  'import',
] as const;

// Every tooltip in the app resolves through tipForId with a literal id, so the
// component sources are the authoritative list of ids that have to resolve.
// A ternary such as tipForId(isPool ? 'a' : 'b') contributes both branches.
const TIP_CALL_SITES = import.meta.glob<string>(
  ['../components/**/*.{ts,tsx}', './**/*.{ts,tsx}', '!**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
);

function tipIdsUsedByComponents(): string[] {
  const ids = new Set<string>();
  for (const source of Object.values(TIP_CALL_SITES)) {
    for (const call of source.matchAll(/tipForId\(([^)]*)\)/g)) {
      for (const literal of (call[1] ?? '').matchAll(/'([^']+)'/g)) {
        if (literal[1] !== undefined) ids.add(literal[1]);
      }
    }
  }
  return [...ids].sort();
}

function everyUserFacingString(): { where: string; text: string }[] {
  const strings: { where: string; text: string }[] = [];
  for (const entry of glossaryEntries) {
    strings.push({ where: `${entry.id}.term`, text: entry.term });
    strings.push({ where: `${entry.id}.plain`, text: entry.plain });
    if (entry.alt !== undefined) strings.push({ where: `${entry.id}.alt`, text: entry.alt });
    if (entry.details !== undefined) {
      strings.push({ where: `${entry.id}.details`, text: entry.details });
    }
    if (entry.formal !== undefined) {
      strings.push({ where: `${entry.id}.formal`, text: entry.formal });
    }
  }
  for (const id of new Set([...tipIdsUsedByComponents(), ...LEGACY_TIP_KEYS])) {
    strings.push({ where: `tipForId('${id}')`, text: tipForId(id) });
  }
  return strings;
}

const sumRow: Expression = {
  id: 'e',
  name: 'row',
  parts: [],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};

const d20Check = (rollMode: Expression['rollMode']): Expression => ({
  ...sumRow,
  parts: [{ id: 'd20', count: 1, sides: 20 }],
  rollMode,
  mode: 'check',
  check: {
    threshold: { direction: 'gte', value: 15 },
    effect: { parts: [{ id: 'd8', count: 1, sides: 8 }], flatModifier: 4 },
    onSuccess: 'full',
    onFailure: 'none',
    crit: { onFaces: [20], effect: 'doubleDice' },
  },
});

// The details bodies teach notation by example; each example must be the very
// string the app prints for that roll, or the glossary teaches a stale dialect.
const NOTATION_EXAMPLES: { id: string; expr: Expression; printed: string }[] = [
  {
    id: 'check',
    expr: {
      ...sumRow,
      parts: [{ id: 'd20', count: 1, sides: 20 }],
      flatModifier: 7,
      mode: 'check',
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [{ id: 'd8', count: 1, sides: 8 }], flatModifier: 4 },
        onSuccess: 'full',
        onFailure: 'none',
      },
    },
    printed: '1d20 + 7 ≥15 → 1d8 + 4',
  },
  {
    id: 'pool',
    expr: {
      ...sumRow,
      parts: [{ id: 'p', count: 7, sides: 10 }],
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 8 },
    },
    printed: '7d10 · count ≥8',
  },
  {
    id: 'keep-across',
    expr: {
      ...sumRow,
      parts: [
        { id: 'trait', count: 1, sides: 8 },
        { id: 'wild', count: 1, sides: 6 },
      ],
      keepAcross: { type: 'highest', n: 1 },
    },
    printed: '1d8 + 1d6 · keep highest 1',
  },
];

describe('glossaryEntries', () => {
  it('has unique ids', () => {
    const ids = glossaryEntries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a non-empty plain definition', () => {
    for (const entry of glossaryEntries) {
      expect(entry.plain.length, `${entry.id} has empty plain`).toBeGreaterThan(0);
    }
  });

  it('every entry uses a known group', () => {
    const allowed = new Set<string>(GLOSSARY_GROUP_ORDER);
    for (const entry of glossaryEntries) {
      expect(allowed.has(entry.group), `${entry.id} uses unknown group`).toBe(true);
    }
  });
});

describe('tipForId', () => {
  it('resolves every legacy TIPS key to a non-empty tooltip string', () => {
    for (const key of LEGACY_TIP_KEYS) {
      expect(tipForId(key).length, `tipForId('${key}') is empty`).toBeGreaterThan(0);
    }
  });

  it('returns the entry’s plain text when the id is a glossary entry', () => {
    expect(tipForId('mean')).toBe(getEntry('mean')?.plain);
    expect(tipForId('keep')).toBe(getEntry('keep')?.plain);
  });

  it('never returns the deeper details text in tooltips', () => {
    for (const entry of glossaryEntries) {
      if (entry.details === undefined) continue;
      expect(
        tipForId(entry.id),
        `tipForId('${entry.id}') leaked the details body into the tooltip`,
      ).toBe(entry.plain);
    }
  });

  it('returns an empty string for an unknown id', () => {
    expect(tipForId('not-a-real-id')).toBe('');
  });

  it('resolves every id a component hands it to a non-empty tip', () => {
    const ids = tipIdsUsedByComponents();
    // An unknown id renders a HelpTerm with no tooltip and no error, so the
    // scanner has to be shown working before its silence means anything.
    expect(ids).toContain('checkMode');
    expect(ids).toContain('shareImage');
    expect(ids.length).toBeGreaterThan(50);
    for (const id of ids) {
      expect(tipForId(id).length, `tipForId('${id}') is empty`).toBeGreaterThan(0);
    }
  });
});

describe('user-facing glossary prose', () => {
  it('never uses an em-dash', () => {
    for (const { where, text } of everyUserFacingString()) {
      expect(text, where).not.toContain('—');
    }
  });

  it('never carries a hex color literal', () => {
    for (const { where, text } of everyUserFacingString()) {
      expect(text, where).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    }
  });
});

describe('glossary numbers agree with the app', () => {
  it('quotes the real cap on targets in the target tip', () => {
    expect(tipForId('target')).toContain(`up to ${MAX_TARGETS}`);
  });

  it('quotes the advantage crit chance the engine computes for crit on 20', () => {
    // Crit on 20 under advantage is 1 - (19/20)^2 = 39/400 = 0.0975; a single
    // roll crits 1/20 = 0.05. The entry states both as percentages, so the
    // strings are written out by hand rather than formatted from the engine.
    expect(checkOutcomeChances(d20Check('advantage')).crit).toBeCloseTo(0.0975, 12);
    expect(checkOutcomeChances(d20Check('normal')).crit).toBeCloseTo(0.05, 12);

    const details = getEntry('critical')?.details ?? '';
    expect(details).toContain('crits 9.75% of the time');
    expect(details).toContain('instead of 5%');
  });

  it('rounds half of a 7 down to 3 the way the effect-scale entry says', () => {
    const halved = halveFloor(new Map([[7, 1]]));
    expect([...halved.entries()]).toEqual([[3, 1]]);
    expect(getEntry('effect-scale')?.details).toContain('half of a 7 is 3');
  });

  it.each(NOTATION_EXAMPLES)(
    'quotes the $id example exactly as the app prints it',
    ({ id, expr, printed }) => {
      expect(expressionNotation(expr)).toBe(printed);
      expect(getEntry(id)?.details).toContain(printed);
    },
  );
});

describe('tipForKeep', () => {
  it('formats kh/kl tokens with explicit highest/lowest', () => {
    expect(tipForKeep('kh3')).toBe('kh3: keep the 3 highest dice from the pool.');
    expect(tipForKeep('kl1')).toBe('kl1: keep the 1 lowest dice from the pool.');
  });

  it('falls back to the keep glossary tip on unrecognized input', () => {
    expect(tipForKeep('not-a-keep-token')).toBe(tipForId('keep'));
  });
});
