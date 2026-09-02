import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { AppProvider } from './AppContext';
import { useApp } from './useApp';
import { getRowData, useDistributions } from './useDistributions';
import type { CheckSpec, DicePart, Expression } from '../types';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

afterEach(() => {
  window.localStorage.clear();
});

function checkSpec(overrides: Partial<CheckSpec> = {}): CheckSpec {
  return {
    threshold: { direction: 'gte', value: 15 },
    effect: { parts: [{ id: 'fx', count: 1, sides: 8 }], flatModifier: 4 },
    onSuccess: 'full',
    onFailure: 'none',
    ...overrides,
  };
}

function checkRow(
  parts: DicePart[],
  spec: Partial<CheckSpec> = {},
  overrides: Partial<Expression> = {},
): Expression {
  return {
    id: 'c0',
    name: 'Check row',
    parts,
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'check',
    check: checkSpec(spec),
    ...overrides,
  };
}

function sumRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e0',
    name: 'Sum row',
    parts: [{ id: 'p0', count: 1, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function seedRows(expressions: Expression[]) {
  const state = {
    version: 4,
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
    JSON.stringify({ version: 2, value: state }),
  );
}

function renderSelector() {
  return renderHook(() => ({ app: useApp(), sel: useDistributions() }), {
    wrapper,
  });
}

// 1d20+7 needing 15: faces 8..19 succeed (12/20 = 0.6), face 20 crits (0.05),
// faces 1..7 fail (0.35). The effect is 1d8+4; a crit doubles it to 2d8+4.
const CRIT_ROW = checkRow(
  [{ id: 'p0', count: 1, sides: 20 }],
  { crit: { onFaces: [20], effect: 'doubleDice' } },
  { flatModifier: 7 },
);

describe('getRowData check odds', () => {
  // Twenty exact 1/20ths sum to 1.0000000000000002 in IEEE arithmetic; the
  // row must still read as certain, not as a >99% hedge.
  it('reads a 1d20 check that cannot miss as exactly certain', () => {
    const chances = getRowData(
      checkRow([{ id: 'p0', count: 1, sides: 20 }], {
        threshold: { direction: 'gte', value: 1 },
      }),
    ).checkChances;
    expect(chances?.success).toBe(1);
    expect(chances?.crit).toBe(0);
    expect(chances?.failure).toBe(0);
  });

  // Six 1/6ths sum to 0.9999999999999999, the residue on the other side of 1.
  it('reads a 1d6 check that cannot miss as exactly certain', () => {
    const chances = getRowData(
      checkRow([{ id: 'p0', count: 1, sides: 6 }], {
        threshold: { direction: 'gte', value: 1 },
      }),
    ).checkChances;
    expect(chances?.success).toBe(1);
    expect(chances?.crit).toBe(0);
    expect(chances?.failure).toBe(0);
  });

  it('reads a 2d6 check that cannot miss as exactly certain', () => {
    const chances = getRowData(
      checkRow([{ id: 'p0', count: 2, sides: 6 }], {
        threshold: { direction: 'gte', value: 2 },
      }),
    ).checkChances;
    expect(chances?.success).toBe(1);
    expect(chances?.crit).toBe(0);
    expect(chances?.failure).toBe(0);
  });

  // A phantom failure mass on 0 would draw a spike in the chart for a hit
  // that cannot miss.
  it('puts no failure mass on 0 for a 2d6 check that cannot miss', () => {
    const { dist } = getRowData(
      checkRow([{ id: 'p0', count: 2, sides: 6 }], {
        threshold: { direction: 'gte', value: 2 },
      }),
    );
    expect(dist.get(0)).toBeUndefined();
    // The whole 1d8+4 effect lands with weight 1, so its low end is 1/8.
    expect(dist.get(5)).toBeCloseTo(1 / 8, 12);
  });

  it('reads a check the die can never pass as exactly a certain failure', () => {
    const chances = getRowData(
      checkRow([{ id: 'p0', count: 1, sides: 20 }], {
        threshold: { direction: 'gte', value: 21 },
      }),
    ).checkChances;
    expect(chances?.failure).toBe(1);
    expect(chances?.success).toBe(0);
    expect(chances?.crit).toBe(0);
  });

  it('collapses a check the die can never pass to a single point at 0 when a miss deals nothing', () => {
    const { dist, stats, tooComplex } = getRowData(
      checkRow([{ id: 'p0', count: 1, sides: 20 }], {
        threshold: { direction: 'gte', value: 21 },
      }),
    );
    expect(dist.size).toBe(1);
    expect(dist.get(0)).toBeCloseTo(1, 12);
    expect(stats.mean).toBe(0);
    expect(tooComplex).toBe(false);
  });

  it('yields null chances and an empty distribution for a check row with no dice', () => {
    const { checkChances, dist, tooComplex, stats } = getRowData(checkRow([]));
    expect(checkChances).toBeNull();
    expect(dist.size).toBe(0);
    expect(tooComplex).toBe(false);
    expect(stats.hasDist).toBe(false);
    expect(stats.mean).toBe(0);
  });

  it('splits a crit-capable check into success, crit and failure that sum to 1', () => {
    const chances = getRowData(CRIT_ROW).checkChances;
    expect(chances?.success).toBeCloseTo(0.6, 12);
    expect(chances?.crit).toBeCloseTo(0.05, 12);
    expect(chances?.failure).toBeCloseTo(0.35, 12);
    expect(
      (chances?.success ?? 0) + (chances?.crit ?? 0) + (chances?.failure ?? 0),
    ).toBeCloseTo(1, 12);
  });

  it('never carries check chances on a sum row', () => {
    expect(getRowData(sumRow()).checkChances).toBeNull();
  });

  // 1d4: mean 2.5, variance ((1.5)^2 + (0.5)^2 + (0.5)^2 + (1.5)^2) / 4 = 5/4.
  it('computes the stats of a sum row', () => {
    const { stats } = getRowData(
      sumRow({ parts: [{ id: 'q', count: 1, sides: 4 }] }),
    );
    expect(stats.mean).toBeCloseTo(2.5, 12);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(4);
    expect(stats.mode).toEqual([1, 2, 3, 4]);
    expect(stats.stddev).toBeCloseTo(Math.sqrt(1.25), 12);
  });
});

describe('getRowData across an edit', () => {
  it('serves fresh odds after the flat modifier changes', () => {
    seedRows([CRIT_ROW]);
    const { result } = renderHook(() => useApp(), { wrapper });
    const before = getRowData(result.current.expressions[0]!);
    act(() => {
      result.current.updateExpression('c0', { flatModifier: 8 });
    });
    const after = getRowData(result.current.expressions[0]!);
    // With +8, faces 7..19 clear the 15: 13/20 succeed, 6/20 fail.
    expect(after.checkChances?.success).toBeCloseTo(0.65, 12);
    expect(after.checkChances?.crit).toBeCloseTo(0.05, 12);
    expect(after.checkChances?.failure).toBeCloseTo(0.3, 12);
    expect(after).not.toBe(before);
  });
});

describe('useDistributions', () => {
  it('yields nothing for an empty table', () => {
    const { result } = renderSelector();
    expect(result.current.sel.dists.size).toBe(0);
    expect(result.current.sel.tooComplex.size).toBe(0);
  });

  it('mixes a check row from failure, success and doubled crit outcomes', () => {
    seedRows([CRIT_ROW]);
    const { result } = renderSelector();
    const dist = result.current.sel.dists.get('c0')!;
    // Failure (0.35) sits on 0. Success (0.6) spreads 1d8+4 over 5..12 at
    // 0.6/8 = 0.075 each. Crit (0.05) spreads 2d8+4 over 6..20, where
    // P(2d8 = 2) = 1/64, P(2d8 = 8) = 7/64, P(2d8 = 9) = 8/64, P(2d8 = 16) = 1/64.
    expect(dist.get(0)).toBeCloseTo(0.35, 12);
    expect(dist.get(5)).toBeCloseTo(0.075, 12);
    expect(dist.get(6)).toBeCloseTo(0.075 + 0.05 / 64, 12);
    expect(dist.get(12)).toBeCloseTo(0.075 + (0.05 * 7) / 64, 12);
    expect(dist.get(13)).toBeCloseTo((0.05 * 8) / 64, 12);
    expect(dist.get(20)).toBeCloseTo(0.05 / 64, 12);
    expect(dist.size).toBe(17);
    let total = 0;
    for (const p of dist.values()) total += p;
    expect(total).toBeCloseTo(1, 12);
  });

  // Reachable from the reroll editor on a check die: every face rerolled
  // leaves nothing to roll, which is "cannot compute", not "too complex".
  it('yields null chances and an empty distribution, but no too-complex flag, when every check face is rerolled', () => {
    const { result } = renderSelector();
    act(() => {
      result.current.app.addExpression();
    });
    const id = result.current.app.expressions[0]!.id;
    const partId = result.current.app.expressions[0]!.parts[0]!.id;
    act(() => {
      result.current.app.updateExpression(id, { mode: 'check' });
    });
    act(() => {
      result.current.app.updatePart(id, partId, {
        reroll: {
          values: Array.from({ length: 20 }, (_, i) => i + 1),
          mode: 'always',
        },
      });
    });
    expect(getRowData(result.current.app.expressions[0]!).checkChances).toBeNull();
    expect(result.current.sel.dists.get(id)!.size).toBe(0);
    expect(result.current.sel.tooComplex.has(id)).toBe(false);
  });

  // The 1d20 vs 10 odds alone would be a cheap 0.55 / 0.45, but showing them
  // beside a "(too complex)" distribution would be a mixed signal.
  it('flags a check row with a too-complex effect and withholds its odds', () => {
    // Keep highest 1 of 100d100 costs C(199, 99) states, far past the guard.
    seedRows([
      checkRow([{ id: 'p0', count: 1, sides: 20 }], {
        threshold: { direction: 'gte', value: 10 },
        effect: {
          parts: [
            { id: 'fx', count: 100, sides: 100, keep: { type: 'highest', n: 1 } },
          ],
          flatModifier: 0,
        },
      }),
    ]);
    const { result } = renderSelector();
    expect(result.current.sel.tooComplex.has('c0')).toBe(true);
    expect(result.current.sel.dists.get('c0')!.size).toBe(0);
    expect(getRowData(result.current.app.expressions[0]!).checkChances).toBeNull();
  });

  // 317 squared is 100489, just past the 1e5 cap.
  it('flags a pool row past the complexity cap with an empty distribution', () => {
    seedRows([
      sumRow({
        id: 'pool',
        parts: [{ id: 'p', count: 317, sides: 6 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 4 },
      }),
      sumRow({ id: 'sum', parts: [{ id: 'q', count: 1, sides: 4 }] }),
    ]);
    const { result } = renderSelector();
    expect(result.current.sel.tooComplex.has('pool')).toBe(true);
    expect(result.current.sel.dists.get('pool')!.size).toBe(0);
    expect(result.current.sel.tooComplex.has('sum')).toBe(false);
  });

  it('spreads a 1d4 sum row evenly over its four faces', () => {
    seedRows([sumRow({ id: 'sum', parts: [{ id: 'q', count: 1, sides: 4 }] })]);
    const { result } = renderSelector();
    const dist = result.current.sel.dists.get('sum')!;
    expect(dist.size).toBe(4);
    for (const face of [1, 2, 3, 4]) {
      expect(dist.get(face)).toBeCloseTo(0.25, 12);
    }
  });

  it('keeps the same selector result across a UI-only state change', () => {
    seedRows([
      sumRow(),
      sumRow({ id: 'e1', parts: [{ id: 'p1', count: 1, sides: 4 }] }),
    ]);
    const { result } = renderSelector();
    const previousDists = result.current.sel.dists;
    const previousExpressions = result.current.app.expressions;
    act(() => {
      result.current.app.setChartView('cdf');
    });
    expect(result.current.app.chartView).toBe('cdf');
    expect(result.current.app.expressions).toBe(previousExpressions);
    expect(result.current.sel.dists).toBe(previousDists);
  });

  it('replaces the selector result after an edit but keeps the untouched sibling distribution', () => {
    seedRows([
      sumRow(),
      sumRow({ id: 'e1', parts: [{ id: 'p1', count: 1, sides: 4 }] }),
    ]);
    const { result } = renderSelector();
    const previousDists = result.current.sel.dists;
    const previousSibling = previousDists.get('e1');
    act(() => {
      result.current.app.updateExpression('e0', { flatModifier: 2 });
    });
    expect(result.current.sel.dists).not.toBe(previousDists);
    expect(result.current.sel.dists.get('e1')).toBe(previousSibling);
  });

  it('recomputes the edited row with the new modifier', () => {
    seedRows([sumRow()]);
    const { result } = renderSelector();
    act(() => {
      result.current.app.updateExpression('e0', { flatModifier: 2 });
    });
    const dist = result.current.sel.dists.get('e0')!;
    expect(dist.get(1)).toBeUndefined();
    for (const value of [3, 4, 5, 6, 7, 8]) {
      expect(dist.get(value)).toBeCloseTo(1 / 6, 12);
    }
  });
});
