import { describe, expect, it } from 'vitest';
import { expressionDistribution } from '../engine/expression';
import { mean } from '../engine/stats';
import { MAX_EXPRESSIONS, type Expression, type ModStep } from '../types';
import {
  SWEEP_BOUNDS,
  planSweep,
  rangeValues,
  sweepBounds,
  sweepSourceValue,
  sweepTargets,
  sweepValueLabel,
  type SweepPlan,
  type SweepTarget,
} from './sweep';

function twoD6(name = '2d6', mods?: ModStep[]): Expression {
  const expr: Expression = {
    id: 'roll-1',
    name,
    parts: [{ id: 'p', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
  if (mods) expr.mods = mods;
  return expr;
}

function poolRow(mods?: ModStep[]): Expression {
  const expr: Expression = {
    id: 'pool-1',
    name: 'Pool',
    parts: [{ id: 'pd', count: 5, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 5 },
  };
  if (mods) expr.mods = mods;
  return expr;
}

function checkRow(): Expression {
  return {
    id: 'check-1',
    name: 'Longsword',
    parts: [{ id: 'check-die', count: 1, sides: 20 }],
    flatModifier: 7,
    rollMode: 'normal',
    mode: 'check',
    check: {
      threshold: { direction: 'gte', value: 15 },
      effect: { parts: [{ id: 'effect-die', count: 1, sides: 8 }], flatModifier: 4 },
      onSuccess: 'full',
      onFailure: 'none',
    },
  };
}

const ROOMY = MAX_EXPRESSIONS;
const step = (n: number): SweepTarget => ({ kind: 'modifier', step: n });

function names(plan: SweepPlan): string[] {
  return plan.variants.map((v) => v.expr.name);
}

function means(plan: SweepPlan): number[] {
  return plan.variants.map((v) => mean(expressionDistribution(v.expr)));
}

function skippedFor(plan: SweepPlan, reason: string): number[] {
  return plan.skipped.filter((s) => s.reason === reason).map((s) => s.value);
}

function modifierTargets(expr: Expression): SweepTarget[] {
  return sweepTargets(expr).filter((t) => t.kind === 'modifier');
}

describe('sweepTargets with a modifier chain', () => {
  it('offers step 0 as the modifier on a row with no chain', () => {
    expect(modifierTargets(twoD6())).toEqual([step(0)]);
  });

  it('offers one modifier target per step of a three-step chain', () => {
    const expr = twoD6('2d6', [
      { op: 'add', value: 3 },
      { op: 'mul', value: 2 },
      { op: 'div', value: 3 },
    ]);
    expect(modifierTargets(expr)).toEqual([step(0), step(1), step(2)]);
  });

  it('lists the chain steps before the threshold on a pool row', () => {
    const expr = poolRow([
      { op: 'add', value: 1 },
      { op: 'mul', value: 2 },
    ]);
    expect(sweepTargets(expr)).toEqual([
      { kind: 'count', partId: 'pd' },
      { kind: 'sides', partId: 'pd' },
      step(0),
      step(1),
      { kind: 'poolThreshold' },
    ]);
  });

  it('offers no modifier target on a check row, even with a modifier set', () => {
    expect(sweepTargets(checkRow())).toEqual([]);
  });
});

describe('sweepSourceValue on a chain step', () => {
  it('reads a row with no chain as a modifier of 0', () => {
    expect(sweepSourceValue(twoD6(), step(0))).toBe(0);
  });

  it('reads an add step as a positive amount', () => {
    expect(sweepSourceValue(twoD6('2d6', [{ op: 'add', value: 3 }]), step(0))).toBe(3);
  });

  it('reads a subtract step as a negative amount', () => {
    expect(sweepSourceValue(twoD6('2d6', [{ op: 'sub', value: 2 }]), step(0))).toBe(-2);
  });

  it('reads a multiply step as its multiplier', () => {
    const expr = twoD6('2d6', [
      { op: 'add', value: 3 },
      { op: 'mul', value: 2 },
    ]);
    expect(sweepSourceValue(expr, step(1))).toBe(2);
  });

  it('reads a divide step as its divisor', () => {
    expect(sweepSourceValue(twoD6('2d6', [{ op: 'div', value: 3 }]), step(0))).toBe(3);
  });

  it('returns null for a step past the end of the chain', () => {
    expect(sweepSourceValue(twoD6('2d6', [{ op: 'add', value: 3 }]), step(1))).toBeNull();
  });

  it('returns null for step 1 on a row with no chain', () => {
    expect(sweepSourceValue(twoD6(), step(1))).toBeNull();
  });
});

describe('sweepBounds on a chain step', () => {
  it('holds a multiply step to 1 through 100', () => {
    const expr = twoD6('2d6', [{ op: 'mul', value: 2 }]);
    expect(sweepBounds(expr, step(0))).toEqual({ min: 1, max: 100 });
  });

  it('holds a divide step to 1 through 100', () => {
    const expr = twoD6('2d6', [
      { op: 'add', value: 1 },
      { op: 'div', value: 2 },
    ]);
    expect(sweepBounds(expr, step(1))).toEqual({ min: 1, max: 100 });
  });

  it('gives an add step the modifier range of -999 through 999', () => {
    const expr = twoD6('2d6', [
      { op: 'add', value: 3 },
      { op: 'mul', value: 2 },
    ]);
    expect(sweepBounds(expr, step(0))).toEqual({ min: -999, max: 999 });
  });

  it('gives a subtract step the modifier range', () => {
    expect(sweepBounds(twoD6('2d6', [{ op: 'sub', value: 2 }]), step(0))).toEqual(
      SWEEP_BOUNDS.modifier,
    );
  });

  it('gives a row with no chain the modifier range', () => {
    expect(sweepBounds(twoD6(), step(0))).toEqual({ min: -999, max: 999 });
  });
});

describe('planSweep — a row with no chain', () => {
  it('turns -2 to 2 on 2d6 into four rows named "2d6 · −2" to "2d6 · +2"', () => {
    const plan = planSweep(twoD6(), step(0), rangeValues(-2, 2, 1), ROOMY);
    expect(names(plan)).toEqual(['2d6 · −2', '2d6 · −1', '2d6 · +1', '2d6 · +2']);
  });

  it('skips 0 as the value the source already has', () => {
    const plan = planSweep(twoD6(), step(0), rangeValues(-2, 2, 1), ROOMY);
    expect(plan.skipped).toEqual([{ value: 0, reason: 'source' }]);
  });

  it('gives 2d6 · +3 a mean of exactly 10', () => {
    // 2d6 averages 7; adding 3 to every total moves the mean to 10.
    const plan = planSweep(twoD6(), step(0), [3], ROOMY);
    expect(names(plan)).toEqual(['2d6 · +3']);
    expect(means(plan)[0]).toBeCloseTo(10, 12);
  });

  it('stores the swept modifier as a one-step chain, not on flatModifier', () => {
    const plan = planSweep(twoD6(), step(0), [3, -2], ROOMY);
    expect(plan.variants.map((v) => v.expr.mods)).toEqual([
      [{ op: 'add', value: 3 }],
      [{ op: 'sub', value: 2 }],
    ]);
    expect(plan.variants.map((v) => v.expr.flatModifier)).toEqual([0, 0]);
  });

  it('offers nothing for a step the row does not have', () => {
    const plan = planSweep(twoD6(), step(1), [1, 2], ROOMY);
    expect(plan.variants).toEqual([]);
    expect(skippedFor(plan, 'invalid')).toEqual([1, 2]);
  });
});

describe('planSweep — a lone add or subtract', () => {
  it('sweeping a lone +3 to 0 leaves the variant with no chain at all', () => {
    const plan = planSweep(twoD6('Hit', [{ op: 'add', value: 3 }]), step(0), [0], ROOMY);
    const variant = plan.variants[0];
    expect(variant).toBeDefined();
    expect(variant !== undefined && 'mods' in variant.expr).toBe(false);
    expect(variant?.expr.flatModifier).toBe(0);
  });

  it('names the +0 variant "· +0" and gives it the plain 2d6 mean of 7', () => {
    const plan = planSweep(twoD6('Hit', [{ op: 'add', value: 3 }]), step(0), [0], ROOMY);
    expect(names(plan)).toEqual(['Hit · +0']);
    expect(means(plan)[0]).toBeCloseTo(7, 12);
  });

  it('turns a lone −2 into a +1 step when swept past zero', () => {
    const plan = planSweep(twoD6('Hit', [{ op: 'sub', value: 2 }]), step(0), [1], ROOMY);
    expect(plan.variants[0]?.expr.mods).toEqual([{ op: 'add', value: 1 }]);
    expect(means(plan)[0]).toBeCloseTo(8, 12);
  });
});

describe('planSweep — a multiply step in a chain', () => {
  const doubled = () =>
    twoD6('Smite', [
      { op: 'add', value: 3 },
      { op: 'mul', value: 2 },
    ]);

  it('names the variants ×1, ×3 and ×4 and skips ×2 as the source', () => {
    const plan = planSweep(doubled(), step(1), rangeValues(1, 4, 1), ROOMY);
    expect(names(plan)).toEqual(['Smite · ×1', 'Smite · ×3', 'Smite · ×4']);
    expect(plan.skipped).toEqual([{ value: 2, reason: 'source' }]);
  });

  it('gives each variant the mean (7 + 3) × k', () => {
    const plan = planSweep(doubled(), step(1), rangeValues(1, 4, 1), ROOMY);
    const got = means(plan);
    [10, 30, 40].forEach((expected, i) => {
      expect(got[i]).toBeCloseTo(expected, 12);
    });
  });

  it('changes only the swept step and keeps the +3 in front of it', () => {
    const plan = planSweep(doubled(), step(1), [3], ROOMY);
    expect(plan.variants[0]?.expr.mods).toEqual([
      { op: 'add', value: 3 },
      { op: 'mul', value: 3 },
    ]);
  });

  it('skips 0 and 101 as invalid for a multiplier', () => {
    const plan = planSweep(doubled(), step(1), [0, 101], ROOMY);
    expect(plan.variants).toEqual([]);
    expect(skippedFor(plan, 'invalid')).toEqual([0, 101]);
  });

  it('accepts 100, the largest multiplier', () => {
    // (7 + 3) × 100
    const plan = planSweep(doubled(), step(1), [100], ROOMY);
    expect(names(plan)).toEqual(['Smite · ×100']);
    expect(means(plan)[0]).toBeCloseTo(1000, 12);
  });

  it('skips a negative multiplier as invalid', () => {
    const plan = planSweep(doubled(), step(1), [-2], ROOMY);
    expect(skippedFor(plan, 'invalid')).toEqual([-2]);
  });

  it('sweeps the +3 in front of the multiplier as a signed amount', () => {
    // (7 + 1) × 2 and (7 + 5) × 2
    const plan = planSweep(doubled(), step(0), [1, 5], ROOMY);
    expect(names(plan)).toEqual(['Smite · +1', 'Smite · +5']);
    expect(means(plan)[0]).toBeCloseTo(16, 12);
    expect(means(plan)[1]).toBeCloseTo(24, 12);
  });
});

describe('planSweep — a subtract step in a chain', () => {
  const lessened = () =>
    twoD6('Glance', [
      { op: 'sub', value: 2 },
      { op: 'mul', value: 2 },
    ]);

  it('crosses zero into add steps, keeping the multiply behind it', () => {
    const plan = planSweep(lessened(), step(0), [-1, 1, 2], ROOMY);
    expect(plan.variants.map((v) => v.expr.mods)).toEqual([
      [
        { op: 'sub', value: 1 },
        { op: 'mul', value: 2 },
      ],
      [
        { op: 'add', value: 1 },
        { op: 'mul', value: 2 },
      ],
      [
        { op: 'add', value: 2 },
        { op: 'mul', value: 2 },
      ],
    ]);
  });

  it('names the variants either side of zero with their signs', () => {
    const plan = planSweep(lessened(), step(0), [-1, 1], ROOMY);
    expect(names(plan)).toEqual(['Glance · −1', 'Glance · +1']);
  });

  it('skips −2 as the source', () => {
    const plan = planSweep(lessened(), step(0), [-2, 1], ROOMY);
    expect(plan.skipped).toEqual([{ value: -2, reason: 'source' }]);
  });

  it('moves the mean as the chain says once it crosses zero', () => {
    // (7 + 1) × 2
    const plan = planSweep(lessened(), step(0), [1], ROOMY);
    expect(means(plan)[0]).toBeCloseTo(16, 12);
  });
});

describe('planSweep — a divide step', () => {
  const halved = () => twoD6('Split', [{ op: 'div', value: 2 }]);

  it('sweeps a lone divide by its divisor', () => {
    const plan = planSweep(halved(), step(0), [1, 3], ROOMY);
    expect(names(plan)).toEqual(['Split · ÷1', 'Split · ÷3']);
    expect(plan.variants.map((v) => v.expr.mods)).toEqual([
      [{ op: 'div', value: 1 }],
      [{ op: 'div', value: 3 }],
    ]);
  });

  it('rounds each total down when dividing by 3', () => {
    // floor(S / 3) over 2d6 (ways of 36): 0 for S=2 (1), 1 for 3-5 (9),
    // 2 for 6-8 (16), 3 for 9-11 (9), 4 for 12 (1).
    // (0 + 9 + 32 + 27 + 4) / 36 = 72 / 36 = 2.
    const plan = planSweep(halved(), step(0), [3], ROOMY);
    expect(means(plan)[0]).toBeCloseTo(2, 12);
  });

  it('skips a divisor of 0 as invalid rather than removing the step', () => {
    const plan = planSweep(halved(), step(0), [0], ROOMY);
    expect(plan.variants).toEqual([]);
    expect(skippedFor(plan, 'invalid')).toEqual([0]);
  });
});

describe('planSweep — a pool row chain', () => {
  it('names a multiply step on a pool row without "auto"', () => {
    const source = poolRow([
      { op: 'add', value: 1 },
      { op: 'mul', value: 2 },
    ]);
    const plan = planSweep(source, step(1), [3], ROOMY);
    expect(names(plan)).toEqual(['Pool · ×3']);
  });

  it('names an add step on a pool row as automatic successes', () => {
    const source = poolRow([
      { op: 'add', value: 1 },
      { op: 'mul', value: 2 },
    ]);
    const plan = planSweep(source, step(0), [2], ROOMY);
    expect(names(plan)).toEqual(['Pool · +2 auto']);
  });
});

describe('sweepValueLabel on a chain step', () => {
  it('reads a multiply step as ×N', () => {
    expect(sweepValueLabel(twoD6('2d6', [{ op: 'mul', value: 2 }]), step(0), 3)).toBe('×3');
  });

  it('reads a divide step as ÷N', () => {
    expect(sweepValueLabel(twoD6('2d6', [{ op: 'div', value: 3 }]), step(0), 2)).toBe('÷2');
  });

  it('reads an add step on a sum row as a signed amount', () => {
    expect(sweepValueLabel(twoD6('2d6', [{ op: 'add', value: 1 }]), step(0), 3)).toBe('+3');
  });

  it('reads a negative amount on a pool row with a real minus sign and "auto"', () => {
    expect(sweepValueLabel(poolRow([{ op: 'sub', value: 1 }]), step(0), -2)).toBe('−2 auto');
  });

  it('reads a multiply step on a pool row as ×N, with no "auto"', () => {
    expect(sweepValueLabel(poolRow([{ op: 'mul', value: 2 }]), step(0), 4)).toBe('×4');
  });

  it('reads a row with no chain as a signed amount', () => {
    expect(sweepValueLabel(twoD6(), step(0), -2)).toBe('−2');
  });
});
