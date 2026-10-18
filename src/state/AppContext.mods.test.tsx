import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AppProvider } from './AppContext';
import { useApp } from './useApp';
import { getRowData } from './useDistributions';
import { modsForModifier } from './modChain';
import { SCHEMA_VERSION } from './persistedSchema';
import type { Expression, ModStep } from '../types';

const STORAGE_KEY = 'dicetable.v2';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

afterEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
});

const PLUS_THREE_TIMES_TWO: ModStep[] = [
  { op: 'add', value: 3 },
  { op: 'mul', value: 2 },
];

function sumRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e0',
    name: '2d6',
    parts: [{ id: 'p0', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function checkRow(flatModifier: number): Expression {
  return {
    id: 'e0',
    name: 'Attack',
    parts: [{ id: 'check-die', count: 1, sides: 20 }],
    flatModifier,
    rollMode: 'normal',
    mode: 'check',
    check: {
      threshold: { direction: 'gte', value: 15 },
      effect: { parts: [{ id: 'effect-die', count: 1, sides: 8 }], flatModifier: 0 },
      onSuccess: 'full',
      onFailure: 'none',
    },
  };
}

function seedRows(expressions: Expression[], version: number = SCHEMA_VERSION) {
  const state = {
    version,
    expressions,
    ui: {
      expandedId: null,
      target: { values: [] as number[], ruling: 'gte' as const },
    },
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, value: state }));
}

function render() {
  return renderHook(() => useApp(), { wrapper });
}

type Hook = ReturnType<typeof render>['result'];

function at(result: Hook, index: number): Expression {
  const expr = result.current.expressions[index];
  if (expr === undefined) throw new Error(`no row at index ${index}`);
  return expr;
}

function hasMods(expr: Expression): boolean {
  return 'mods' in expr;
}

function meanOf(expr: Expression): number {
  return getRowData(expr).stats.mean;
}

interface PersistedEnvelope {
  version: number;
  value: { version: number; expressions: Record<string, unknown>[] };
}

/** Writes are debounced; this lands the pending one and reads it back. */
function flushAndReadEnvelope(): PersistedEnvelope {
  act(() => {
    vi.advanceTimersByTime(250);
  });
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) throw new Error('nothing persisted');
  return JSON.parse(raw) as PersistedEnvelope;
}

describe('AppContext updateExpression with a mod chain', () => {
  it('sets a two-step chain on a sum row', () => {
    seedRows([sumRow()]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: PLUS_THREE_TIMES_TWO });
    });
    expect(at(result, 0).mods).toEqual(PLUS_THREE_TIMES_TWO);
    expect(at(result, 0).flatModifier).toBe(0);
  });

  it('moves the row mean to (7 + 3) × 2 = 20', () => {
    seedRows([sumRow()]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: PLUS_THREE_TIMES_TWO });
    });
    expect(meanOf(at(result, 0))).toBeCloseTo(20, 12);
  });

  it('gives the reordered chain ×2 then +3 the mean 7 × 2 + 3 = 17', () => {
    seedRows([sumRow({ mods: PLUS_THREE_TIMES_TWO })]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', {
        mods: [
          { op: 'mul', value: 2 },
          { op: 'add', value: 3 },
        ],
      });
    });
    expect(meanOf(at(result, 0))).toBeCloseTo(17, 12);
  });

  it('removes the chain key when the patch names mods as undefined', () => {
    seedRows([sumRow({ mods: PLUS_THREE_TIMES_TWO })]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: undefined });
    });
    expect(hasMods(at(result, 0))).toBe(false);
  });

  it('removes the chain key when the patch hands an empty chain', () => {
    seedRows([sumRow({ mods: PLUS_THREE_TIMES_TWO })]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: [] });
    });
    expect(hasMods(at(result, 0))).toBe(false);
  });

  it('leaves the chain alone when the patch does not mention mods', () => {
    seedRows([sumRow({ mods: PLUS_THREE_TIMES_TWO })]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { rollMode: 'advantage' });
    });
    expect(at(result, 0).mods).toEqual(PLUS_THREE_TIMES_TWO);
  });

  it('clears a lone +3 when the Mod box is set to 0', () => {
    seedRows([sumRow({ mods: [{ op: 'add', value: 3 }] })]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: modsForModifier(0) });
    });
    expect(hasMods(at(result, 0))).toBe(false);
    expect(meanOf(at(result, 0))).toBeCloseTo(7, 12);
  });

  it('stores a Mod box value of −2 as a subtract step', () => {
    seedRows([sumRow()]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: modsForModifier(-2) });
    });
    expect(at(result, 0).mods).toEqual([{ op: 'sub', value: 2 }]);
  });

  it('stores an add step handed a negative amount as a subtract of its size', () => {
    seedRows([sumRow()]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: [{ op: 'add', value: -2 }] });
    });
    expect(at(result, 0).mods).toEqual([{ op: 'sub', value: 2 }]);
  });

  it('returns every other row as the same object after a chain edit', () => {
    seedRows([
      sumRow(),
      sumRow({ id: 'e1', name: 'Other', parts: [{ id: 'p1', count: 1, sides: 8 }] }),
    ]);
    const { result } = render();
    const untouched = at(result, 1);
    act(() => {
      result.current.updateExpression('e0', { mods: PLUS_THREE_TIMES_TWO });
    });
    expect(at(result, 1)).toBe(untouched);
  });
});

