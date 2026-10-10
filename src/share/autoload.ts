import { decodeFromHashFragment, type DecodeResult } from './decode';

const SHARE_VISIT_KEY = 'dicetable.shareVisit';
export const SHARE_VISIT_WINDOW_MS = 30_000;

export function hasShareLinkHash(hash: string): boolean {
  return hash.includes('data=');
}

// A link opened while an update is waiting is read by the old build, which
// strips the fragment, and then the service worker reloads the tab onto the new
// build. sessionStorage outlives that same-tab reload, so the new build can
// still tell the visit came from a link. The timestamp keeps a stale marker from
// passing a much later manual reload off as one.
function markShareVisit(): void {
  try {
    window.sessionStorage.setItem(SHARE_VISIT_KEY, String(Date.now()));
  } catch {
    /* blocked storage: the reload case goes uncovered, nothing else changes */
  }
}

export function shareVisitSource(now: number): 'hash' | 'marker' | null {
  if (typeof window === 'undefined') return null;
  if (hasShareLinkHash(window.location.hash)) return 'hash';
  try {
    const at = Number(window.sessionStorage.getItem(SHARE_VISIT_KEY));
    return at > 0 && now - at >= 0 && now - at < SHARE_VISIT_WINDOW_MS ? 'marker' : null;
  } catch {
    return null;
  }
}

export function clearShareVisitMarker(): void {
  try {
    window.sessionStorage.removeItem(SHARE_VISIT_KEY);
  } catch {
    /* nothing to clear if storage is blocked */
  }
}

export function consumeShareLinkFromHash(): DecodeResult | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hasShareLinkHash(hash)) return null;

  markShareVisit();
  const result = decodeFromHashFragment(hash);

  // The fragment goes, so a bad link cannot retry on every render (notably
  // under StrictMode's double invoke). The one exception is a link this build
  // is too old to read: the fix there is to reload onto the new build, and
  // destroying the payload first would take the link with it.
  if (!(result.ok === false && result.error === 'version-too-new')) {
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', pathname + search);
  }

  return result;
}
