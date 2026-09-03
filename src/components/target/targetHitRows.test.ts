import { describe, expect, it } from 'vitest';
import {
  rowHitChance,
  rowShowsUnderTarget,
  targetColumns,
  type TargetColumn,
  type TargetRow,
} from './targetHitRows';
import { expressionDistribution } from '../../engine/expression';
import type { Distribution, Expression, TargetState } from '../../types';

// 2d6 totals: 1,2,3,4,5,6,5,4,3,2,1 ways out of 36.
const SUM_2D6: Distribution = new Map(
  (
    [
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 4],
      [6, 5],
      [7, 6],
      [8, 5],
      [9, 4],
      [10, 3],
      [11, 2],
      [12, 1],
    ] as [number, number][]
  ).map(([value, ways]) => [value, ways / 36]),
);

// 2d6 counting 4+ as a success: per-die p = 3/6, so successes are binomial(2, 1/2).
const POOL_2D6_ON_4: Distribution = new Map([
  [0, 0.25],
  [1, 0.5],
  [2, 0.25],
]);

const sumExpr: Expression = {
  id: 'sum',
  name: 'Two dice',
  parts: [{ id: 'sum-p0', count: 2, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};

const poolExpr: Expression = {
  id: 'pool',
  name: 'Pool of two',
  parts: [{ id: 'pool-p0', count: 2, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'pool',
  successThreshold: { direction: 'gte', value: 4 },
};

const sumRow: TargetRow = {
  id: 'sum',
  name: 'Two dice',
  color: '#2563eb',
  isPool: false,
  dist: SUM_2D6,
  min: 2,
  max: 12,
};

const poolRow: TargetRow = {
  id: 'pool',
  name: 'Pool of two',
  color: '#ea580c',
  isPool: true,
  dist: POOL_2D6_ON_4,
  min: 0,
  max: 2,
};

const numericColumn: TargetColumn = { value: 10, pool: false };
const poolColumn: TargetColumn = { value: 2, pool: true };

// The rows above carry hand-written distributions so no cache or provider is
// needed. These two keep those hand-written numbers honest: if the engine ever
// stopped agreeing, every probability below would be measuring a fiction.
function expectSameDistribution(actual: Distribution, expected: Distribution): void {
  expect([...actual.keys()].sort((a, b) => a - b)).toEqual(
    [...expected.keys()].sort((a, b) => a - b),
  );
  for (const [value, p] of expected) {
    expect(actual.get(value) ?? 0).toBeCloseTo(p, 12);
  }
}

describe('the hand-written fixtures', () => {
  it('matches the engine for a 2d6 sum row', () => {
    expectSameDistribution(expressionDistribution(sumExpr), SUM_2D6);
  });

  it('matches the engine for a 2d6 pool row counting 4+ as a success', () => {
    expectSameDistribution(expressionDistribution(poolExpr), POOL_2D6_ON_4);
  });
});

describe('targetColumns', () => {
  it('lists one non-pool column per numeric target', () => {
    const target: TargetState = { values: [7, 10], ruling: 'gte' };
    expect(targetColumns(target, 2, false)).toEqual([
      { value: 7, pool: false },
      { value: 10, pool: false },
    ]);
  });

  it('keeps the numeric targets in the order they were set', () => {
    const target: TargetState = { values: [10, 7], ruling: 'gte' };
    expect(targetColumns(target, 2, false)).toEqual([
      { value: 10, pool: false },
      { value: 7, pool: false },
    ]);
  });

  it('still lists only the numeric targets when the table holds a pool row', () => {
    const target: TargetState = { values: [7, 10], ruling: 'gte' };
    expect(targetColumns(target, 2, true)).toEqual([
      { value: 7, pool: false },
      { value: 10, pool: false },
    ]);
  });

  it('stands the pool target in as the only column when no numeric target is set', () => {
    const target: TargetState = { values: [], ruling: 'gte' };
    expect(targetColumns(target, 2, true)).toEqual([{ value: 2, pool: true }]);
  });

  it('carries whatever the pool target happens to be into that stand-in column', () => {
    const target: TargetState = { values: [], ruling: 'gte' };
    expect(targetColumns(target, 5, true)).toEqual([{ value: 5, pool: true }]);
  });

  it('has no columns when no numeric target is set and no row is a pool', () => {
    const target: TargetState = { values: [], ruling: 'gte' };
    expect(targetColumns(target, 2, false)).toEqual([]);
  });
});

describe('rowShowsUnderTarget', () => {
  it('shows a pool row under the pool column', () => {
    expect(rowShowsUnderTarget(poolRow, poolColumn, 0)).toBe(true);
  });

  it('hides a sum row under the pool column', () => {
    expect(rowShowsUnderTarget(sumRow, poolColumn, 0)).toBe(false);
  });

  it('shows a pool row under the first numeric column', () => {
    expect(rowShowsUnderTarget(poolRow, numericColumn, 0)).toBe(true);
  });

  it('shows a sum row under the first numeric column', () => {
    expect(rowShowsUnderTarget(sumRow, numericColumn, 0)).toBe(true);
  });

  it('hides a pool row under a second numeric column', () => {
    expect(rowShowsUnderTarget(poolRow, numericColumn, 1)).toBe(false);
  });

  it('shows a sum row under a second numeric column', () => {
    expect(rowShowsUnderTarget(sumRow, numericColumn, 1)).toBe(true);
  });
});

describe('rowHitChance', () => {
  it('measures a pool row against the pool target as a minimum success count', () => {
    expect(rowHitChance(poolRow, poolColumn, 'gte', 2)).toBeCloseTo(0.25, 12);
    expect(rowHitChance(poolRow, poolColumn, 'gte', 1)).toBeCloseTo(0.75, 12);
  });

  it('ignores the column value and the ruling for a pool row', () => {
    // Under the column's own terms (10, 'lte') every success count would hit.
    expect(rowHitChance(poolRow, numericColumn, 'lte', 2)).toBeCloseTo(0.25, 12);
  });

  it('measures a sum row against the column value under the shared ruling', () => {
    expect(rowHitChance(sumRow, numericColumn, 'gte', 2)).toBeCloseTo(6 / 36, 12);
  });

  it('follows the ruling for a sum row', () => {
    expect(rowHitChance(sumRow, { value: 3, pool: false }, 'lte', 2)).toBeCloseTo(
      3 / 36,
      12,
    );
  });

  it('ignores the pool target for a sum row', () => {
    expect(rowHitChance(sumRow, numericColumn, 'gte', 12)).toBeCloseTo(6 / 36, 12);
  });
});

// The three pieces as TargetHitView chains them, which is where the regression
// lived: a table whose only rolls are pools used to produce no columns at all.
describe('a table with no numeric target set', () => {
  const noValues: TargetState = { values: [], ruling: 'gte' };

  it('measures a pool row against the pool target in the one column it gets', () => {
    const columns = targetColumns(noValues, 2, true);
    expect(columns).toHaveLength(1);
    const column = columns[0]!;
    expect(rowShowsUnderTarget(poolRow, column, 0)).toBe(true);
    expect(rowHitChance(poolRow, column, noValues.ruling, 2)).toBeCloseTo(0.25, 12);
  });

  it('leaves a sum row unmeasured until a numeric target joins the pool row', () => {
    const poolOnly = targetColumns(noValues, 2, true);
    expect(rowShowsUnderTarget(sumRow, poolOnly[0]!, 0)).toBe(false);

    const withNumeric = targetColumns({ values: [10], ruling: 'gte' }, 2, true);
    expect(rowShowsUnderTarget(sumRow, withNumeric[0]!, 0)).toBe(true);
    expect(rowHitChance(sumRow, withNumeric[0]!, 'gte', 2)).toBeCloseTo(6 / 36, 12);
  });
});
