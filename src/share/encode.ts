import { compressToEncodedURIComponent } from 'lz-string';
import type { Expression } from '../types';
import { buildExportEnvelope } from './format';

export const HASH_PREFIX = '#data=';

// URL-hash payloads stay client-side (never sent to a server) but link previewers
// in some chat clients truncate beyond ~2 KB. Typical 5-row tables compress to
// well under that; very large tables may exceed it.
export function encodeRollsToHash(rolls: Expression[]): string {
  const envelope = buildExportEnvelope(rolls);
  const json = JSON.stringify(envelope);
  return HASH_PREFIX + compressToEncodedURIComponent(json);
}

export function encodeRollsToJson(rolls: Expression[]): string {
  const envelope = buildExportEnvelope(rolls);
  return JSON.stringify(envelope, null, 2);
}

export interface BlobExport {
  blob: Blob;
  suggestedFilename: string;
}

export function encodeRollsToBlob(rolls: Expression[]): BlobExport {
  const json = encodeRollsToJson(rolls);
  const blob = new Blob([json], { type: 'application/json' });
  return { blob, suggestedFilename: defaultExportFilename() };
}

export function defaultExportFilename(now: Date = new Date()): string {
  const yyyy = String(now.getFullYear()).padStart(4, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `dicetable-${yyyy}-${mm}-${dd}.json`;
}
