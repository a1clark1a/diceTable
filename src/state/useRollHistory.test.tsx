import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AppProvider } from './AppContext';
import { RollHistoryProvider } from './RollHistoryContext';
import { useApp } from './useApp';
import { HISTORY_LIMIT, useRollHistory } from './useRollHistory';
import type { Distribution } from '../types';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>
    <RollHistoryProvider>{children}</RollHistoryProvider>
  </AppProvider>
);

function singleOutcome(value: number): Distribution {
  return new Map([[value, 1]]);
}

describe('useRollHistory', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns empty history and null lastResult for an unknown id', () => {
    const { result } = renderHook(() => useRollHistory(), { wrapper });
    expect(result.current.getHistory('unknown')).toEqual([]);
    expect(result.current.lastResult('unknown')).toBeNull();
  });

  it('records a roll and exposes it via getHistory and lastResult', () => {
    const { result } = renderHook(() => useRollHistory(), { wrapper });
    let returned: number[] = [];
    act(() => {
      returned = result.current.rollMany('seed-4d6kh3', singleOutcome(7), 1);
    });
    expect(returned).toEqual([7]);
    expect(result.current.getHistory('seed-4d6kh3')).toEqual([7]);
    expect(result.current.lastResult('seed-4d6kh3')).toBe(7);
  });

  it('returns nothing and does not record when the distribution is empty', () => {
    const { result } = renderHook(() => useRollHistory(), { wrapper });
    let returned: number[] = [-1];
    act(() => {
      returned = result.current.rollMany('seed-4d6kh3', new Map(), 1);
    });
    expect(returned).toEqual([]);
    expect(result.current.getHistory('seed-4d6kh3')).toEqual([]);
  });

  it('keeps history newest-first', () => {
    const { result } = renderHook(() => useRollHistory(), { wrapper });
    act(() => {
      result.current.rollMany('seed-4d6kh3', singleOutcome(1), 1);
    });
    act(() => {
      result.current.rollMany('seed-4d6kh3', singleOutcome(2), 1);
    });
    act(() => {
      result.current.rollMany('seed-4d6kh3', singleOutcome(3), 1);
    });
    expect(result.current.getHistory('seed-4d6kh3')).toEqual([3, 2, 1]);
    expect(result.current.lastResult('seed-4d6kh3')).toBe(3);
  });

  it(`caps history at HISTORY_LIMIT (${HISTORY_LIMIT})`, () => {
    const { result } = renderHook(() => useRollHistory(), { wrapper });
    act(() => {
      for (let i = 1; i <= HISTORY_LIMIT + 2; i++) {
        result.current.rollMany('seed-4d6kh3', singleOutcome(i), 1);
      }
    });
    const hist = result.current.getHistory('seed-4d6kh3');
    expect(hist).toHaveLength(HISTORY_LIMIT);
    expect(hist[0]).toBe(HISTORY_LIMIT + 2);
    expect(hist[hist.length - 1]).toBe(3);
  });

  it('keeps histories per exprId independent', () => {
    const { result } = renderHook(
      () => ({ app: useApp(), hist: useRollHistory() }),
      { wrapper },
    );
    act(() => {
      result.current.app.addExpression();
      result.current.app.addExpression();
    });
    const ids = result.current.app.expressions.map((e) => e.id);
    expect(ids).toHaveLength(2);
    const [a, b] = ids as [string, string];
    act(() => {
      result.current.hist.rollMany(a, singleOutcome(11), 1);
    });
    act(() => {
      result.current.hist.rollMany(b, singleOutcome(22), 1);
    });
    expect(result.current.hist.getHistory(a)).toEqual([11]);
    expect(result.current.hist.getHistory(b)).toEqual([22]);
  });

  it('drops history entries when their expression is deleted', () => {
    const { result } = renderHook(
      () => ({ app: useApp(), hist: useRollHistory() }),
      { wrapper },
    );
    act(() => {
      result.current.app.addExpression();
    });
    const rowId = result.current.app.expressions[0]!.id;
    act(() => {
      result.current.hist.rollMany(rowId, singleOutcome(7), 1);
    });
    expect(result.current.hist.getHistory(rowId)).toEqual([7]);

    act(() => {
      result.current.app.deleteExpression(rowId);
    });
    expect(result.current.hist.getHistory(rowId)).toEqual([]);
    expect(result.current.hist.lastResult(rowId)).toBeNull();
  });
});
