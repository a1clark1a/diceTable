import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SHARE_VISIT_WINDOW_MS,
  clearShareVisitMarker,
  consumeShareLinkFromHash,
  hasShareLinkHash,
  shareVisitSource,
} from './autoload';
import { encodeRollsToHash } from './encode';
import type { Expression } from '../types';

const ROLL: Expression = {
  id: 'e1',
  name: 'Attack',
  parts: [{ id: 'p1', count: 1, sides: 20 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};

function setHash(hash: string) {
  window.history.replaceState(null, '', `/${hash}`);
}

afterEach(() => {
  setHash('');
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('hasShareLinkHash', () => {
  it('spots a share payload in the fragment', () => {
    expect(hasShareLinkHash('#data=abc')).toBe(true);
  });

  it('ignores an empty or unrelated fragment', () => {
    expect(hasShareLinkHash('')).toBe(false);
    expect(hasShareLinkHash('#section-2')).toBe(false);
  });
});

describe('shareVisitSource', () => {
  it('reports a link still in the URL as a hash visit', () => {
    setHash('#data=abc');
    expect(shareVisitSource(Date.now())).toBe('hash');
  });

  it('reports nothing on a plain load', () => {
    expect(shareVisitSource(Date.now())).toBeNull();
  });

  it('remembers a link the previous load in this tab consumed', () => {
    setHash(encodeRollsToHash([ROLL]));
    consumeShareLinkFromHash();
    expect(window.location.hash).toBe('');
    expect(shareVisitSource(Date.now())).toBe('marker');
  });

  it('lets the marker lapse once the window has passed', () => {
    setHash(encodeRollsToHash([ROLL]));
    consumeShareLinkFromHash();
    expect(shareVisitSource(Date.now() + SHARE_VISIT_WINDOW_MS + 1)).toBeNull();
  });

  it('ignores a marker stamped in the future', () => {
    setHash(encodeRollsToHash([ROLL]));
    consumeShareLinkFromHash();
    expect(shareVisitSource(Date.now() - 1000)).toBeNull();
  });

  it('forgets the marker once it is cleared', () => {
    setHash(encodeRollsToHash([ROLL]));
    consumeShareLinkFromHash();
    clearShareVisitMarker();
    expect(shareVisitSource(Date.now())).toBeNull();
  });

  it('marks even a link that fails to decode, since the visit still came from a link', () => {
    setHash('#data=not-a-real-payload');
    consumeShareLinkFromHash();
    expect(shareVisitSource(Date.now())).toBe('marker');
  });

  it('treats blocked session storage as no marker', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(shareVisitSource(Date.now())).toBeNull();
  });

  it('still reads the link when session storage refuses the marker', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    setHash(encodeRollsToHash([ROLL]));
    const result = consumeShareLinkFromHash();
    expect(result?.ok).toBe(true);
  });
});
