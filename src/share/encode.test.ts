import { describe, expect, it } from 'vitest';
import type { Expression } from '../types';
import {
  defaultExportFilename,
  encodeRollsToBlob,
  encodeRollsToHash,
  encodeRollsToJson,
  HASH_PREFIX,
} from './encode';
import { decodeFromHashFragment, decodeFromJsonString } from './decode';
import { EXPORT_FORMAT_TAG, EXPORT_VERSION } from './format';

/**
 * Ids do not travel any more: the wire drops them and the importer fills fresh
 * ones in, because both import paths replace them on arrival regardless. So a
 * round trip is equal in everything except the ids, and every arriving row and
 * part still has to carry one.
 */
function omitId(v: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(v as Record<string, unknown>) };
  delete out.id;
  return out;
}

function stripIds(rolls: readonly unknown[]): unknown[] {
  return rolls.map((r) => {
    const row = r as Record<string, unknown>;
    const out = omitId(row);
    if (Array.isArray(row.parts)) out.parts = row.parts.map(omitId);
    const check = row.check as Record<string, unknown> | undefined;
    const effect = check?.effect as Record<string, unknown> | undefined;
    if (check && effect && Array.isArray(effect.parts)) {
      out.check = { ...check, effect: { ...effect, parts: effect.parts.map(omitId) } };
    }
    return out;
  });
}

function expectSameRolls(actual: readonly unknown[], expected: readonly unknown[]): void {
  expect(stripIds(actual)).toEqual(stripIds(expected));
  for (const r of actual) {
    const row = r as Record<string, unknown>;
    expect(typeof row.id).toBe('string');
    expect((row.id as string).length).toBeGreaterThan(0);
  }
}


const sampleRolls: Expression[] = [
  {
    id: 'expr-1',
    name: '4d6kh3 + 2',
    parts: [
      { id: 'part-1', count: 4, sides: 6, keep: { type: 'highest', n: 3 } },
    ],
    flatModifier: 2,
    rollMode: 'advantage',
    mode: 'sum',
  },
  {
    id: 'expr-2',
    name: 'Longbow',
    parts: [{ id: 'part-2', count: 1, sides: 20 }],
    flatModifier: 5,
    rollMode: 'normal',
    mode: 'sum',
  },
];

describe('encodeRollsToHash', () => {
  it('begins with the #data= prefix', () => {
    const hash = encodeRollsToHash(sampleRolls);
    expect(hash.startsWith(HASH_PREFIX)).toBe(true);
  });

  it('round-trips through decodeFromHashFragment', () => {
    const hash = encodeRollsToHash(sampleRolls);
    const result = decodeFromHashFragment(hash);
    expect(result.ok).toBe(true);
    if (result.ok) expectSameRolls(result.rolls, sampleRolls);
  });

  it('round-trips an empty rolls array', () => {
    const hash = encodeRollsToHash([]);
    const result = decodeFromHashFragment(hash);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rolls).toEqual([]);
  });

  it('round-trips a 10-row table', () => {
    const ten: Expression[] = Array.from({ length: 10 }, (_, i) => ({
      id: `expr-${i}`,
      name: `Roll ${i}`,
      parts: [
        {
          id: `part-${i}`,
          count: i + 1,
          sides: 6,
          reroll: { values: [1], mode: 'once' },
        },
      ],
      flatModifier: i,
      rollMode: 'normal',
      mode: 'sum',
    }));
    const hash = encodeRollsToHash(ten);
    const result = decodeFromHashFragment(hash);
    expect(result.ok).toBe(true);
    if (result.ok) expectSameRolls(result.rolls, ten);
  });

  it('produces a URL-safe payload (no characters needing percent-encoding)', () => {
    const hash = encodeRollsToHash(sampleRolls);
    expect(hash).toMatch(/^#data=[A-Za-z0-9_+\-$.~*'()!,:;/?@&=]+$/);
  });
});

describe('encodeRollsToJson', () => {
  it('produces valid JSON parseable as an envelope', () => {
    const json = encodeRollsToJson(sampleRolls);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.format).toBe(EXPORT_FORMAT_TAG);
    expect(parsed.exportVersion).toBe(EXPORT_VERSION);
    expect(stripIds(parsed.rolls as unknown[])).toEqual(stripIds(sampleRolls));
  });

  it('is pretty-printed (contains newlines)', () => {
    const json = encodeRollsToJson(sampleRolls);
    expect(json).toContain('\n');
  });

  it('round-trips through decodeFromJsonString', () => {
    const json = encodeRollsToJson(sampleRolls);
    const result = decodeFromJsonString(json);
    expect(result.ok).toBe(true);
    if (result.ok) expectSameRolls(result.rolls, sampleRolls);
  });
});

describe('encodeRollsToBlob', () => {
  it('produces a Blob with application/json type', () => {
    const { blob } = encodeRollsToBlob(sampleRolls);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');
  });

  it('produces a suggested filename matching the dicetable-YYYY-MM-DD pattern', () => {
    const { suggestedFilename } = encodeRollsToBlob(sampleRolls);
    expect(suggestedFilename).toMatch(/^dicetable-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('blob contents round-trip through decodeFromJsonString', async () => {
    const { blob } = encodeRollsToBlob(sampleRolls);
    const text = await blob.text();
    const result = decodeFromJsonString(text);
    expect(result.ok).toBe(true);
    if (result.ok) expectSameRolls(result.rolls, sampleRolls);
  });
});

describe('defaultExportFilename', () => {
  it('formats a fixed date correctly', () => {
    const d = new Date(2026, 4, 7);
    expect(defaultExportFilename(d)).toBe('dicetable-2026-05-07.json');
  });

  it('zero-pads month and day', () => {
    const d = new Date(2026, 0, 3);
    expect(defaultExportFilename(d)).toBe('dicetable-2026-01-03.json');
  });
});

describe('link size', () => {
  it('keeps a hundred rolls inside a chat previewer budget', () => {
    const rolls = Array.from({ length: 100 }, (_, i) => ({
      id: 'expr-' + i,
      name: 'Roll number ' + i,
      parts: [{ id: 'part-' + i, count: 2, sides: 6 }],
      flatModifier: 3,
      rollMode: 'normal' as const,
      mode: 'sum' as const,
    }));
    // With ids on the wire this was 9,802 characters. They are the least
    // compressible part of the payload, being random, and nothing reads them
    // on arrival.
    expect(encodeRollsToHash(rolls).length).toBeLessThan(3000);
  });
});
