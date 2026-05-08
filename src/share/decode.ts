import { decompressFromEncodedURIComponent } from 'lz-string';
import type { Expression } from '../types';
import { validateExportPayload } from './format';
import { HASH_PREFIX } from './encode';

export type DecodeError =
  | 'empty'
  | 'not-our-format'
  | 'malformed-json'
  | 'invalid-shape'
  | 'decompress-failed';

export type DecodeResult =
  | { ok: true; rolls: Expression[] }
  | { ok: false; error: DecodeError };

const HASH_DATA_KEY = 'data=';

function parseAndValidateJson(jsonText: string): DecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'malformed-json' };
  }
  const validated = validateExportPayload(parsed);
  if (validated === null) {
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      (parsed as Record<string, unknown>).format === 'dicetable-rolls'
    ) {
      return { ok: false, error: 'invalid-shape' };
    }
    return { ok: false, error: 'not-our-format' };
  }
  return { ok: true, rolls: validated };
}

export function decodeFromHashFragment(hash: string): DecodeResult {
  const trimmed = hash.trim();
  if (trimmed.length === 0) return { ok: false, error: 'empty' };

  const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  const dataIdx = withoutHash.indexOf(HASH_DATA_KEY);
  if (dataIdx === -1) return { ok: false, error: 'not-our-format' };

  const compressed = withoutHash.slice(dataIdx + HASH_DATA_KEY.length);
  if (compressed.length === 0) return { ok: false, error: 'empty' };

  const decompressed = decompressFromEncodedURIComponent(compressed);
  if (decompressed === null || decompressed.length === 0) {
    return { ok: false, error: 'decompress-failed' };
  }
  return parseAndValidateJson(decompressed);
}

export function decodeFromJsonString(input: string): DecodeResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, error: 'empty' };
  return parseAndValidateJson(trimmed);
}

export function detectAndDecode(input: string): DecodeResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { ok: false, error: 'empty' };

  const hashIdx = trimmed.indexOf(HASH_PREFIX);
  if (hashIdx !== -1) {
    return decodeFromHashFragment(trimmed.slice(hashIdx));
  }
  return decodeFromJsonString(trimmed);
}
