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

const sampleRolls: Expression[] = [
  {
    id: 'expr-1',
    name: '4d6kh3 + 2',
    parts: [
      { id: 'part-1', count: 4, sides: 6, keep: { type: 'highest', n: 3 } },
    ],
    flatModifier: 2,
    rollMode: 'advantage',
  },
  {
    id: 'expr-2',
    name: 'Longbow',
    parts: [{ id: 'part-2', count: 1, sides: 20 }],
    flatModifier: 5,
    rollMode: 'normal',
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
    if (result.ok) expect(result.rolls).toEqual(sampleRolls);
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
    }));
    const hash = encodeRollsToHash(ten);
    const result = decodeFromHashFragment(hash);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rolls).toEqual(ten);
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
    expect(parsed.rolls).toEqual(sampleRolls);
  });

  it('is pretty-printed (contains newlines)', () => {
    const json = encodeRollsToJson(sampleRolls);
    expect(json).toContain('\n');
  });

  it('round-trips through decodeFromJsonString', () => {
    const json = encodeRollsToJson(sampleRolls);
    const result = decodeFromJsonString(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rolls).toEqual(sampleRolls);
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
    if (result.ok) expect(result.rolls).toEqual(sampleRolls);
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
