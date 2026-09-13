import { decodeFromHashFragment, type DecodeResult } from './decode';

export function consumeShareLinkFromHash(): DecodeResult | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (hash.length === 0 || !hash.includes('data=')) return null;

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
