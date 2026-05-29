import { describe, expect, it } from 'vitest';
import {
  GLOSSARY_GROUP_ORDER,
  getEntry,
  glossaryEntries,
  tipForId,
} from './glossary';
import { tipForKeep } from './dynamicTips';

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
