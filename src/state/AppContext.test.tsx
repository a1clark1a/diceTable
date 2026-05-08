import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AppProvider } from './AppContext';
import { useApp } from './useApp';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

afterEach(() => {
  window.localStorage.clear();
});

describe('AppContext setTarget', () => {
  it('starts with no target values', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.target.values).toEqual([]);
    expect(result.current.target.ruling).toBe('gte');
  });

  it('sets values from a patch and sorts them ascending', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setTarget({ values: [22, 13, 16] });
    });
    expect(result.current.target.values).toEqual([13, 16, 22]);
  });

  it('dedupes repeated values', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setTarget({ values: [13, 16, 13, 19, 16] });
    });
    expect(result.current.target.values).toEqual([13, 16, 19]);
  });

  it('caps values at five', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setTarget({ values: [10, 11, 12, 13, 14, 15, 16] });
    });
    expect(result.current.target.values).toHaveLength(5);
  });

  it('drops non-integer values silently', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setTarget({ values: [13, 1.5, NaN, 19] });
    });
    expect(result.current.target.values).toEqual([13, 19]);
  });

  it('updates ruling without clearing existing values', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setTarget({ values: [13, 16] });
    });
    act(() => {
      result.current.setTarget({ ruling: 'lt' });
    });
    expect(result.current.target.values).toEqual([13, 16]);
    expect(result.current.target.ruling).toBe('lt');
  });

  it('replaces values with empty array when patched with []', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setTarget({ values: [13] });
    });
    act(() => {
      result.current.setTarget({ values: [] });
    });
    expect(result.current.target.values).toEqual([]);
  });
});
