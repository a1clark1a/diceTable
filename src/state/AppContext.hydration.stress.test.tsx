import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AppProvider } from './AppContext';
import { useApp } from './useApp';
import { SCHEMA_VERSION, validatePersistedState } from './persistedSchema';
import type { CheckSpec, Expression } from '../types';

// Hydration is the one entry point where a stale envelope meets today's rules.
// The validator runs first and stays strict, then normalizeExpression repairs
// what validation lets through. These tests pin both halves of that contract:
// validator-passing defects heal in place, validator-rejected defects fall back
// to the empty first-run table instead of loading a broken row.

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

afterEach(() => {
  window.localStorage.clear();
});

function checkSpec(overrides: Partial<CheckSpec> = {}): CheckSpec {
  return {
    threshold: { direction: 'gte', value: 10 },
    effect: { parts: [{ id: 'fx0', count: 1, sides: 6 }], flatModifier: 0 },
    onSuccess: 'full',
    onFailure: 'none',
    ...overrides,
  };
}

function seed(expressions: unknown[]): void {
  const value = {
    version: SCHEMA_VERSION,
    expressions,
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [] as number[], ruling: 'gte' as const },
      view: 'table' as const,
      poolTarget: 1,
      baselineId: null,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value }),
  );
}

function checkRowWithCrit(sides: number, onFaces: number[]): Expression {
  return {
    id: 'e0',
    name: 'Old check',
    parts: [{ id: 'p0', count: 1, sides }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'check',
    check: checkSpec({ crit: { onFaces, effect: 'doubleDice' } }),
  };
}

describe('AppProvider hydration healing', () => {
  it('clamps a stored crit face the shrunken die cannot show', () => {
    seed([checkRowWithCrit(6, [5, 20])]);
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.expressions).toHaveLength(1);
    expect(result.current.expressions[0]!.check?.crit).toEqual({
      onFaces: [5],
      effect: 'doubleDice',
    });
  });

  it('drops a stored critical whose faces all overshoot the die but keeps the check', () => {
    seed([checkRowWithCrit(6, [19, 20])]);
    const { result } = renderHook(() => useApp(), { wrapper });
    const row = result.current.expressions[0]!;
    expect(row.check?.crit).toBeUndefined();
    expect(row.check?.threshold).toEqual({ direction: 'gte', value: 10 });
    expect(row.check?.onSuccess).toBe('full');
  });

  it('sheds a stray pool threshold stored on a sum row', () => {
    seed([
      {
        id: 'e0',
        name: 'Old sum',
        parts: [{ id: 'p0', count: 2, sides: 6 }],
        flatModifier: 1,
        rollMode: 'normal',
        mode: 'sum',
        successThreshold: { direction: 'gte', value: 4 },
      },
    ]);
    const { result } = renderHook(() => useApp(), { wrapper });
    const row = result.current.expressions[0]!;
    expect(row.successThreshold).toBeUndefined();
    expect(row.parts).toEqual([{ id: 'p0', count: 2, sides: 6 }]);
    expect(row.flatModifier).toBe(1);
  });

  it('sheds a stray pool threshold stored on a check row', () => {
    seed([
      {
        ...checkRowWithCrit(20, [20]),
        successThreshold: { direction: 'lte', value: 3 },
      },
    ]);
    const { result } = renderHook(() => useApp(), { wrapper });
    const row = result.current.expressions[0]!;
    expect(row.successThreshold).toBeUndefined();
    expect(row.check?.crit).toEqual({ onFaces: [20], effect: 'doubleDice' });
  });

  it('every healed table re-validates when persisted again', () => {
    const healable: unknown[][] = [
      [checkRowWithCrit(6, [5, 20])],
      [checkRowWithCrit(6, [19, 20])],
      [
        {
          id: 'e0',
          name: 'Old sum',
          parts: [{ id: 'p0', count: 2, sides: 6 }],
          flatModifier: 0,
          rollMode: 'normal',
          mode: 'sum',
          successThreshold: { direction: 'gte', value: 4 },
        },
      ],
    ];
    for (const expressions of healable) {
      window.localStorage.clear();
      seed(expressions);
      const { result, unmount } = renderHook(() => useApp(), { wrapper });
      const persisted = {
        version: SCHEMA_VERSION,
        expressions: result.current.expressions,
        ui: {
          expandedId: result.current.expandedId,
          chartView: result.current.chartView,
          target: result.current.target,
          view: result.current.view,
          poolTargets: result.current.poolTargets,
          baselineId: result.current.baselineId,
        },
      };
      const round = JSON.parse(JSON.stringify(persisted)) as unknown;
      expect(validatePersistedState(round), JSON.stringify(expressions)).not.toBeNull();
      expect(result.current.expressions.length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('falls back to the empty first-run table when a stored row is irreparable', () => {
    // keep + keepAcross on the same row is rejected by the validator before
    // normalize ever sees it; the whole envelope gives way to the initial state
    // rather than loading a row the math would misread.
    seed([
      {
        id: 'e0',
        name: 'Conflicted',
        parts: [{ id: 'p0', count: 2, sides: 6, keep: { type: 'highest', n: 1 } }],
        flatModifier: 0,
        rollMode: 'normal',
        mode: 'sum',
        keepAcross: { type: 'highest', n: 1 },
      },
    ]);
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.expressions).toEqual([]);
  });

  it('healing one row never costs a clean sibling row its place in the table', () => {
    seed([
      {
        id: 'e1',
        name: 'Clean',
        parts: [{ id: 'p1', count: 1, sides: 8 }],
        flatModifier: 0,
        rollMode: 'normal',
        mode: 'sum',
      },
      checkRowWithCrit(6, [5, 20]),
    ]);
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.expressions.map((e) => e.id)).toEqual(['e1', 'e0']);
    expect(result.current.expressions[0]!.parts[0]!.sides).toBe(8);
    expect(result.current.expressions[1]!.check?.crit?.onFaces).toEqual([5]);
  });
});
