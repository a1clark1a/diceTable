import { describe, expect, it } from 'vitest';
import {
  MOD_FACTOR_BOUNDS,
  NEW_MOD_STEP,
  canonicalMods,
  modStepProblem,
  modsAsCheckModifier,
  modsForModifier,
  signedStep,
  signedValue,
  singleModifier,
  withLegacyModifierMoved,
  withOp,
  withStepMoved,
} from './modChain';
import type { Expression, ModOp, ModStep } from '../types';

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
const SUB_ONE: ModStep = { op: 'sub', value: 1 };
const TIMES_TWO: ModStep = { op: 'mul', value: 2 };
const DIVIDE_BY_THREE: ModStep = { op: 'div', value: 3 };

describe('MOD_FACTOR_BOUNDS', () => {
  it('allows multipliers and divisors from 1 to 100', () => {
    expect(MOD_FACTOR_BOUNDS).toEqual({ min: 1, max: 100 });
  });
});

describe('modStepProblem', () => {
  it.each(['add', 'sub', 'mul', 'div'] as const)('refuses NaN on %s', (op) => {
    expect(modStepProblem(op, Number.NaN)).toBe('notANumber');
  });

  it.each(['add', 'sub', 'mul', 'div'] as const)('refuses Infinity on %s', (op) => {
    expect(modStepProblem(op, Number.POSITIVE_INFINITY)).toBe('notANumber');
  });

  it.each(['add', 'sub', 'mul', 'div'] as const)('refuses -Infinity on %s', (op) => {
    expect(modStepProblem(op, Number.NEGATIVE_INFINITY)).toBe('notANumber');
  });

  it.each(['mul', 'div'] as const)('calls a fraction below 1 not whole on %s', (op) => {
    expect(modStepProblem(op, 0.5)).toBe('notWhole');
  });

  it.each(['mul', 'div'] as const)('calls a fraction inside the range not whole on %s', (op) => {
    expect(modStepProblem(op, 2.5)).toBe('notWhole');
  });

  it.each(['mul', 'div'] as const)('refuses 0 as below one on %s', (op) => {
    expect(modStepProblem(op, 0)).toBe('belowOne');
  });

  it.each(['mul', 'div'] as const)('refuses a negative whole number as below one on %s', (op) => {
    expect(modStepProblem(op, -2)).toBe('belowOne');
  });

  it.each(['mul', 'div'] as const)('accepts 1, the bottom of the range, on %s', (op) => {
    expect(modStepProblem(op, 1)).toBeNull();
  });

  it.each(['mul', 'div'] as const)('accepts 100, the top of the range, on %s', (op) => {
    expect(modStepProblem(op, 100)).toBeNull();
  });

  it.each(['mul', 'div'] as const)('refuses 101 as above the ceiling on %s', (op) => {
    expect(modStepProblem(op, 101)).toBe('aboveMax');
  });

  it.each(['add', 'sub'] as const)('accepts a negative amount on %s', (op) => {
    expect(modStepProblem(op, -3)).toBeNull();
  });

  it.each(['add', 'sub'] as const)('accepts a fractional amount on %s', (op) => {
    expect(modStepProblem(op, 2.5)).toBeNull();
  });

  it.each(['add', 'sub'] as const)('accepts 0 on %s', (op) => {
    expect(modStepProblem(op, 0)).toBeNull();
  });

  it.each(['add', 'sub'] as const)('accepts an amount past the multiplier ceiling on %s', (op) => {
    expect(modStepProblem(op, 500)).toBeNull();
  });
});

describe('signedStep', () => {
  it('turns a positive amount into an add step', () => {
    expect(signedStep(3)).toEqual({ op: 'add', value: 3 });
  });

  it('turns a negative amount into a subtract step of its size', () => {
    expect(signedStep(-2)).toEqual({ op: 'sub', value: 2 });
  });

  it('turns 0 into an add step of 0', () => {
    expect(signedStep(0)).toEqual({ op: 'add', value: 0 });
  });
});

describe('signedValue', () => {
  it('reads an add step as its amount', () => {
    expect(signedValue({ op: 'add', value: 3 })).toBe(3);
  });

  it('reads a subtract step as its amount negated', () => {
    expect(signedValue({ op: 'sub', value: 2 })).toBe(-2);
  });

  it('has no signed reading for a multiply step', () => {
    expect(signedValue(TIMES_TWO)).toBeNull();
  });

  it('has no signed reading for a divide step', () => {
    expect(signedValue(DIVIDE_BY_THREE)).toBeNull();
  });
});