describe('AppContext mode switch with a mod chain', () => {
  it('hands a sum row chain of +2 then −1 to a check as a modifier of 1', () => {
    seedRows([
      sumRow({
        mods: [
          { op: 'add', value: 2 },
          { op: 'sub', value: 1 },
        ],
      }),
    ]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mode: 'check' });
    });
    const row = at(result, 0);
    expect(row.mode).toBe('check');
    expect(row.flatModifier).toBe(1);
    expect(hasMods(row)).toBe(false);
  });

  it('starts the check modifier at 0 when the chain multiplies', () => {
    seedRows([sumRow({ mods: PLUS_THREE_TIMES_TWO })]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mode: 'check' });
    });
    const row = at(result, 0);
    expect(row.flatModifier).toBe(0);
    expect(hasMods(row)).toBe(false);
  });

  it('starts the check modifier at 0 from a row with no chain', () => {
    seedRows([sumRow()]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mode: 'check' });
    });
    expect(at(result, 0).flatModifier).toBe(0);
    expect(hasMods(at(result, 0))).toBe(false);
  });

  it('moves a check modifier of 4 into the chain as +4 on the way to sum', () => {
    seedRows([checkRow(4)]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mode: 'sum' });
    });
    const row = at(result, 0);
    expect(row.mode).toBe('sum');
    expect(row.mods).toEqual([{ op: 'add', value: 4 }]);
    expect(row.flatModifier).toBe(0);
  });

  it('moves a check modifier of −3 into the chain as a subtract on the way to pool', () => {
    seedRows([checkRow(-3)]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    const row = at(result, 0);
    expect(row.mods).toEqual([{ op: 'sub', value: 3 }]);
    expect(row.flatModifier).toBe(0);
  });

  it('leaves no chain when a check with modifier 0 becomes a sum row', () => {
    seedRows([checkRow(0)]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mode: 'sum' });
    });
    expect(hasMods(at(result, 0))).toBe(false);
    expect(at(result, 0).flatModifier).toBe(0);
  });

  it('brings a check modifier back unchanged after a round trip through sum', () => {
    seedRows([checkRow(4)]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mode: 'sum' });
    });
    act(() => {
      result.current.updateExpression('e0', { mode: 'check' });
    });
    expect(at(result, 0).flatModifier).toBe(4);
    expect(hasMods(at(result, 0))).toBe(false);
  });

  it('keeps the chain when a sum row becomes a pool row', () => {
    seedRows([sumRow({ mods: PLUS_THREE_TIMES_TWO })]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    expect(at(result, 0).mode).toBe('pool');
    expect(at(result, 0).mods).toEqual(PLUS_THREE_TIMES_TWO);
  });

  it('keeps the chain when a pool row becomes a sum row', () => {
    seedRows([sumRow({ mods: PLUS_THREE_TIMES_TWO })]);
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mode: 'pool' });
    });
    act(() => {
      result.current.updateExpression('e0', { mode: 'sum' });
    });
    expect(at(result, 0).mods).toEqual(PLUS_THREE_TIMES_TWO);
    expect(meanOf(at(result, 0))).toBeCloseTo(20, 12);
  });
});

