import { describe, expect, it } from 'vitest';
import type { Expression } from '../types';
import {
  decodeFromHashFragment,
  decodeFromJsonString,
  detectAndDecode,
} from './decode';
import { encodeRollsToHash, encodeRollsToJson } from './encode';
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

function expectDecoded(result: { ok: boolean; rolls?: unknown[] } | unknown, expected: readonly unknown[]): void {
  const r = result as { ok: boolean; rolls?: unknown[] };
  expect(r.ok).toBe(true);
  expectSameRolls(r.rolls ?? [], expected);
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
    name: 'Longbow',
    parts: [{ id: 'part-1', count: 1, sides: 20 }],
    flatModifier: 5,
    rollMode: 'normal',
    mode: 'sum',
  },
];

describe('decodeFromHashFragment', () => {
  it('decodes a freshly-encoded hash', () => {
    const hash = encodeRollsToHash(sampleRolls);
    const result = decodeFromHashFragment(hash);
    expectDecoded(result, sampleRolls);
  });

  it('decodes a hash without the leading #', () => {
    const hash = encodeRollsToHash(sampleRolls).slice(1);
    const result = decodeFromHashFragment(hash);
    expectDecoded(result, sampleRolls);
  });

  it('returns empty when hash is blank', () => {
    expect(decodeFromHashFragment('')).toEqual({ ok: false, error: 'empty' });
    expect(decodeFromHashFragment('#')).toEqual({ ok: false, error: 'not-our-format' });
  });

  it('returns not-our-format when data= key is missing', () => {
    expect(decodeFromHashFragment('#foo=bar')).toEqual({
      ok: false,
      error: 'not-our-format',
    });
  });

  it('returns empty when data= has no payload', () => {
    expect(decodeFromHashFragment('#data=')).toEqual({ ok: false, error: 'empty' });
  });

  it('returns decompress-failed for a tampered/corrupted payload', () => {
    const result = decodeFromHashFragment('#data=!!!not-valid-lz!!!');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['decompress-failed', 'malformed-json', 'not-our-format']).toContain(
        result.error,
      );
    }
  });

  it('returns decompress-failed for completely unparseable garbage', () => {
    const result = decodeFromHashFragment('#data=xxxxxxxx');
    expect(result.ok).toBe(false);
  });
});

describe('decodeFromJsonString', () => {
  it('decodes a freshly-encoded JSON string', () => {
    const json = encodeRollsToJson(sampleRolls);
    expectDecoded(decodeFromJsonString(json), sampleRolls);
  });

  it('returns empty for blank input', () => {
    expect(decodeFromJsonString('')).toEqual({ ok: false, error: 'empty' });
    expect(decodeFromJsonString('   \n  ')).toEqual({ ok: false, error: 'empty' });
  });

  it('returns malformed-json for unparseable text', () => {
    expect(decodeFromJsonString('not json at all')).toEqual({
      ok: false,
      error: 'malformed-json',
    });
    expect(decodeFromJsonString('{unterminated')).toEqual({
      ok: false,
      error: 'malformed-json',
    });
  });

  it('returns not-our-format for valid JSON without the format tag', () => {
    expect(decodeFromJsonString('{"hello":"world"}')).toEqual({
      ok: false,
      error: 'not-our-format',
    });
    expect(decodeFromJsonString('[1,2,3]')).toEqual({
      ok: false,
      error: 'not-our-format',
    });
  });

  it('returns invalid-shape when format tag matches but payload is corrupt', () => {
    const corrupt = JSON.stringify({
      format: EXPORT_FORMAT_TAG,
      exportVersion: EXPORT_VERSION,
      rolls: [{ id: 'x', name: 'y', parts: [], flatModifier: 0, rollMode: 'normal' }],
    });
    expect(decodeFromJsonString(corrupt)).toEqual({
      ok: false,
      error: 'invalid-shape',
    });
  });
});

describe('detectAndDecode', () => {
  it('decodes a bare share-link hash fragment', () => {
    const hash = encodeRollsToHash(sampleRolls);
    expectDecoded(detectAndDecode(hash), sampleRolls);
  });

  it('decodes a full URL containing a share-link hash', () => {
    const hash = encodeRollsToHash(sampleRolls);
    const url = `https://example.com/app${hash}`;
    expectDecoded(detectAndDecode(url), sampleRolls);
  });

  it('decodes raw JSON when no #data= is present', () => {
    const json = encodeRollsToJson(sampleRolls);
    expectDecoded(detectAndDecode(json), sampleRolls);
  });

  it('returns empty for blank input', () => {
    expect(detectAndDecode('')).toEqual({ ok: false, error: 'empty' });
  });

  it('returns malformed-json for plain text that is not a URL', () => {
    expect(detectAndDecode('hello world')).toEqual({
      ok: false,
      error: 'malformed-json',
    });
  });
});