describe('canonicalMods', () => {
  it('stores an empty chain as no chain', () => {
    expect(canonicalMods([])).toBeUndefined();
  });

  it('returns the same array when the chain is already canonical', () => {
    const mods = [ADD_THREE, TIMES_TWO, DIVIDE_BY_THREE];
    expect(canonicalMods(mods)).toBe(mods);
  });

  it('turns an add of a negative amount into a subtract', () => {
    expect(canonicalMods([{ op: 'add', value: -3 }])).toEqual([{ op: 'sub', value: 3 }]);
  });

  it('turns a subtract of a negative amount into an add', () => {
    expect(canonicalMods([{ op: 'sub', value: -2 }])).toEqual([{ op: 'add', value: 2 }]);
  });

  it('flips only the steps that carry a sign, leaving the rest in place', () => {
    expect(canonicalMods([TIMES_TWO, { op: 'add', value: -1 }])).toEqual([
      TIMES_TWO,
      { op: 'sub', value: 1 },
    ]);
  });

  it('keeps the first three steps of a longer chain', () => {
    const mods = [ADD_THREE, TIMES_TWO, DIVIDE_BY_THREE, SUB_ONE];
    expect(canonicalMods(mods)).toEqual([ADD_THREE, TIMES_TWO, DIVIDE_BY_THREE]);
  });

  it('keeps a step whose value is 0, which the editor adds before a number is typed', () => {
    const mods = [TIMES_TWO, { op: 'add', value: 0 } satisfies ModStep];
    expect(canonicalMods(mods)).toBe(mods);
  });

  it('leaves the input chain unchanged when it repairs a sign', () => {
    const mods: ModStep[] = [{ op: 'add', value: -3 }];
    canonicalMods(mods);
    expect(mods).toEqual([{ op: 'add', value: -3 }]);
  });
});

describe('withLegacyModifierMoved', () => {
  it('moves a sum row modifier into a one-step chain', () => {
    const moved = withLegacyModifierMoved(sumRow({ flatModifier: 3 }));
    expect(moved.flatModifier).toBe(0);
    expect(moved.mods).toEqual([{ op: 'add', value: 3 }]);
  });

  it('moves a pool row modifier into a one-step chain', () => {
    const moved = withLegacyModifierMoved(poolRow({ flatModifier: 2 }));
    expect(moved.flatModifier).toBe(0);
    expect(moved.mods).toEqual([{ op: 'add', value: 2 }]);
  });

  it('moves a negative modifier as a subtract of its size', () => {
    const moved = withLegacyModifierMoved(sumRow({ flatModifier: -2 }));
    expect(moved.mods).toEqual([{ op: 'sub', value: 2 }]);
  });

  it('puts the modifier in front of an existing chain', () => {
    const moved = withLegacyModifierMoved(sumRow({ flatModifier: 3, mods: [TIMES_TWO] }));
    expect(moved.mods).toEqual([ADD_THREE, TIMES_TWO]);
  });

  it('keeps three steps when the modifier joins a full chain, dropping the last', () => {
    const moved = withLegacyModifierMoved(
      sumRow({ flatModifier: 3, mods: [TIMES_TWO, DIVIDE_BY_THREE, SUB_ONE] }),
    );
    expect(moved.mods).toEqual([ADD_THREE, TIMES_TWO, DIVIDE_BY_THREE]);
  });

  it('returns a check row untouched, since its modifier belongs to the check roll', () => {
    const row = checkRow({ flatModifier: 7 });
    expect(withLegacyModifierMoved(row)).toBe(row);
  });

  it('returns a row with no modifier untouched', () => {
    const row = sumRow({ flatModifier: 0, mods: [TIMES_TWO] });
    expect(withLegacyModifierMoved(row)).toBe(row);
  });

  it('leaves the input row unchanged', () => {
    const row = sumRow({ flatModifier: 3 });
    withLegacyModifierMoved(row);
    expect(row.flatModifier).toBe(3);
    expect('mods' in row).toBe(false);
  });
});

describe('singleModifier', () => {
  it('reads no chain as 0', () => {
    expect(singleModifier(undefined)).toBe(0);
  });

  it('reads an empty chain as 0', () => {
    expect(singleModifier([])).toBe(0);
  });

  it('reads a lone add step as its amount', () => {
    expect(singleModifier([ADD_THREE])).toBe(3);
  });

  it('reads a lone subtract step as its amount negated', () => {
    expect(singleModifier([SUB_ONE])).toBe(-1);
  });

  it('has no single reading for a lone multiply step', () => {
    expect(singleModifier([TIMES_TWO])).toBeNull();
  });

  it('has no single reading for two add steps', () => {
    expect(singleModifier([ADD_THREE, { op: 'add', value: 2 }])).toBeNull();
  });
});

describe('modsForModifier', () => {
  it('stands for no chain at 0', () => {
    expect(modsForModifier(0)).toBeUndefined();
  });

  it('stands for one add step at a positive value', () => {
    expect(modsForModifier(4)).toEqual([{ op: 'add', value: 4 }]);
  });

  it('stands for one subtract step at a negative value', () => {
    expect(modsForModifier(-3)).toEqual([{ op: 'sub', value: 3 }]);
  });
});

describe('NEW_MOD_STEP', () => {
  it('starts a new step as doubling the total', () => {
    expect(NEW_MOD_STEP).toEqual({ op: 'mul', value: 2 });
  });
});

