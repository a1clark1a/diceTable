import { describe, expect, it } from 'vitest';
import {
  rowHitChance,
  rowShowsUnderTarget,
  targetColumns,
  toTargetRows,
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
  slot: 0,
  color: '#2563eb',
  isPool: false,
  dist: SUM_2D6,
  min: 2,
  max: 12,
};

const poolRow: TargetRow = {
  id: 'pool',
  name: 'Pool of two',
  slot: 0,
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
  const noValues: TargetState = { values: [], ruling: 'gte' };

  it('lists one numeric column per numeric target', () => {
    const target: TargetState = { values: [7, 10], ruling: 'gte' };
    expect(targetColumns(target, [2], false, true)).toEqual([
      { value: 7, pool: false },
      { value: 10, pool: false },
    ]);
  });

  it('keeps the numeric targets in the order they were set', () => {
    const target: TargetState = { values: [10, 7], ruling: 'gte' };
    expect(targetColumns(target, [2], false, true)).toEqual([
      { value: 10, pool: false },
      { value: 7, pool: false },
    ]);
  });

  it('lists one pool column per pool target after the numeric ones', () => {
    const target: TargetState = { values: [7, 10], ruling: 'gte' };
    expect(targetColumns(target, [1, 3], true, true)).toEqual([
      { value: 7, pool: false },
      { value: 10, pool: false },
      { value: 1, pool: true },
      { value: 3, pool: true },
    ]);
  });

  it('gives an all-pool table only its pool columns', () => {
    const target: TargetState = { values: [7, 10], ruling: 'gte' };
    expect(targetColumns(target, [1, 3], true, false)).toEqual([
      { value: 1, pool: true },
      { value: 3, pool: true },
    ]);
  });

  it('gives an all-sum table only its numeric columns', () => {
    const target: TargetState = { values: [7], ruling: 'gte' };
    expect(targetColumns(target, [1, 3], false, true)).toEqual([
      { value: 7, pool: false },
    ]);
  });

  it('still gives a pool row its columns with no numeric target set', () => {
    expect(targetColumns(noValues, [2], true, true)).toEqual([
      { value: 2, pool: true },
    ]);
  });

  it('has no columns when no numeric target is set and no row is a pool', () => {
    expect(targetColumns(noValues, [2], false, true)).toEqual([]);
  });
});

describe('rowShowsUnderTarget', () => {
  it('shows a pool row under a pool column', () => {
    expect(rowShowsUnderTarget(poolRow, poolColumn)).toBe(true);
  });

  it('hides a sum row under a pool column', () => {
    expect(rowShowsUnderTarget(sumRow, poolColumn)).toBe(false);
  });

  it('hides a pool row under a numeric column', () => {
    expect(rowShowsUnderTarget(poolRow, numericColumn)).toBe(false);
  });

  it('shows a sum row under a numeric column', () => {
    expect(rowShowsUnderTarget(sumRow, numericColumn)).toBe(true);
  });

  it('shows a sum row under every numeric column, not just the first', () => {
    expect(rowShowsUnderTarget(sumRow, { value: 3, pool: false })).toBe(true);
    expect(rowShowsUnderTarget(sumRow, { value: 11, pool: false })).toBe(true);
  });

  it('shows a pool row under every pool column, not just the first', () => {
    expect(rowShowsUnderTarget(poolRow, { value: 1, pool: true })).toBe(true);
    expect(rowShowsUnderTarget(poolRow, { value: 2, pool: true })).toBe(true);
  });
});

describe('rowHitChance', () => {
  it('measures a pool column as a minimum success count', () => {
    expect(rowHitChance(poolRow, poolColumn, 'gte')).toBeCloseTo(0.25, 12);
    expect(rowHitChance(poolRow, { value: 1, pool: true }, 'gte')).toBeCloseTo(
      0.75,
      12,
    );
  });

  it('ignores the shared ruling on a pool column', () => {
    // Under the numeric ruling ('lte') every success count would hit.
    expect(rowHitChance(poolRow, poolColumn, 'lte')).toBeCloseTo(0.25, 12);
  });

  it('measures a sum row against the column value under the shared ruling', () => {
    expect(rowHitChance(sumRow, numericColumn, 'gte')).toBeCloseTo(6 / 36, 12);
  });

  it('follows the ruling for a sum row', () => {
    expect(rowHitChance(sumRow, { value: 3, pool: false }, 'lte')).toBeCloseTo(
      3 / 36,
      12,
    );
  });
});

// The three pieces as TargetHitView chains them, which is where the regression
// lived: a table whose only rolls are pools used to produce no columns at all.
describe('a table with no numeric target set', () => {
  const noValues: TargetState = { values: [], ruling: 'gte' };

  it('measures a pool row against every pool target it is given', () => {
    const columns = targetColumns(noValues, [1, 2], true, false);
    expect(columns).toHaveLength(2);
    expect(rowShowsUnderTarget(poolRow, columns[0]!)).toBe(true);
    expect(rowHitChance(poolRow, columns[0]!, noValues.ruling)).toBeCloseTo(
      0.75,
      12,
    );
    expect(rowHitChance(poolRow, columns[1]!, noValues.ruling)).toBeCloseTo(
      0.25,
      12,
    );
  });

  it('leaves a sum row unmeasured until a numeric target joins the pool row', () => {
    const poolOnly = targetColumns(noValues, [2], true, true);
    expect(poolOnly).toHaveLength(1);
    expect(rowShowsUnderTarget(sumRow, poolOnly[0]!)).toBe(false);

    const mixed = targetColumns({ values: [10], ruling: 'gte' }, [2], true, true);
    expect(mixed).toHaveLength(2);
    expect(rowShowsUnderTarget(sumRow, mixed[0]!)).toBe(true);
    expect(rowHitChance(sumRow, mixed[0]!, 'gte')).toBeCloseTo(6 / 36, 12);
  });
});

describe('toTargetRows', () => {
  function oneDie(id: string, sides: number): Expression {
    return {
      id,
      name: id,
      parts: [{ id: `${id}-part`, count: 1, sides }],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'sum',
    };
  }

  // No parts means no distribution, so this row is dropped before it is drawn.
  const blank: Expression = {
    id: 'blank',
    name: 'blank',
    parts: [],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };

  it('keys a row to its unfiltered position so a dropped row cannot shift the rest', () => {
    const rows = toTargetRows([oneDie('a', 6), blank, oneDie('c', 8)]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'c']);
    // 'c' sits at array position 1 but is the third row in the table, and its
    // colour and its dash both come off the slot. Reading the array position
    // here is the bug: it would hand 'c' the pen the blank row would have had.
    expect(rows.map((r) => r.slot)).toEqual([0, 2]);
  });

  it('gives every kept row a slot matching its index in the input', () => {
    const rows = toTargetRows([oneDie('a', 6), oneDie('b', 8), oneDie('c', 10)]);
    expect(rows.map((r) => r.slot)).toEqual([0, 1, 2]);
  });
});
