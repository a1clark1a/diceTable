import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AppProvider } from './AppContext';
import { useApp } from './useApp';
import { validateExpression, validatePersistedState } from './persistedSchema';
import type { Expression, RollMode } from '../types';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

afterEach(() => {
  window.localStorage.clear();
  // A reload test fakes timers to land the debounced write; restoring here
  // keeps a failure inside that test from leaking fake timers into the rest.
  vi.useRealTimers();
});

describe('AppContext first run', () => {
  it('starts with zero expressions when storage is empty', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.expressions).toEqual([]);
  });
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
  mode: 'sum';
}

function makeExprs(count: number): SeededExpr[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    name: `Row ${i}`,
    parts: [{ id: `p${i}`, count: 1, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
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

function sumRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e0',
    name: 'Row 0',
    parts: [{ id: 'p0', count: 1, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function seedRows(expressions: Expression[]) {
  const state = {
    version: 2,
    expressions,
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

describe('AppContext updateExpression mode switching', () => {
  it('switching a 4d6kh3 row to pool strips keep and seeds a 4+ threshold from the d6', () => {
    seedRows([
      sumRow({
        parts: [
          { id: 'p0', count: 4, sides: 6, keep: { type: 'highest', n: 3 } },
        ],
      }),
    ]);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    const row = result.current.expressions[0]!;
    expect(row.mode).toBe('pool');
    expect(row.parts[0]!.keep).toBeUndefined();
    expect(row.successThreshold).toEqual({ direction: 'gte', value: 4 });
  });

  it('switching a multi-part row to pool strips keep and explode from every part but keeps reroll, seeding from the first part', () => {
    seedRows([
      sumRow({
        parts: [
          {
            id: 'p0',
            count: 2,
            sides: 10,
            explode: { onFaces: [6], depthCap: 10 },
          },
          {
            id: 'p1',
            count: 3,
            sides: 6,
            keep: { type: 'highest', n: 3 },
            reroll: { values: [1], mode: 'once' },
          },
        ],
      }),
    ]);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    const row = result.current.expressions[0]!;
    expect(row.parts[0]!.explode).toBeUndefined();
    expect(row.parts[1]!.keep).toBeUndefined();
    expect(row.parts[1]!.reroll).toEqual({ values: [1], mode: 'once' });
    expect(row.successThreshold).toEqual({ direction: 'gte', value: 6 });
  });

  it('seeds an 11+ threshold when the first part is a d20', () => {
    seedRows([sumRow({ parts: [{ id: 'p0', count: 1, sides: 20 }] })]);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    expect(result.current.expressions[0]!.successThreshold).toEqual({
      direction: 'gte',
      value: 11,
    });
  });

  it('clamps the seeded threshold to the die size when the first part is a d2', () => {
    seedRows([sumRow({ parts: [{ id: 'p0', count: 1, sides: 2 }] })]);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    expect(result.current.expressions[0]!.successThreshold).toEqual({
      direction: 'gte',
      value: 2,
    });
  });

  it('leaves roll mode and flat modifier unchanged when switching to pool', () => {
    seedRows([sumRow({ rollMode: 'advantage', flatModifier: 2 })]);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    const row = result.current.expressions[0]!;
    expect(row.rollMode).toBe('advantage');
    expect(row.flatModifier).toBe(2);
  });

  it('switching back to sum deletes the threshold and does not restore keep or explode', () => {
    seedRows([
      sumRow({
        parts: [
          {
            id: 'p0',
            count: 4,
            sides: 6,
            keep: { type: 'highest', n: 3 },
            explode: { onFaces: [6], depthCap: 10 },
          },
        ],
      }),
    ]);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    act(() => {
      result.current.updateExpression('e0', { mode: 'sum' });
    });
    const row = result.current.expressions[0]!;
    expect(row.mode).toBe('sum');
    expect(row.successThreshold).toBeUndefined();
    expect(row.parts[0]!.keep).toBeUndefined();
    expect(row.parts[0]!.explode).toBeUndefined();
  });

  it('patching mode pool on an already-pool row leaves a user-edited threshold alone', () => {
    seedRows([sumRow()]);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    act(() => {
      result.current.updateExpression('e0', {
        successThreshold: { direction: 'lte', value: 2 },
      });
    });
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    expect(result.current.expressions[0]!.successThreshold).toEqual({
      direction: 'lte',
      value: 2,
    });
  });

  it('an explicit undefined successThreshold patch clears the field', () => {
    seedRows([sumRow()]);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    expect(result.current.expressions[0]!.successThreshold).toBeDefined();
    act(() => {
      result.current.updateExpression('e0', { successThreshold: undefined });
    });
    expect(result.current.expressions[0]!.successThreshold).toBeUndefined();
  });
});

describe('AppContext setPoolTarget', () => {
  it('defaults to 1', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.poolTarget).toBe(1);
  });

  it('stores a positive integer as given', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setPoolTarget(4);
    });
    expect(result.current.poolTarget).toBe(4);
  });

  it('floors a fractional value down to the nearest integer', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setPoolTarget(3.9);
    });
    expect(result.current.poolTarget).toBe(3);
  });

  it('clamps zero up to 1', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setPoolTarget(5);
    });
    act(() => {
      result.current.setPoolTarget(0);
    });
    expect(result.current.poolTarget).toBe(1);
  });

  it('clamps a negative value up to 1', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setPoolTarget(5);
    });
    act(() => {
      result.current.setPoolTarget(-3);
    });
    expect(result.current.poolTarget).toBe(1);
  });

  it('falls back to 1 for NaN', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setPoolTarget(5);
    });
    act(() => {
      result.current.setPoolTarget(NaN);
    });
    expect(result.current.poolTarget).toBe(1);
  });

  it('falls back to 1 for Infinity', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setPoolTarget(5);
    });
    act(() => {
      result.current.setPoolTarget(Infinity);
    });
    expect(result.current.poolTarget).toBe(1);
  });

  it('leaves expressions and target values untouched', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setTarget({ values: [13, 16] });
    });
    const beforeExpressions = result.current.expressions;
    act(() => {
      result.current.setPoolTarget(3);
    });
    expect(result.current.expressions).toEqual(beforeExpressions);
    expect(result.current.target.values).toEqual([13, 16]);
    expect(result.current.target.ruling).toBe('gte');
  });
});

