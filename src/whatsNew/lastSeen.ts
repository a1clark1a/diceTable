import type { Release } from './releases';
import { compareVersions, isVersion, maxVersion, releasesSince } from './versions';

// Its own key rather than a field in dicetable.v2: this is app-wide, not table
// data, so the error screen's reset must not clear it and a first visit can
// record it without saving an empty table.
export const LAST_SEEN_KEY = 'dicetable.lastSeenVersion';

export type LastSeenRead =
  | { status: 'unavailable' }
  | { status: 'missing' }
  | { status: 'ok'; version: string };

export function readLastSeen(): LastSeenRead {
  if (typeof window === 'undefined') return { status: 'unavailable' };
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY);
    return raw !== null && isVersion(raw)
      ? { status: 'ok', version: raw }
      : { status: 'missing' };
  } catch {
    return { status: 'unavailable' };
  }
}

/**
 * Records `current` as seen, unless a newer version is already stored: after a
 * rollback, opening the history must not make the newer release unseen again.
 */
export function markSeen(current: string): void {
  if (!isVersion(current)) return;
  const read = readLastSeen();
  if (read.status === 'unavailable') return;
  const next = read.status === 'ok' ? maxVersion(read.version, current) : current;
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, next);
  } catch {
    /* blocked or full: the dialog shows again next open, which is the safe failure */
  }
}

export interface OpenInput {
  read: LastSeenRead;
  current: string;
  releases: readonly Release[];
  hasSavedTable: boolean;
  shareVisit: boolean;
}

export interface OpenDecision {
  autoOpen: readonly Release[] | null;
  /** The version the stack starts after; null when the user's last visit is unknown. */
  sinceVersion: string | null;
  recordNow: boolean;
}

const NOTHING: OpenDecision = { autoOpen: null, sinceVersion: null, recordNow: false };
const RECORD: OpenDecision = { autoOpen: null, sinceVersion: null, recordNow: true };

export function decideOnOpen({
  read,
  current,
  releases,
  hasSavedTable,
  shareVisit,
}: OpenInput): OpenDecision {
  if (!isVersion(current)) return NOTHING;
  // Blocked storage can never remember a dismissal, so showing would mean
  // showing on every load.
  if (read.status === 'unavailable') return NOTHING;
  // Ahead of the share check on purpose: a first visit by link must still be
  // recorded, or the table the link saves makes the second visit look like a
  // user from before this feature.
  if (read.status === 'missing' && !hasSavedTable) return RECORD;
  if (shareVisit) return NOTHING;

  if (read.status === 'ok') {
    if (compareVersions(read.version, current) >= 0) return NOTHING;
    const unseen = releasesSince(releases, read.version, current);
    if (unseen.length === 0) return RECORD;
    return { autoOpen: unseen, sinceVersion: read.version, recordNow: false };
  }

  const release = releases.find((r) => r.version === current);
  if (release === undefined) return RECORD;
  return { autoOpen: [release], sinceVersion: null, recordNow: false };
}
