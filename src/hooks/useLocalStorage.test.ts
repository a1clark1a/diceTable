import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns the initial value when storage is empty', () => {
    const { result } = renderHook(() =>
      useLocalStorage('k', { count: 0 }, { version: 1 }),
    );
    expect(result.current[0]).toEqual({ count: 0 });
  });

  it('persists updates and rehydrates them on remount', () => {
    const { result } = renderHook(() =>
      useLocalStorage('k', { count: 0 }, { version: 1 }),
    );
    act(() => {
      result.current[1]({ count: 5 });
    });
    expect(result.current[0]).toEqual({ count: 5 });

    const { result: next } = renderHook(() =>
      useLocalStorage('k', { count: 0 }, { version: 1 }),
    );
    expect(next.current[0]).toEqual({ count: 5 });
  });

  it('falls back to the initial value when stored version mismatches and no migrator is given', () => {
    window.localStorage.setItem(
      'k',
      JSON.stringify({ version: 0, value: { count: 99 } }),
    );
    const { result } = renderHook(() =>
      useLocalStorage('k', { count: 0 }, { version: 1 }),
    );
    expect(result.current[0]).toEqual({ count: 0 });
  });
});
