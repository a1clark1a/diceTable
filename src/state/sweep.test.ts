import { describe, expect, it } from 'vitest';
import { expressionDistribution } from '../engine/expression';
import { mean } from '../engine/stats';
import { MAX_EXPRESSIONS, type DicePart, type Expression } from '../types';
import { applyPartPatch, sidesPatch } from './defaultPart';
import {
  MAX_SWEEP_VARIANTS,
  largestSides,
  planSweep,
  rangeValues,
  sameSweepTarget,
  sweepSourceValue,
  sweepTargets,
  sweepValueLabel,
  type SweepPlan,
  type SweepTarget,
} from './sweep';

function sumRow(name: string, parts: DicePart[], overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'roll-1',
    name,
    parts,
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function poolRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'pool-1',
    name: 'Pool',
    parts: [{ id: 'pd', count: 5, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 5 },
    ...overrides,
  };
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
const MOD: SweepTarget = { kind: 'modifier', step: 0 };

function names(plan: SweepPlan): string[] {
  return plan.variants.map((v) => v.expr.name);
}

function skippedFor(plan: SweepPlan, reason: string): number[] {
  return plan.skipped.filter((s) => s.reason === reason).map((s) => s.value);
}

function onlyPart(expr: Expression): DicePart {
  const part = expr.parts[0];
  if (part === undefined) throw new Error('row has no parts');
  return part;
}

describe('planSweep — modifier', () => {
  const twoD6 = () => sumRow('2d6', [{ id: 'p', count: 2, sides: 6 }]);

  it('turns +0 to +5 on 2d6 into five rows named "2d6 · +1" to "2d6 · +5"', () => {
    const plan = planSweep(twoD6(), MOD, rangeValues(0, 5, 1), ROOMY);
    expect(names(plan)).toEqual(['2d6 · +1', '2d6 · +2', '2d6 · +3', '2d6 · +4', '2d6 · +5']);
  });

  it('gives the five variants means 8 through 12', () => {
    const plan = planSweep(twoD6(), MOD, rangeValues(0, 5, 1), ROOMY);
    const means = plan.variants.map((v) => mean(expressionDistribution(v.expr)));
    [8, 9, 10, 11, 12].forEach((expected, i) => {
      expect(means[i]).toBeCloseTo(expected, 12);
    });
  });

  it('skips the value the source already has, so the family never repeats it', () => {
    const plan = planSweep(twoD6(), MOD, rangeValues(0, 5, 1), ROOMY);
    expect(plan.variants.map((v) => v.value)).not.toContain(0);
    expect(plan.skipped).toEqual([{ value: 0, reason: 'source' }]);
  });

  it('names a negative modifier with a real minus sign', () => {
    const plan = planSweep(twoD6(), MOD, [-1], ROOMY);
    expect(names(plan)).toEqual(['2d6 · −1']);
  });

  it('keeps the order the values were given in', () => {
    const plan = planSweep(twoD6(), MOD, rangeValues(3, 1, 1), ROOMY);
    expect(plan.variants.map((v) => v.value)).toEqual([3, 2, 1]);
  });

  it('ignores a value listed twice', () => {
    const plan = planSweep(twoD6(), MOD, [2, 2, 3], ROOMY);
    expect(plan.variants.map((v) => v.value)).toEqual([2, 3]);
  });

  it('copies the source note onto every variant', () => {
    const source = sumRow('2d6', [{ id: 'p', count: 2, sides: 6 }], { note: 'baseline' });
    const plan = planSweep(source, MOD, [1, 2], ROOMY);
    expect(plan.variants.map((v) => v.expr.note)).toEqual(['baseline', 'baseline']);
  });
});

describe('planSweep — die size', () => {
  it('keeps "reroll 1s once" on every variant of a d6', () => {
    const source = sumRow('Longsword', [
      { id: 'p', count: 1, sides: 6, reroll: { values: [1], mode: 'once' } },
    ]);
    const plan = planSweep(source, { kind: 'sides', partId: 'p' }, [4, 6, 8, 10], ROOMY);
    expect(names(plan)).toEqual(['Longsword · d4', 'Longsword · d8', 'Longsword · d10']);
    for (const v of plan.variants) {
      expect(onlyPart(v.expr).reroll).toEqual({ values: [1], mode: 'once' });
      expect(v.clearedFaces).toBe(false);
    }
  });

  // (1/8) of the time the 1 is rerolled into a fresh d8 (mean 4.5); otherwise
  // the face shown stands: (4.5 + 2 + 3 + ... + 8) / 8 = 39.5 / 8.
  it('computes the reroll on the variant, not just carries it', () => {
    const source = sumRow('Longsword', [
      { id: 'p', count: 1, sides: 6, reroll: { values: [1], mode: 'once' } },
    ]);
    const plan = planSweep(source, { kind: 'sides', partId: 'p' }, [8], ROOMY);
    const d8 = plan.variants[0];
    expect(d8).toBeDefined();
    expect(mean(expressionDistribution(d8!.expr))).toBeCloseTo(39.5 / 8, 12);
  });

  it('leaves the d4 variant of an exploding d6 exactly as the editor leaves a hand resize', () => {
    const part: DicePart = { id: 'p', count: 1, sides: 6, explode: { onFaces: [6], depthCap: 3 } };
    const plan = planSweep(sumRow('Boom', [part]), { kind: 'sides', partId: 'p' }, [4], ROOMY);
    const d4 = plan.variants[0];
    expect(d4).toBeDefined();
    expect(onlyPart(d4!.expr)).toEqual(applyPartPatch(part, sidesPatch(part, 4)));
  });

  it('reports that the d4 variant of an exploding d6 lost its explode face', () => {
    const part: DicePart = { id: 'p', count: 1, sides: 6, explode: { onFaces: [6], depthCap: 3 } };
    const plan = planSweep(sumRow('Boom', [part]), { kind: 'sides', partId: 'p' }, [4], ROOMY);
    expect(plan.variants[0]?.clearedFaces).toBe(true);
  });

  it('keeps the explode face on a bigger die and reports nothing cleared', () => {
    const part: DicePart = { id: 'p', count: 1, sides: 6, explode: { onFaces: [6], depthCap: 3 } };
    const plan = planSweep(sumRow('Boom', [part]), { kind: 'sides', partId: 'p' }, [8], ROOMY);
    expect(onlyPart(plan.variants[0]!.expr).explode).toEqual({ onFaces: [6], depthCap: 3 });
    expect(plan.variants[0]?.clearedFaces).toBe(false);
  });

  it('changes only the swept part on a row with several parts', () => {
    const source = sumRow('Mixed', [
      { id: 'a', count: 2, sides: 6 },
      { id: 'b', count: 1, sides: 4 },
    ]);
    const plan = planSweep(source, { kind: 'sides', partId: 'b' }, [8], ROOMY);
    const parts = plan.variants[0]?.expr.parts;
    expect(parts?.[0]).toEqual({ id: 'a', count: 2, sides: 6 });
    expect(parts?.[1]).toEqual({ id: 'b', count: 1, sides: 8 });
  });

  // d8 rerolling 1-3 always and exploding 4-6 can still stop on 7 or 8; on a d6
  // or d4 every face that survives the reroll explodes again, forever.
  it('skips die sizes where a reroll-always and explode combo never stops', () => {
    const source = sumRow('Chain', [
      {
        id: 'p',
        count: 1,
        sides: 8,
        reroll: { values: [1, 2, 3], mode: 'always' },
        explode: { onFaces: [4, 5, 6], depthCap: 2 },
      },
    ]);
    const plan = planSweep(source, { kind: 'sides', partId: 'p' }, [4, 6, 10], ROOMY);
    expect(skippedFor(plan, 'endless')).toEqual([4, 6]);
    expect(plan.variants.map((v) => v.value)).toEqual([10]);
  });
});

describe('planSweep — keep n', () => {
  const threeD6kh3 = () =>
    sumRow('3d6kh3', [{ id: 'p', count: 3, sides: 6, keep: { type: 'highest', n: 3 } }]);

  it('creates keep 1 and keep 2 from a 1 to 5 sweep on 3d6 kh3', () => {
    const plan = planSweep(threeD6kh3(), { kind: 'keepN', partId: 'p' }, rangeValues(1, 5, 1), ROOMY);
    expect(names(plan)).toEqual(['3d6kh3 · kh1', '3d6kh3 · kh2']);
    expect(plan.variants.map((v) => onlyPart(v.expr).keep)).toEqual([
      { type: 'highest', n: 1 },
      { type: 'highest', n: 2 },
    ]);
  });

  it('says 3 is the source and 4 and 5 keep more dice than are rolled', () => {
    const plan = planSweep(threeD6kh3(), { kind: 'keepN', partId: 'p' }, rangeValues(1, 5, 1), ROOMY);
    expect(plan.skipped).toEqual([
      { value: 3, reason: 'source' },
      { value: 4, reason: 'keepOverCount' },
      { value: 5, reason: 'keepOverCount' },
    ]);
  });

  it('labels a keep-lowest sweep with kl', () => {
    const source = sumRow('Low', [{ id: 'p', count: 3, sides: 6, keep: { type: 'lowest', n: 1 } }]);
    const plan = planSweep(source, { kind: 'keepN', partId: 'p' }, [2], ROOMY);
    expect(names(plan)).toEqual(['Low · kl2']);
  });

  it('offers nothing on a part with no keep rule', () => {
    const source = sumRow('Plain', [{ id: 'p', count: 3, sides: 6 }]);
    const plan = planSweep(source, { kind: 'keepN', partId: 'p' }, [1, 2], ROOMY);
    expect(plan.variants).toEqual([]);
    expect(plan.skipped.map((s) => s.value)).toEqual([1, 2]);
  });
});

describe('planSweep — die count', () => {
  it('names each variant by its dice', () => {
    const source = sumRow('Fire', [{ id: 'p', count: 2, sides: 6 }]);
    const plan = planSweep(source, { kind: 'count', partId: 'p' }, rangeValues(1, 4, 1), ROOMY);
    expect(names(plan)).toEqual(['Fire · 1d6', 'Fire · 3d6', 'Fire · 4d6']);
  });

  it('skips a count below the part keep n', () => {
    const source = sumRow('Keep', [{ id: 'p', count: 3, sides: 6, keep: { type: 'highest', n: 3 } }]);
    const plan = planSweep(source, { kind: 'count', partId: 'p' }, [2, 4], ROOMY);
    expect(skippedFor(plan, 'keepOverCount')).toEqual([2]);
    expect(plan.variants.map((v) => v.value)).toEqual([4]);
  });

  it('skips a count that leaves fewer dice than the keep-across rule keeps', () => {
    const source = sumRow(
      'Across',
      [
        { id: 'a', count: 2, sides: 6 },
        { id: 'b', count: 1, sides: 8 },
      ],
      { keepAcross: { type: 'highest', n: 3 } },
    );
    const plan = planSweep(source, { kind: 'count', partId: 'a' }, [1, 3], ROOMY);
    expect(skippedFor(plan, 'keepOverCount')).toEqual([1]);
    expect(plan.variants.map((v) => v.value)).toEqual([3]);
  });

  it('skips values the complexity guard would refuse to compute', () => {
    const source = sumRow('Big', [{ id: 'p', count: 1, sides: 100 }]);
    const plan = planSweep(source, { kind: 'count', partId: 'p' }, [2, 100], ROOMY);
    expect(skippedFor(plan, 'tooComplex')).toEqual([100]);
    expect(plan.variants.map((v) => v.value)).toEqual([2]);
  });
});

describe('planSweep — pool threshold and pool modifier', () => {
  it('skips a threshold past the largest die as off the die', () => {
    const plan = planSweep(poolRow(), { kind: 'poolThreshold' }, [4, 6, 7], ROOMY);
    expect(skippedFor(plan, 'thresholdOffDie')).toEqual([7]);
    expect(plan.variants.map((v) => v.value)).toEqual([4, 6]);
  });

  it('names threshold variants with the row direction', () => {
    expect(names(planSweep(poolRow(), { kind: 'poolThreshold' }, [4], ROOMY))).toEqual([
      'Pool · ≥4',
    ]);
    const lte = poolRow({ successThreshold: { direction: 'lte', value: 2 } });
    expect(names(planSweep(lte, { kind: 'poolThreshold' }, [3], ROOMY))).toEqual(['Pool · ≤3']);
  });

  it('names a pool modifier as automatic successes', () => {
    const plan = planSweep(poolRow(), MOD, [2], ROOMY);
    expect(names(plan)).toEqual(['Pool · +2 auto']);
  });

  // "At or below" past the largest face is every die succeeding, which is what
  // the row says it does, so nothing about it is out of reach.
  it('keeps an at-or-below threshold past the largest die', () => {
    const lte = poolRow({ successThreshold: { direction: 'lte', value: 3 } });
    const plan = planSweep(lte, { kind: 'poolThreshold' }, [7, 8], ROOMY);
    expect(plan.skipped).toEqual([]);
    expect(plan.variants.map((v) => v.value)).toEqual([7, 8]);
  });

  it('keeps a smaller die under an at-or-below threshold', () => {
    const lte = poolRow({
      parts: [{ id: 'pd', count: 4, sides: 10 }],
      successThreshold: { direction: 'lte', value: 8 },
    });
    const plan = planSweep(lte, { kind: 'sides', partId: 'pd' }, [4, 6], ROOMY);
    expect(plan.skipped).toEqual([]);
    expect(plan.variants.map((v) => v.value)).toEqual([4, 6]);
  });
});

describe('planSweep — a die that never lands', () => {
  // Rerolling 1 to 4 always is fine on a d8, but on a d4 it is every face, and
  // a row that rerolls every face draws nothing.
  it('skips a die size whose every face would be rerolled always', () => {
    const source = sumRow('Reroll', [
      { id: 'p', count: 1, sides: 8, reroll: { values: [1, 2, 3, 4], mode: 'always' } },
    ]);
    const plan = planSweep(source, { kind: 'sides', partId: 'p' }, [4, 6], ROOMY);
    expect(skippedFor(plan, 'allRerolled')).toEqual([4]);
    expect(plan.variants.map((v) => v.value)).toEqual([6]);
  });

  it('keeps the same die when the reroll is once, which still lands', () => {
    const source = sumRow('Reroll', [
      { id: 'p', count: 1, sides: 8, reroll: { values: [1, 2, 3, 4], mode: 'once' } },
    ]);
    const plan = planSweep(source, { kind: 'sides', partId: 'p' }, [4], ROOMY);
    expect(plan.variants.map((v) => v.value)).toEqual([4]);
  });
});

describe('planSweep — limits', () => {
  const twoD6 = () => sumRow('2d6', [{ id: 'p', count: 2, sides: 6 }]);

  it('creates only the 3 that fit when the table has 97 rows', () => {
    const plan = planSweep(twoD6(), MOD, rangeValues(1, 5, 1), MAX_EXPRESSIONS - 97);
    expect(plan.variants.map((v) => v.value)).toEqual([1, 2, 3]);
    expect(skippedFor(plan, 'noRoom')).toEqual([4, 5]);
  });

  it('creates nothing when the table is full', () => {
    const plan = planSweep(twoD6(), MOD, [1, 2], 0);
    expect(plan.variants).toEqual([]);
    expect(skippedFor(plan, 'noRoom')).toEqual([1, 2]);
  });

  // The source takes one palette slot, so seven variants keep all eight of the
  // family on their own colour and dash.
  it('stops at seven variants, so the family never repeats a palette slot', () => {
    const plan = planSweep(twoD6(), MOD, rangeValues(1, 10, 1), ROOMY);
    expect(MAX_SWEEP_VARIANTS).toBe(7);
    expect(plan.variants).toHaveLength(MAX_SWEEP_VARIANTS);
    expect(plan.variants.map((v) => v.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(skippedFor(plan, 'overLimit')).toEqual([8, 9, 10]);
  });

  it('does not spend room on values it skipped for another reason', () => {
    const source = sumRow('Keep', [{ id: 'p', count: 3, sides: 6, keep: { type: 'highest', n: 3 } }]);
    const plan = planSweep(source, { kind: 'keepN', partId: 'p' }, [3, 4, 1, 2], 1);
    expect(plan.variants.map((v) => v.value)).toEqual([1]);
    expect(skippedFor(plan, 'noRoom')).toEqual([2]);
  });

  it('skips values the editor would never allow as invalid', () => {
    const count = planSweep(twoD6(), { kind: 'count', partId: 'p' }, [0, 1.5], ROOMY);
    expect(skippedFor(count, 'invalid')).toEqual([0, 1.5]);
    const sides = planSweep(twoD6(), { kind: 'sides', partId: 'p' }, [1], ROOMY);
    expect(skippedFor(sides, 'invalid')).toEqual([1]);
    const mod = planSweep(twoD6(), MOD, [1000, Number.NaN], ROOMY);
    expect(skippedFor(mod, 'invalid')).toEqual([1000, Number.NaN]);
  });

  it('offers nothing for a part id the row does not have', () => {
    const plan = planSweep(twoD6(), { kind: 'count', partId: 'missing' }, [1, 3], ROOMY);
    expect(plan.variants).toEqual([]);
  });
});

describe('planSweep — check rows', () => {
  it('gives a check row no sweep targets', () => {
    expect(sweepTargets(checkRow())).toEqual([]);
  });

  it('creates no variants from a check row, and lists every value as skipped', () => {
    const plan = planSweep(checkRow(), MOD, [1, 2, 3], ROOMY);
    expect(plan.variants).toEqual([]);
    expect(plan.skipped.map((s) => s.value)).toEqual([1, 2, 3]);
  });
});

describe('planSweep — leaves the source alone', () => {
  // The row cache is keyed by object identity, so an in-place edit would serve
  // the source's stale stats.
  it('never mutates the source row, whatever it sweeps', () => {
    const source = sumRow(
      'Everything',
      [
        {
          id: 'p',
          count: 3,
          sides: 6,
          keep: { type: 'highest', n: 2 },
          reroll: { values: [1], mode: 'once' },
          explode: { onFaces: [6], depthCap: 2 },
        },
      ],
      { mods: [{ op: 'add', value: 2 }], note: 'keep me' },
    );
    const snapshot = structuredClone(source);
    const targets: SweepTarget[] = [
      { kind: 'count', partId: 'p' },
      { kind: 'sides', partId: 'p' },
      { kind: 'keepN', partId: 'p' },
      MOD,
    ];
    for (const target of targets) planSweep(source, target, [1, 2, 4, 8], ROOMY);
    expect(source).toEqual(snapshot);
  });

  it('returns variants that are new objects, never the source', () => {
    const source = sumRow('2d6', [{ id: 'p', count: 2, sides: 6 }]);
    const plan = planSweep(source, { kind: 'sides', partId: 'p' }, [4, 8], ROOMY);
    for (const v of plan.variants) {
      expect(v.expr).not.toBe(source);
      expect(v.expr.parts).not.toBe(source.parts);
    }
  });

  it('never mutates a pool source when sweeping its threshold', () => {
    const source = poolRow();
    const snapshot = structuredClone(source);
    planSweep(source, { kind: 'poolThreshold' }, [3, 4, 6], ROOMY);
    expect(source).toEqual(snapshot);
  });
});

describe('rangeValues', () => {
  it('counts up from one end to the other', () => {
    expect(rangeValues(0, 5, 1)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('counts down when the end is below the start', () => {
    expect(rangeValues(5, 0, 1)).toEqual([5, 4, 3, 2, 1, 0]);
  });

  it('steps by the given amount and stops before passing the end', () => {
    expect(rangeValues(1, 10, 3)).toEqual([1, 4, 7, 10]);
    expect(rangeValues(1, 9, 3)).toEqual([1, 4, 7]);
  });

  it('steps down by the given amount', () => {
    expect(rangeValues(10, 1, 4)).toEqual([10, 6, 2]);
  });

  it('crosses zero into negative values', () => {
    expect(rangeValues(-2, 2, 2)).toEqual([-2, 0, 2]);
  });

  it('returns the single value when start and end match', () => {
    expect(rangeValues(4, 4, 1)).toEqual([4]);
  });

  it('returns nothing for a non-integer start, end or step', () => {
    expect(rangeValues(1.5, 5, 1)).toEqual([]);
    expect(rangeValues(1, 5.5, 1)).toEqual([]);
    expect(rangeValues(1, 5, 0.5)).toEqual([]);
  });

  it('returns nothing for a step below 1', () => {
    expect(rangeValues(1, 5, 0)).toEqual([]);
    expect(rangeValues(1, 5, -1)).toEqual([]);
  });

  it('returns nothing for NaN or Infinity', () => {
    expect(rangeValues(Number.NaN, 5, 1)).toEqual([]);
    expect(rangeValues(1, Number.POSITIVE_INFINITY, 1)).toEqual([]);
  });

  it('stops at 64 values by default so a typo cannot spin', () => {
    const values = rangeValues(1, 1000, 1);
    expect(values).toHaveLength(64);
    expect(values[63]).toBe(64);
  });

  it('honours a custom limit', () => {
    expect(rangeValues(1, 100, 1, 3)).toEqual([1, 2, 3]);
  });
});

describe('sweepValueLabel', () => {
  const row = sumRow('r', [{ id: 'p', count: 2, sides: 6, keep: { type: 'highest', n: 1 } }]);

  it('reads a count as the dice it rolls', () => {
    expect(sweepValueLabel(row, { kind: 'count', partId: 'p' }, 3)).toBe('3d6');
  });

  it('falls back to the bare number for a part the row does not have', () => {
    expect(sweepValueLabel(row, { kind: 'count', partId: 'missing' }, 3)).toBe('3');
  });

  it('reads a die size as dN', () => {
    expect(sweepValueLabel(row, { kind: 'sides', partId: 'p' }, 10)).toBe('d10');
  });

  it('reads keep n as khN on a keep-highest part', () => {
    expect(sweepValueLabel(row, { kind: 'keepN', partId: 'p' }, 2)).toBe('kh2');
  });

  it('signs a modifier, zero included', () => {
    expect(sweepValueLabel(row, MOD, 3)).toBe('+3');
    expect(sweepValueLabel(row, MOD, 0)).toBe('+0');
    expect(sweepValueLabel(row, MOD, -2)).toBe('−2');
  });

  it('reads a pool threshold with its direction', () => {
    expect(sweepValueLabel(poolRow(), { kind: 'poolThreshold' }, 8)).toBe('≥8');
  });
});

describe('sweepSourceValue', () => {
  const row = sumRow(
    'r',
    [
      { id: 'a', count: 2, sides: 6, keep: { type: 'highest', n: 1 } },
      { id: 'b', count: 1, sides: 8 },
    ],
    { mods: [{ op: 'sub', value: 3 }] },
  );

  it('reads the current count, die size and keep n of the addressed part', () => {
    expect(sweepSourceValue(row, { kind: 'count', partId: 'a' })).toBe(2);
    expect(sweepSourceValue(row, { kind: 'sides', partId: 'b' })).toBe(8);
    expect(sweepSourceValue(row, { kind: 'keepN', partId: 'a' })).toBe(1);
  });

  it('reads the modifier, negative included', () => {
    expect(sweepSourceValue(row, MOD)).toBe(-3);
  });

  it('reads a pool row threshold', () => {
    expect(sweepSourceValue(poolRow(), { kind: 'poolThreshold' })).toBe(5);
  });

  it('returns null when the target does not apply to the row', () => {
    expect(sweepSourceValue(row, { kind: 'keepN', partId: 'b' })).toBeNull();
    expect(sweepSourceValue(row, { kind: 'count', partId: 'missing' })).toBeNull();
    expect(sweepSourceValue(row, { kind: 'poolThreshold' })).toBeNull();
  });
});

describe('sweepTargets', () => {
  it('lists each part count and size, its keep n when it has one, then the modifier', () => {
    const row = sumRow('r', [
      { id: 'a', count: 2, sides: 6, keep: { type: 'highest', n: 1 } },
      { id: 'b', count: 1, sides: 8 },
    ]);
    expect(sweepTargets(row)).toEqual([
      { kind: 'count', partId: 'a' },
      { kind: 'sides', partId: 'a' },
      { kind: 'keepN', partId: 'a' },
      { kind: 'count', partId: 'b' },
      { kind: 'sides', partId: 'b' },
      { kind: 'modifier', step: 0 },
    ]);
  });

  it('adds the threshold last on a pool row', () => {
    expect(sweepTargets(poolRow())).toEqual([
      { kind: 'count', partId: 'pd' },
      { kind: 'sides', partId: 'pd' },
      { kind: 'modifier', step: 0 },
      { kind: 'poolThreshold' },
    ]);
  });

  it('offers no threshold on a pool row without one', () => {
    const row = poolRow();
    delete row.successThreshold;
    expect(sweepTargets(row).map((t) => t.kind)).not.toContain('poolThreshold');
  });
});

describe('sameSweepTarget', () => {
  it('matches the same kind on the same part', () => {
    expect(sameSweepTarget({ kind: 'count', partId: 'a' }, { kind: 'count', partId: 'a' })).toBe(true);
  });

  it('tells two parts apart', () => {
    expect(sameSweepTarget({ kind: 'count', partId: 'a' }, { kind: 'count', partId: 'b' })).toBe(false);
  });

  it('tells two kinds on one part apart', () => {
    expect(sameSweepTarget({ kind: 'count', partId: 'a' }, { kind: 'sides', partId: 'a' })).toBe(false);
  });

  it('matches row-wide targets by kind alone', () => {
    expect(sameSweepTarget(MOD, { kind: 'modifier', step: 0 })).toBe(true);
    expect(sameSweepTarget(MOD, { kind: 'poolThreshold' })).toBe(false);
  });
});

describe('largestSides', () => {
  it('returns the biggest die across every part', () => {
    const row = sumRow('r', [
      { id: 'a', count: 2, sides: 6 },
      { id: 'b', count: 1, sides: 10 },
    ]);
    expect(largestSides(row)).toBe(10);
  });

  it('returns 0 for a row with no parts', () => {
    expect(largestSides(sumRow('r', []))).toBe(0);
  });
});
