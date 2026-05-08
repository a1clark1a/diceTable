import { describe, expect, it } from 'vitest';
import type { Expression } from '../types';
import {
  decodeFromHashFragment,
  decodeFromJsonString,
  detectAndDecode,
} from './decode';
import { encodeRollsToHash, encodeRollsToJson } from './encode';
import { EXPORT_FORMAT_TAG, EXPORT_VERSION } from './format';

const sampleRolls: Expression[] = [
  {
    id: 'expr-1',
    name: 'Longbow',
    parts: [{ id: 'part-1', count: 1, sides: 20 }],
    flatModifier: 5,
    rollMode: 'normal',
  },
];

describe('decodeFromHashFragment', () => {
  it('decodes a freshly-encoded hash', () => {
    const hash = encodeRollsToHash(sampleRolls);
    const result = decodeFromHashFragment(hash);
    expect(result).toEqual({ ok: true, rolls: sampleRolls });
  });

  it('decodes a hash without the leading #', () => {
    const hash = encodeRollsToHash(sampleRolls).slice(1);
    const result = decodeFromHashFragment(hash);
    expect(result).toEqual({ ok: true, rolls: sampleRolls });
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
    expect(decodeFromJsonString(json)).toEqual({ ok: true, rolls: sampleRolls });
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
    expect(detectAndDecode(hash)).toEqual({ ok: true, rolls: sampleRolls });
  });

  it('decodes a full URL containing a share-link hash', () => {
    const hash = encodeRollsToHash(sampleRolls);
    const url = `https://example.com/app${hash}`;
    expect(detectAndDecode(url)).toEqual({ ok: true, rolls: sampleRolls });
  });

  it('decodes raw JSON when no #data= is present', () => {
    const json = encodeRollsToJson(sampleRolls);
    expect(detectAndDecode(json)).toEqual({ ok: true, rolls: sampleRolls });
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