function seedTwoRows() {
  seedRows([
    sumRow(),
    sumRow({ id: 'e1', name: 'Row 1', parts: [{ id: 'p1', count: 1, sides: 6 }] }),
  ]);
}

describe('AppContext baseline lifecycle', () => {
  it('starts with no baseline', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.baselineId).toBeNull();
  });

  it('setBaselineId pins a row and null clears it', () => {
    seedTwoRows();
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setBaselineId('e0');
    });
    expect(result.current.baselineId).toBe('e0');
    act(() => {
      result.current.setBaselineId(null);
    });
    expect(result.current.baselineId).toBeNull();
  });

  it('deleting the baseline row clears the baseline', () => {
    seedTwoRows();
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setBaselineId('e0');
    });
    act(() => {
      result.current.deleteExpression('e0');
    });
    expect(result.current.baselineId).toBeNull();
    expect(result.current.expressions).toHaveLength(1);
  });

  it('deleting a different row keeps the baseline', () => {
    seedTwoRows();
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setBaselineId('e0');
    });
    act(() => {
      result.current.deleteExpression('e1');
    });
    expect(result.current.baselineId).toBe('e0');
  });

  it('replaceExpressions clears the baseline instead of leaking a stale id past the row re-id', () => {
    seedTwoRows();
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setBaselineId('e0');
    });
    act(() => {
      result.current.replaceExpressions(makeExprs(2));
    });
    expect(result.current.baselineId).toBeNull();
  });

  it('addExpressions keeps the baseline on the existing row', () => {
    seedTwoRows();
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setBaselineId('e0');
    });
    act(() => {
      result.current.addExpressions(makeExprs(1));
    });
    expect(result.current.baselineId).toBe('e0');
    expect(
      result.current.expressions.filter((e) => e.id === 'e0'),
    ).toHaveLength(1);
  });

  it('duplicateExpression keeps the baseline on the original, not the copy', () => {
    seedTwoRows();
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setBaselineId('e0');
    });
    act(() => {
      result.current.duplicateExpression('e0');
    });
    expect(result.current.baselineId).toBe('e0');
    expect(result.current.expressions).toHaveLength(3);
    expect(
      result.current.expressions.filter((e) => e.id === 'e0'),
    ).toHaveLength(1);
  });
});

