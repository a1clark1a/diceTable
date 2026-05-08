import { decodeFromHashFragment, type DecodeResult } from './decode';

export function consumeShareLinkFromHash(): DecodeResult | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (hash.length === 0 || !hash.includes('data=')) return null;

  // Strip the fragment first — even on decode failure, we don't want a bad link
  // to keep retrying on every render (notably under StrictMode double-invoke).
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', pathname + search);

  return decodeFromHashFragment(hash);
}