describe('withOp', () => {
  it('returns the same step when the operation does not change', () => {
    expect(withOp(ADD_THREE, 'add')).toBe(ADD_THREE);
  });

  it('keeps a whole amount inside the range when switching to multiply', () => {
    expect(withOp(ADD_THREE, 'mul')).toEqual({ op: 'mul', value: 3 });
  });

  it('starts a multiply at 2 when the amount was 0', () => {
    expect(withOp({ op: 'add', value: 0 }, 'mul')).toEqual({ op: 'mul', value: 2 });
  });

  it('starts a divide at 2 when the amount was a fraction below 1', () => {
    expect(withOp({ op: 'add', value: 0.5 }, 'div')).toEqual({ op: 'div', value: 2 });
  });

  it('starts a multiply at 2 when the amount was a fraction above 1', () => {
    expect(withOp({ op: 'sub', value: 2.5 }, 'mul')).toEqual({ op: 'mul', value: 2 });
  });

  it('clamps a multiply to 100 when the amount was above the ceiling', () => {
    expect(withOp({ op: 'add', value: 500 }, 'mul')).toEqual({ op: 'mul', value: 100 });
  });

  it('keeps 100 when switching to divide, since it is the ceiling itself', () => {
    expect(withOp({ op: 'add', value: 100 }, 'div')).toEqual({ op: 'div', value: 100 });
  });

  it('clamps a divide to 100 when the amount was 101', () => {
    expect(withOp({ op: 'add', value: 101 }, 'div')).toEqual({ op: 'div', value: 100 });
  });

  it('keeps 1 when switching to divide, since it is the floor itself', () => {
    expect(withOp({ op: 'add', value: 1 }, 'div')).toEqual({ op: 'div', value: 1 });
  });

  it('carries a multiplier over unchanged when switching to add', () => {
    expect(withOp({ op: 'mul', value: 5 }, 'add')).toEqual({ op: 'add', value: 5 });
  });

  it('carries a divisor over unchanged when switching to subtract', () => {
    expect(withOp(DIVIDE_BY_THREE, 'sub')).toEqual({ op: 'sub', value: 3 });
  });

  it('carries a multiplier over unchanged when switching to divide', () => {
    expect(withOp(TIMES_TWO, 'div')).toEqual({ op: 'div', value: 2 });
  });

  it.each([-4, 0, 0.5, 1, 2.5, 100, 101, 500])(
    'never leaves a multiply or divide the validator refuses, from an add of %s',
    (value) => {
      const scales: ModOp[] = ['mul', 'div'];
      for (const op of scales) {
        const step = withOp({ op: 'add', value }, op);
        expect(modStepProblem(step.op, step.value)).toBeNull();
      }
    },
  );
});

describe('withStepMoved', () => {
  const chain: readonly ModStep[] = [ADD_THREE, TIMES_TWO, DIVIDE_BY_THREE];

  it('moves the first step one place later', () => {
    expect(withStepMoved(chain, 0, 1)).toEqual([TIMES_TWO, ADD_THREE, DIVIDE_BY_THREE]);
  });

  it('moves the last step one place earlier', () => {
    expect(withStepMoved(chain, 2, -1)).toEqual([ADD_THREE, DIVIDE_BY_THREE, TIMES_TWO]);
  });

  it('leaves the chain in order when the first step moves earlier', () => {
    expect(withStepMoved(chain, 0, -1)).toEqual([ADD_THREE, TIMES_TWO, DIVIDE_BY_THREE]);
  });

  it('leaves the chain in order when the last step moves later', () => {
    expect(withStepMoved(chain, 2, 1)).toEqual([ADD_THREE, TIMES_TWO, DIVIDE_BY_THREE]);
  });

  it('leaves the chain in order for a step that does not exist', () => {
    expect(withStepMoved(chain, 5, -1)).toEqual([ADD_THREE, TIMES_TWO, DIVIDE_BY_THREE]);
  });

  it('leaves the input chain unchanged', () => {
    const mods = [ADD_THREE, TIMES_TWO];
    withStepMoved(mods, 0, 1);
    expect(mods).toEqual([ADD_THREE, TIMES_TWO]);
  });
});

describe('modsAsCheckModifier', () => {
  it('reads no chain as 0', () => {
    expect(modsAsCheckModifier(undefined)).toBe(0);
  });

  it('reads an empty chain as 0', () => {
    expect(modsAsCheckModifier([])).toBe(0);
  });

  it('carries a chain of adds and subtracts over as its net', () => {
    // +3 then -1 nets +2.
    expect(modsAsCheckModifier([ADD_THREE, SUB_ONE])).toBe(2);
  });

  it('carries a lone subtract over as a negative modifier', () => {
    expect(modsAsCheckModifier([{ op: 'sub', value: 4 }])).toBe(-4);
  });

  it('starts from 0 when the chain multiplies', () => {
    expect(modsAsCheckModifier([ADD_THREE, TIMES_TWO])).toBe(0);
  });

  it('starts from 0 when the chain divides', () => {
    expect(modsAsCheckModifier([DIVIDE_BY_THREE])).toBe(0);
  });
});