// keepAcross and a per-part keep must never coexist: validatePersistedState
// rejects a row carrying both, and a rejected envelope drops the whole table
// back to empty on the next load. These cover the invariant at the mutation
// boundary, not just in the UI that hides the chip.
describe('AppContext keepAcross', () => {
  function seedRow(result: { current: ReturnType<typeof useApp> }): string {
    act(() => {
      result.current.addExpression();
    });
    return result.current.expressions[0]!.id;
  }

  it('sets the rule on a row', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const id = seedRow(result);
    act(() => {
      result.current.updateExpression(id, { keepAcross: { type: 'highest', n: 1 } });
    });
    expect(result.current.expressions[0]!.keepAcross).toEqual({
      type: 'highest',
      n: 1,
    });
  });

  it('clears the rule when the patch passes undefined', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const id = seedRow(result);
    act(() => {
      result.current.updateExpression(id, { keepAcross: { type: 'highest', n: 1 } });
    });
    act(() => {
      result.current.updateExpression(id, { keepAcross: undefined });
    });
    expect(result.current.expressions[0]!.keepAcross).toBeUndefined();
  });

  it('leaves the rule alone when the patch does not mention it', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const id = seedRow(result);
    act(() => {
      result.current.updateExpression(id, { keepAcross: { type: 'lowest', n: 2 } });
    });
    act(() => {
      result.current.updateExpression(id, { flatModifier: 4 });
    });
    expect(result.current.expressions[0]!.keepAcross).toEqual({
      type: 'lowest',
      n: 2,
    });
  });

  it('strips every per-part keep when the rule turns on', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const id = seedRow(result);
    const partId = result.current.expressions[0]!.parts[0]!.id;
    act(() => {
      result.current.updatePart(id, partId, { keep: { type: 'highest', n: 1 } });
    });
    expect(result.current.expressions[0]!.parts[0]!.keep).toBeDefined();
    act(() => {
      result.current.updateExpression(id, { keepAcross: { type: 'highest', n: 1 } });
    });
    expect(result.current.expressions[0]!.parts[0]!.keep).toBeUndefined();
  });

  // The editor disables the per-part Keep chip while the across-parts rule is
  // on, so a keep patch arriving anyway is a bypass; the normalize step lets
  // the across-parts rule win, the same direction the UI shows.
  it('refuses a per-part keep while the across-parts rule is on', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const id = seedRow(result);
    const partId = result.current.expressions[0]!.parts[0]!.id;
    act(() => {
      result.current.updateExpression(id, { keepAcross: { type: 'highest', n: 1 } });
    });
    act(() => {
      result.current.updatePart(id, partId, { keep: { type: 'lowest', n: 1 } });
    });
    expect(result.current.expressions[0]!.keepAcross).toEqual({
      type: 'highest',
      n: 1,
    });
    expect(result.current.expressions[0]!.parts[0]!.keep).toBeUndefined();
  });

  it('drops the rule when the row switches to counting successes', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const id = seedRow(result);
    act(() => {
      result.current.updateExpression(id, { keepAcross: { type: 'highest', n: 1 } });
    });
    act(() => {
      result.current.updateExpression(id, { mode: 'pool' });
    });
    expect(result.current.expressions[0]!.keepAcross).toBeUndefined();
  });

  it('survives a reload rather than dropping the table', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useApp(), { wrapper });
    const id = seedRow(result);
    act(() => {
      result.current.updateExpression(id, { keepAcross: { type: 'lowest', n: 2 } });
    });
    // Writes are debounced, and unmount clears the pending timer instead of
    // flushing it, so the write has to land before the provider goes away.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    unmount();
    vi.useRealTimers();

    const second = renderHook(() => useApp(), { wrapper });
    expect(second.result.current.expressions).toHaveLength(1);
    expect(second.result.current.expressions[0]!.keepAcross).toEqual({
      type: 'lowest',
      n: 2,
    });
  });
});

