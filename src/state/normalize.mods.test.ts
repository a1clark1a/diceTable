import { describe, expect, it } from 'vitest';
import { normalizeExpression } from './normalize';
import { validateExpression } from './persistedSchema';
import { expressionDistribution } from '../engine/expression';
import { mean } from '../engine/stats';
import type { Expression, ModStep } from '../types';

function sumRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e0',
    name: 'Sum row',
    parts: [{ id: 'p0', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function poolRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e1',
    name: 'Pool row',
    parts: [{ id: 'p1', count: 3, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 5 },
    ...overrides,
  };
}

function checkRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e2',
    name: 'Check row',
    parts: [{ id: 'p2', count: 1, sides: 20 }],
    flatModifier: 7,
    rollMode: 'normal',
    mode: 'check',
    check: {
      threshold: { direction: 'gte', value: 15 },
      effect: { parts: [{ id: 'fx', count: 1, sides: 8 }], flatModifier: 4 },
      onSuccess: 'full',
      onFailure: 'none',
    },
    ...overrides,
  };
}

const ADD_THREE: ModStep = { op: 'add', value: 3 };
const TIMES_TWO: ModStep = { op: 'mul', value: 2 };
const DIVIDE_BY_THREE: ModStep = { op: 'div', value: 3 };

describe('normalizeExpression on a check row', () => {
  it('strips a chain left on a check row', () => {
    const row = normalizeExpression(checkRow({ mods: [TIMES_TWO] }));
    expect('mods' in row).toBe(false);
  });

  it('keeps the check roll modifier when it strips the chain', () => {
    expect(normalizeExpression(checkRow({ mods: [TIMES_TWO] })).flatModifier).toBe(7);
  });

  it('returns a check row with no chain untouched', () => {
    const row = checkRow();
    expect(normalizeExpression(row)).toBe(row);
  });
});

describe('normalizeExpression moving a legacy modifier', () => {
  it('moves a sum row modifier into a one-step chain', () => {
    const row = normalizeExpression(sumRow({ flatModifier: 3 }));
    expect(row.mods).toEqual([ADD_THREE]);
    expect(row.flatModifier).toBe(0);
  });

  it('moves a pool row modifier into a one-step chain', () => {
    const row = normalizeExpression(poolRow({ flatModifier: 1 }));
    expect(row.mods).toEqual([{ op: 'add', value: 1 }]);
    expect(row.flatModifier).toBe(0);
  });

  it('puts a negative modifier in front of an existing chain as a subtract', () => {
    const row = normalizeExpression(sumRow({ flatModifier: -2, mods: [TIMES_TWO] }));
    expect(row.mods).toEqual([{ op: 'sub', value: 2 }, TIMES_TWO]);
  });

  it('hands the validator a row it accepts where both a modifier and a chain were set', () => {
    const row = normalizeExpression(sumRow({ flatModifier: 3, mods: [TIMES_TWO] }));
    expect(validateExpression(row)).toEqual(row);
  });

  it('keeps the moved modifier adding to every total', () => {
    const row = normalizeExpression(sumRow({ flatModifier: 3 }));
    // 2d6 averages 7, so 2d6 + 3 averages 10.
    expect(mean(expressionDistribution(row))).toBeCloseTo(10, 12);
  });

  it('leaves the input row unchanged', () => {
    const input = sumRow({ flatModifier: 3 });
    normalizeExpression(input);
    expect(input.flatModifier).toBe(3);
    expect('mods' in input).toBe(false);
  });
});

describe('normalizeExpression repairing a chain', () => {
  it('turns an add of a negative amount into a subtract', () => {
    const row = normalizeExpression(sumRow({ mods: [{ op: 'add', value: -3 }, TIMES_TWO] }));
    expect(row.mods).toEqual([{ op: 'sub', value: 3 }, TIMES_TWO]);
  });

  it('turns a subtract of a negative amount on a pool row into an add', () => {
    const row = normalizeExpression(poolRow({ mods: [{ op: 'sub', value: -2 }] }));
    expect(row.mods).toEqual([{ op: 'add', value: 2 }]);
  });

  it('removes an empty chain', () => {
    expect('mods' in normalizeExpression(sumRow({ mods: [] }))).toBe(false);
  });

  it('keeps the first three steps of a longer chain', () => {
    const row = normalizeExpression(
      sumRow({ mods: [ADD_THREE, TIMES_TWO, DIVIDE_BY_THREE, { op: 'sub', value: 1 }] }),
    );
    expect(row.mods).toEqual([ADD_THREE, TIMES_TWO, DIVIDE_BY_THREE]);
  });
});

describe('normalizeExpression on an already canonical row', () => {
  it('returns a sum row with a canonical chain untouched', () => {
    const row = sumRow({ mods: [ADD_THREE, TIMES_TWO, DIVIDE_BY_THREE] });
    expect(normalizeExpression(row)).toBe(row);
  });

  it('returns a pool row with a canonical chain untouched', () => {
    const row = poolRow({ mods: [{ op: 'sub', value: 1 }] });
    expect(normalizeExpression(row)).toBe(row);
  });

  it('returns a sum row with no chain untouched', () => {
    const row = sumRow();
    expect(normalizeExpression(row)).toBe(row);
  });

  it('returns a chain holding a step of 0 untouched, since the editor adds one before a number is typed', () => {
    const row = sumRow({ mods: [TIMES_TWO, { op: 'add', value: 0 }] });
    expect(normalizeExpression(row)).toBe(row);
  });
});
