import { compressToEncodedURIComponent } from 'lz-string';
import type { Expression } from '../types';
import { buildExportEnvelope } from './format';

export const HASH_PREFIX = '#data=';

// URL-hash payloads stay client-side, never sent to a server, and browsers carry
// tens of kilobytes of hash without complaint. The number that bites is smaller:
// some chat clients truncate a link past roughly 2 KB when building a preview
// card, which breaks the link they show rather than the link itself.
//
// Measured with real ids on the wire, 20 rows already passed that at 2,675
// characters and 100 rows reached 9,802. Dropping the ids, which every import
// throws away anyway, takes the same tables to 994 and 2,746.
export function encodeRollsToHash(rolls: Expression[]): string {
  const envelope = buildExportEnvelope(rolls);
  const json = JSON.stringify(envelope);
  return HASH_PREFIX + compressToEncodedURIComponent(json);
}

// The link everything shares: the table lives entirely in the hash, so the
// origin and path are whatever page the user is already on.
export function shareUrlFor(rolls: Expression[]): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${encodeRollsToHash(rolls)}`;
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