// Imports bypass updateExpressionInList, so the two entry points carry their
// own repair pass; a shared table with an unshowable crit face must land here
// the same way it would after a hydration.
describe('AppContext import repair', () => {
  function importedCheckRow(onFaces: number[]): Expression {
    return {
      id: 'i0',
      name: 'Imported',
      parts: [{ id: 'p0', count: 1, sides: 6 }],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'check',
      check: {
        threshold: { direction: 'gte', value: 10 },
        effect: { parts: [{ id: 'fx', count: 1, sides: 6 }], flatModifier: 0 },
        onSuccess: 'full',
        onFailure: 'none',
        crit: { onFaces, effect: 'doubleDice' },
      },
    };
  }

  function afterReload(expr: Expression): Expression | null {
    return validateExpression(JSON.parse(JSON.stringify(expr)) as unknown);
  }

  it('replaceExpressions clamps a crit face the d6 cannot show', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.replaceExpressions([importedCheckRow([5, 20])]);
    });
    const landed = result.current.expressions[0]!;
    expect(landed.check?.crit).toEqual({ onFaces: [5], effect: 'doubleDice' });
    expect(afterReload(landed)).not.toBeNull();
  });

  it('replaceExpressions drops the crit when no face survives but keeps the rest of the spec', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.replaceExpressions([importedCheckRow([19, 20])]);
    });
    const landed = result.current.expressions[0]!;
    expect(landed.check?.crit).toBeUndefined();
    expect(landed.check?.threshold).toEqual({ direction: 'gte', value: 10 });
    expect(landed.check?.onSuccess).toBe('full');
    expect(afterReload(landed)).not.toBeNull();
  });

  it('addExpressions clamps a crit face the d6 cannot show', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.addExpressions([importedCheckRow([5, 20])]);
    });
    expect(result.current.expressions).toHaveLength(1);
    const landed = result.current.expressions[0]!;
    expect(landed.check?.crit).toEqual({ onFaces: [5], effect: 'doubleDice' });
    expect(afterReload(landed)).not.toBeNull();
  });

  // A hand-edited share file can carry both keeps on one sum row; the
  // validator rejects that pairing outright, so letting it land would wipe the
  // table on the next reload.
  it('replaceExpressions lets the across-parts keep win over a per-part keep on an imported sum row', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.replaceExpressions([
        sumRow({
          parts: [
            { id: 'p0', count: 4, sides: 6, keep: { type: 'highest', n: 3 } },
            { id: 'p1', count: 1, sides: 8 },
          ],
          keepAcross: { type: 'highest', n: 2 },
        }),
      ]);
    });
    const landed = result.current.expressions[0]!;
    expect(landed.keepAcross).toEqual({ type: 'highest', n: 2 });
    expect(landed.parts[0]!.keep).toBeUndefined();
    expect(landed.parts[0]).toMatchObject({ count: 4, sides: 6 });
    expect(afterReload(landed)).not.toBeNull();
  });
});

