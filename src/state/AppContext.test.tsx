import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AppProvider } from './AppContext';
import { useApp } from './useApp';
import type { RollMode } from '../types';

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

interface SeededExpr {
  id: string;
  name: string;
  parts: { id: string; count: number; sides: number }[];
  flatModifier: number;
  rollMode: 'normal';
}

function makeExprs(count: number): SeededExpr[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    name: `Row ${i}`,
    parts: [{ id: `p${i}`, count: 1, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
  }));
}

function seedExpressions(count: number) {
  const state = {
    version: 2,
    expressions: makeExprs(count),
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [] as number[], ruling: 'gte' as const },
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

describe('AppContext expression cap', () => {
  it('addExpression appends when below the 100-row cap', () => {
    seedExpressions(99);
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.expressions).toHaveLength(99);
    act(() => {
      result.current.addExpression();
    });
    expect(result.current.expressions).toHaveLength(100);
  });

  it('addExpression is a no-op when already at the cap', () => {
    seedExpressions(100);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.addExpression();
    });
    expect(result.current.expressions).toHaveLength(100);
  });

  it('duplicateExpression is a no-op when already at the cap', () => {
    seedExpressions(100);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.duplicateExpression('e0');
    });
    expect(result.current.expressions).toHaveLength(100);
  });

  it('addExpressions accepts all incoming when there is room', () => {
    seedExpressions(50);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.addExpressions(makeExprs(10));
    });
    expect(result.current.expressions).toHaveLength(60);
  });

  it('addExpressions takes only as many as fit when incoming exceeds the cap', () => {
    seedExpressions(95);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.addExpressions(makeExprs(20));
    });
    expect(result.current.expressions).toHaveLength(100);
  });

  it('addExpressions is rejected entirely when already at the cap', () => {
    seedExpressions(100);
    const { result } = renderHook(() => useApp(), { wrapper });
    const before = result.current.expressions.map((e) => e.id);
    act(() => {
      result.current.addExpressions(makeExprs(5));
    });
    expect(result.current.expressions.map((e) => e.id)).toEqual(before);
  });

  it('replaceExpressions truncates input that exceeds the cap', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.replaceExpressions(makeExprs(150));
    });
    expect(result.current.expressions).toHaveLength(100);
  });
});

function seedRollModes(modes: RollMode[]) {
  const state = {
    version: 2,
    expressions: modes.map((mode, i) => ({
      id: `e${i}`,
      name: `Row ${i}`,
      parts: [{ id: `p${i}`, count: 1, sides: 6 }],
      flatModifier: 0,
      rollMode: mode,
    })),
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [] as number[], ruling: 'gte' as const },
      view: 'table' as const,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

describe('AppContext setAllRollModes', () => {
  it('rewrites every row to the given mode', () => {
    seedRollModes(['normal', 'normal', 'normal']);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setAllRollModes('advantage');
    });
    expect(result.current.expressions.map((e) => e.rollMode)).toEqual([
      'advantage',
      'advantage',
      'advantage',
    ]);
  });

  it('collapses a hand-mixed table to a single mode', () => {
    seedRollModes(['normal', 'advantage', 'disadvantage']);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setAllRollModes('disadvantage');
    });
    expect(
      new Set(result.current.expressions.map((e) => e.rollMode)).size,
    ).toBe(1);
    expect(result.current.expressions[0]!.rollMode).toBe('disadvantage');
  });

  it('leaves expression and part ids untouched', () => {
    seedRollModes(['normal', 'advantage']);
    const { result } = renderHook(() => useApp(), { wrapper });
    const beforeExprIds = result.current.expressions.map((e) => e.id);
    const beforePartIds = result.current.expressions.map((e) => e.parts[0]!.id);
    act(() => {
      result.current.setAllRollModes('normal');
    });
    expect(result.current.expressions.map((e) => e.id)).toEqual(beforeExprIds);
    expect(result.current.expressions.map((e) => e.parts[0]!.id)).toEqual(
      beforePartIds,
    );
  });

  it('preserves name, parts, and flat modifier when rewriting the mode', () => {
    seedRollModes(['normal']);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setAllRollModes('advantage');
    });
    const row = result.current.expressions[0]!;
    expect(row.name).toBe('Row 0');
    expect(row.flatModifier).toBe(0);
    expect(row.parts).toEqual([{ id: 'p0', count: 1, sides: 6 }]);
  });

  it('is a no-op on an empty table', () => {
    seedRollModes([]);
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.expressions).toEqual([]);
    act(() => {
      result.current.setAllRollModes('advantage');
    });
    expect(result.current.expressions).toEqual([]);
  });
});
