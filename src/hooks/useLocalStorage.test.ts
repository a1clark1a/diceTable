import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('returns the initial value when storage is empty', () => {
    const { result } = renderHook(() =>
      useLocalStorage('k', { count: 0 }, { version: 1 }),
    );
    expect(result.current[0]).toEqual({ count: 0 });
  });

  it('persists updates and rehydrates them on remount', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useLocalStorage('k', { count: 0 }, { version: 1 }),
    );
    act(() => {
      result.current[1]({ count: 5 });
    });
    expect(result.current[0]).toEqual({ count: 5 });

    act(() => {
      vi.advanceTimersByTime(200);
    });

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

  it('coalesces rapid sequential updates into a single setItem call after the debounce', () => {
    vi.useFakeTimers();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() =>
      useLocalStorage('k', { count: 0 }, { version: 1 }),
    );

    act(() => {
      result.current[1]({ count: 1 });
    });
    act(() => {
      result.current[1]({ count: 2 });
    });
    act(() => {
      result.current[1]({ count: 3 });
    });

    expect(setItemSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(setItemSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenLastCalledWith(
      'k',
      JSON.stringify({ version: 1, value: { count: 3 } }),
    );
  });

  it('flushes a pending write synchronously when beforeunload fires mid-debounce', () => {
    vi.useFakeTimers();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() =>
      useLocalStorage('k', { count: 0 }, { version: 1 }),
    );

    act(() => {
      result.current[1]({ count: 7 });
    });
    expect(setItemSpy).not.toHaveBeenCalled();

    let beforeReturn = -1;
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
      beforeReturn = setItemSpy.mock.calls.length;
    });

    expect(beforeReturn).toBe(1);
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenLastCalledWith(
      'k',
      JSON.stringify({ version: 1, value: { count: 7 } }),
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(setItemSpy).toHaveBeenCalledTimes(1);
  });

  it('beforeunload is a no-op when no write is pending', () => {
    vi.useFakeTimers();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    renderHook(() => useLocalStorage('k', { count: 0 }, { version: 1 }));

    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
