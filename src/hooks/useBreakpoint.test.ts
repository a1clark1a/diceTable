import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsDesktop } from './useBreakpoint';

interface MockMql {
  matches: boolean;
  listeners: Array<(e: MediaQueryListEvent) => void>;
  addEventListener: (type: 'change', cb: (e: MediaQueryListEvent) => void) => void;
  removeEventListener: (type: 'change', cb: (e: MediaQueryListEvent) => void) => void;
  fire: (matches: boolean) => void;
}

function installMatchMedia(initialMatches: boolean): MockMql {
  const mql: MockMql = {
    matches: initialMatches,
    listeners: [],
    addEventListener: (_type, cb) => {
      mql.listeners.push(cb);
    },
    removeEventListener: (_type, cb) => {
      mql.listeners = mql.listeners.filter((l) => l !== cb);
    },
    fire: (matches: boolean) => {
      mql.matches = matches;
      const event = { matches } as MediaQueryListEvent;
      for (const l of mql.listeners) l(event);
    },
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  );
  return mql;
}

describe('useIsDesktop', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when the desktop media query matches initially', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });

  it('returns false when the desktop media query does not match initially', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });

  it('updates when the media query change event fires', () => {
    const mql = installMatchMedia(false);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);

    act(() => {
      mql.fire(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      mql.fire(false);
    });
    expect(result.current).toBe(false);
  });

  it('removes the listener on unmount', () => {
    const mql = installMatchMedia(true);
    const { unmount } = renderHook(() => useIsDesktop());
    expect(mql.listeners).toHaveLength(1);

    unmount();
    expect(mql.listeners).toHaveLength(0);
  });

  it('falls back to true and skips subscription when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result, unmount } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
    expect(() => unmount()).not.toThrow();
  });
});