describe('AppContext row lifecycle', () => {
  function addRow(result: { current: ReturnType<typeof useApp> }) {
    act(() => {
      result.current.addExpression();
    });
  }

  it('names added rows with the lowest free suffix', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    addRow(result);
    addRow(result);
    addRow(result);
    expect(result.current.expressions.map((e) => e.name)).toEqual([
      'New roll',
      'New roll 2',
      'New roll 3',
    ]);
  });

  it('reuses the suffix a deleted row left free instead of counting on', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    addRow(result);
    addRow(result);
    addRow(result);
    const second = result.current.expressions.find((e) => e.name === 'New roll 2')!;
    act(() => {
      result.current.deleteExpression(second.id);
    });
    addRow(result);
    expect(result.current.expressions.map((e) => e.name)).toEqual([
      'New roll',
      'New roll 3',
      'New roll 2',
    ]);
  });

  it('expands the newest row after each add', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    addRow(result);
    expect(result.current.expandedId).toBe(result.current.expressions[0]!.id);
    addRow(result);
    expect(result.current.expandedId).toBe(result.current.expressions[1]!.id);
  });

  it('renameExpression trims surrounding whitespace', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    addRow(result);
    const id = result.current.expressions[0]!.id;
    act(() => {
      result.current.renameExpression(id, '  Fireball ');
    });
    expect(result.current.expressions[0]!.name).toBe('Fireball');
  });

  it('renameExpression substitutes Untitled for a whitespace-only name', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    addRow(result);
    const id = result.current.expressions[0]!.id;
    act(() => {
      result.current.renameExpression(id, '   ');
    });
    expect(result.current.expressions[0]!.name).toBe('Untitled');
  });

  it('renameExpression substitutes Untitled for an empty name', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    addRow(result);
    const id = result.current.expressions[0]!.id;
    act(() => {
      result.current.renameExpression(id, '');
    });
    expect(result.current.expressions[0]!.name).toBe('Untitled');
  });

  it('renameExpression leaves the dice, modifier and mode alone', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    addRow(result);
    const id = result.current.expressions[0]!.id;
    act(() => {
      result.current.renameExpression(id, '  Fireball ');
    });
    act(() => {
      result.current.renameExpression(id, '');
    });
    const row = result.current.expressions[0]!;
    expect(row.parts).toHaveLength(1);
    expect(row.parts[0]!.sides).toBe(20);
    expect(row.flatModifier).toBe(0);
    expect(row.mode).toBe('sum');
  });

  it('duplicateExpression inserts the copy directly after its source', () => {
    seedRows([
      sumRow({ parts: [{ id: 'p0', count: 2, sides: 6 }] }),
      sumRow({ id: 'e1', name: 'Row 1', parts: [{ id: 'p1', count: 1, sides: 6 }] }),
    ]);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.duplicateExpression('e0');
    });
    expect(result.current.expressions.map((e) => e.name)).toEqual([
      'Row 0',
      'Row 0 (copy)',
      'Row 1',
    ]);
  });

  it('duplicateExpression gives the copy fresh row and part ids but the same dice', () => {
    seedRows([sumRow({ parts: [{ id: 'p0', count: 2, sides: 6 }] })]);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.duplicateExpression('e0');
    });
    const copy = result.current.expressions[1]!;
    expect(copy.id).not.toBe('e0');
    expect(copy.parts[0]!.id).not.toBe('p0');
    expect(copy.parts[0]).toMatchObject({ count: 2, sides: 6 });
    expect(result.current.expressions[0]!.name).toBe('Row 0');
  });

  it('duplicateExpression expands the copy', () => {
    seedRows([sumRow()]);
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.duplicateExpression('e0');
    });
    expect(result.current.expandedId).toBe(result.current.expressions[1]!.id);
  });

  it('deleting a different row leaves the expanded row expanded', () => {
    seedTwoRows();
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setExpandedId('e0');
    });
    act(() => {
      result.current.deleteExpression('e1');
    });
    expect(result.current.expandedId).toBe('e0');
    expect(result.current.expressions.map((e) => e.id)).toEqual(['e0']);
  });

  // A stale expandedId is persisted, and RollExpand would look up a missing
  // row on the next reload.
  it('deleting the expanded row collapses the expansion', () => {
    seedTwoRows();
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.setExpandedId('e0');
    });
    act(() => {
      result.current.deleteExpression('e0');
    });
    expect(result.current.expandedId).toBeNull();
    expect(result.current.expressions.map((e) => e.id)).toEqual(['e1']);
  });

  it('addPart appends a fresh d20 with its own id', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    addRow(result);
    const id = result.current.expressions[0]!.id;
    const firstPartId = result.current.expressions[0]!.parts[0]!.id;
    act(() => {
      result.current.addPart(id);
    });
    const parts = result.current.expressions[0]!.parts;
    expect(parts).toHaveLength(2);
    expect(parts[1]).toMatchObject({ count: 1, sides: 20 });
    expect(parts[1]!.id).toMatch(/^part-/);
    expect(parts[1]!.id).not.toBe(firstPartId);
  });

  function setupRulesOnFirstPart() {
    const { result } = renderHook(() => useApp(), { wrapper });
    addRow(result);
    const id = result.current.expressions[0]!.id;
    const partId = result.current.expressions[0]!.parts[0]!.id;
    act(() => {
      result.current.updatePart(id, partId, {
        reroll: { values: [1], mode: 'once' },
        explode: { onFaces: [20], depthCap: 3 },
      });
    });
    return { result, id, partId };
  }

  it('updatePart removes the reroll key when the patch passes undefined', () => {
    const { result, id, partId } = setupRulesOnFirstPart();
    act(() => {
      result.current.updatePart(id, partId, { reroll: undefined });
    });
    const part = result.current.expressions[0]!.parts[0]!;
    expect('reroll' in part).toBe(false);
    expect(part.explode).toEqual({ onFaces: [20], depthCap: 3 });
  });

  it('updatePart removes the explode key when the patch passes undefined', () => {
    const { result, id, partId } = setupRulesOnFirstPart();
    act(() => {
      result.current.updatePart(id, partId, { reroll: undefined });
    });
    act(() => {
      result.current.updatePart(id, partId, { explode: undefined });
    });
    const part = result.current.expressions[0]!.parts[0]!;
    expect('explode' in part).toBe(false);
    expect(Object.keys(part).sort()).toEqual(['count', 'id', 'sides']);
  });

  it('leaves the table valid for the next reload after both rules are cleared', () => {
    const { result, id, partId } = setupRulesOnFirstPart();
    act(() => {
      result.current.updatePart(id, partId, { reroll: undefined, explode: undefined });
    });
    const persisted = {
      version: 4,
      expressions: result.current.expressions,
      ui: {
        expandedId: result.current.expandedId,
        chartView: result.current.chartView,
        target: result.current.target,
        view: result.current.view,
        poolTarget: result.current.poolTarget,
        baselineId: result.current.baselineId,
      },
    };
    const round = JSON.parse(JSON.stringify(persisted)) as unknown;
    expect(validatePersistedState(round)).not.toBeNull();
  });
});