describe('AppContext duplicate with a mod chain', () => {
  const threeSteps: ModStep[] = [
    { op: 'add', value: 3 },
    { op: 'mul', value: 2 },
    { op: 'div', value: 3 },
  ];

  it('copies every step of the chain onto the copy', () => {
    seedRows([sumRow({ mods: threeSteps })]);
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('e0');
    });
    expect(result.current.expressions).toHaveLength(2);
    expect(at(result, 1).mods).toEqual(threeSteps);
  });

  it('gives the copy the same mean as the source', () => {
    seedRows([sumRow({ mods: threeSteps })]);
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('e0');
    });
    expect(meanOf(at(result, 1))).toBeCloseTo(meanOf(at(result, 0)), 12);
  });

  it('editing the copy chain leaves the source chain alone', () => {
    seedRows([sumRow({ mods: threeSteps })]);
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('e0');
    });
    const copyId = at(result, 1).id;
    act(() => {
      result.current.updateExpression(copyId, { mods: [{ op: 'add', value: 1 }] });
    });
    expect(at(result, 0).mods).toEqual(threeSteps);
    expect(at(result, 1).mods).toEqual([{ op: 'add', value: 1 }]);
  });
});

describe('AppContext persistence of a mod chain', () => {
  it('writes the saved table at schema version 7', () => {
    seedRows([sumRow()]);
    vi.useFakeTimers();
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: PLUS_THREE_TIMES_TWO });
    });
    expect(flushAndReadEnvelope().value.version).toBe(7);
  });

  it('writes the chain on the saved row with flatModifier 0', () => {
    seedRows([sumRow()]);
    vi.useFakeTimers();
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: PLUS_THREE_TIMES_TWO });
    });
    const saved = flushAndReadEnvelope().value.expressions[0];
    expect(saved?.mods).toEqual(PLUS_THREE_TIMES_TWO);
    expect(saved?.flatModifier).toBe(0);
  });

  it('leaves no mods key on the saved row once the chain is cleared', () => {
    seedRows([sumRow({ mods: PLUS_THREE_TIMES_TWO })]);
    vi.useFakeTimers();
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: undefined });
    });
    const saved = flushAndReadEnvelope().value.expressions[0];
    expect(saved).toBeDefined();
    expect(saved !== undefined && 'mods' in saved).toBe(false);
  });

  it('brings the chain back after a reload', () => {
    seedRows([sumRow()]);
    vi.useFakeTimers();
    const { result, unmount } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: PLUS_THREE_TIMES_TWO });
    });
    flushAndReadEnvelope();
    unmount();
    vi.useRealTimers();
    const second = render().result;
    expect(at(second, 0).mods).toEqual(PLUS_THREE_TIMES_TWO);
    expect(meanOf(at(second, 0))).toBeCloseTo(20, 12);
  });

  it('loads a version 6 save with a sum modifier of 3 as a +3 step, mean still 10', () => {
    seedRows([sumRow({ flatModifier: 3 })], 6);
    const { result } = render();
    const row = at(result, 0);
    expect(row.mods).toEqual([{ op: 'add', value: 3 }]);
    expect(row.flatModifier).toBe(0);
    expect(meanOf(row)).toBeCloseTo(10, 12);
  });
});
