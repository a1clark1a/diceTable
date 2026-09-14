import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { AppProvider } from './AppContext';
import { RollHistoryProvider } from './RollHistoryContext';
import { useRollHistory, HISTORY_LIMIT } from './useRollHistory';
import { useApp } from './useApp';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>
    <RollHistoryProvider>{children}</RollHistoryProvider>
  </AppProvider>
);

afterEach(() => {
  window.localStorage.clear();
});

describe('RollHistoryProvider', () => {
  it('returns an empty history and null lastResult before any rolls', () => {
    const { result } = renderHook(() => useRollHistory(), { wrapper });
    expect(result.current.getHistory('nope')).toEqual([]);
    expect(result.current.lastResult('nope')).toBeNull();
  });

  it('returns nothing and records nothing when rolling an empty distribution', () => {
    const { result } = renderHook(() => useRollHistory(), { wrapper });
    let returned: number[] = [-1];
    act(() => {
      returned = result.current.rollMany('id', new Map(), 1);
    });
    expect(returned).toEqual([]);
    expect(result.current.getHistory('id')).toEqual([]);
  });

  it('appends rolls newest-first and caps at HISTORY_LIMIT', () => {
    const { result } = renderHook(() => useRollHistory(), { wrapper });
    const dist = new Map([[42, 1]]);
    act(() => {
      for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
        result.current.rollMany('e', dist, 1);
      }
    });
    const hist = result.current.getHistory('e');
    expect(hist.length).toBe(HISTORY_LIMIT);
    expect(hist.every((v) => v === 42)).toBe(true);
    expect(result.current.lastResult('e')).toBe(42);
  });

  it('drops history for an expression when that expression is deleted', () => {
    const { result } = renderHook(
      () => ({ app: useApp(), hist: useRollHistory() }),
      { wrapper },
    );
    act(() => {
      result.current.app.addExpression();
    });
    const rowId = result.current.app.expressions[0]!.id;
    const dist = new Map([[1, 1]]);
    act(() => {
      result.current.hist.rollMany(rowId, dist, 1);
    });
    expect(result.current.hist.getHistory(rowId).length).toBe(1);

    act(() => {
      result.current.app.deleteExpression(rowId);
    });
    expect(result.current.hist.getHistory(rowId)).toEqual([]);
  });

  it('preserves history for surviving expressions when another is deleted', () => {
    const { result } = renderHook(
      () => ({ app: useApp(), hist: useRollHistory() }),
      { wrapper },
    );
    const dist = new Map([[3, 1]]);
    act(() => {
      result.current.app.addExpression();
      result.current.app.addExpression();
    });
    const ids = result.current.app.expressions.map((e) => e.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    const firstId = ids[0]!;
    const secondId = ids[1]!;
    act(() => {
      result.current.hist.rollMany(firstId, dist, 1);
      result.current.hist.rollMany(secondId, dist, 1);
    });
    expect(result.current.hist.getHistory(firstId).length).toBe(1);
    expect(result.current.hist.getHistory(secondId).length).toBe(1);

    act(() => {
      result.current.app.deleteExpression(firstId);
    });
    expect(result.current.hist.getHistory(firstId)).toEqual([]);
    expect(result.current.hist.getHistory(secondId)).toEqual([3]);
  });
});
