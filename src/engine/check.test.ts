import { describe, expect, it } from 'vitest';
import type { CheckSpec, DicePart, Distribution, Expression } from '../types';
import { checkDistribution, checkOutcomeChances } from './check';
import { totalMass } from './distribution';
import { expressionDistribution } from './expression';
import { mean, stddev } from './stats';

let nextPartId = 0;
const part = (count: number, sides: number, extra: Partial<DicePart> = {}): DicePart => ({
  id: `p${nextPartId++}`,
  count,
  sides,
  ...extra,
});

const expr = (overrides: Partial<Expression>): Expression => ({
  id: 'e',
  name: 'row',
  parts: [part(1, 20)],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'check',
  ...overrides,
});

const spec = (overrides: Partial<CheckSpec>): CheckSpec => ({
  threshold: { direction: 'gte', value: 15 },
  effect: { parts: [part(1, 8)], flatModifier: 0 },
  onSuccess: 'full',
  onFailure: 'none',
  ...overrides,
});

/** A d2 check die whose every face clears the bar, so the effect stands alone. */
const alwaysSucceeds = (overrides: Partial<CheckSpec>): Expression =>
  expr({
    parts: [part(1, 2)],
    check: spec({ threshold: { direction: 'gte', value: 1 }, ...overrides }),
  });

/** A d2 check die whose every face is a crit, so the crit effect stands alone. */
const alwaysCrits = (overrides: Partial<CheckSpec>): Expression =>
  expr({
    parts: [part(1, 2)],
    check: spec({
      threshold: { direction: 'gte', value: 1 },
      crit: { onFaces: [1, 2], effect: 'doubleDice' },
      ...overrides,
    }),
  });

function sortedEntries(dist: Distribution): [number, number][] {
  return [...dist.entries()].sort((a, b) => a[0] - b[0]);
}

function range(dist: Distribution): [number, number] {
  const keys = [...dist.keys()].sort((a, b) => a - b);
  return [keys[0] ?? 0, keys[keys.length - 1] ?? 0];
}

function expectDistribution(actual: Distribution, expected: [number, number][]): void {
  expect(sortedEntries(actual).map(([k]) => k)).toEqual(expected.map(([k]) => k));
  for (const [k, p] of expected) {
    expect(actual.get(k)).toBeCloseTo(p, 12);
  }
}

describe('checkOutcomeChances', () => {
  it('splits a check into success, crit and failure buckets that sum to 1', () => {
    const chances = checkOutcomeChances(
      expr({
        flatModifier: 7,
        check: spec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
      }),
    );
    expect(chances.success).toBeCloseTo(0.6, 12);
    expect(chances.crit).toBeCloseTo(0.05, 12);
    expect(chances.failure).toBeCloseTo(0.35, 12);
    expect(chances.success + chances.crit + chances.failure).toBeCloseTo(1, 12);
  });

  it('leaves criticals out of the success bucket', () => {
    const withoutCrit = checkOutcomeChances(expr({ flatModifier: 7, check: spec({}) }));
    const withCrit = checkOutcomeChances(
      expr({
        flatModifier: 7,
        check: spec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
      }),
    );
    expect(withoutCrit.success).toBeCloseTo(0.65, 12);
    expect(withCrit.success).toBeCloseTo(0.6, 12);
    expect(withCrit.success + withCrit.crit).toBeCloseTo(withoutCrit.success, 12);
  });

  it('counts a crit face as a success even when that face would miss the threshold', () => {
    const chances = checkOutcomeChances(
      expr({ check: spec({ crit: { onFaces: [1], effect: 'doubleDice' } }) }),
    );
    expect(chances.crit).toBeCloseTo(0.05, 12);
    expect(chances.success).toBeCloseTo(0.3, 12);
    expect(chances.failure).toBeCloseTo(0.65, 12);
  });

  it('reads advantage off the check die, so a 20 comes up 39/400 of the time', () => {
    const chances = checkOutcomeChances(
      expr({
        rollMode: 'advantage',
        flatModifier: 7,
        check: spec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
      }),
    );
    // Advantage weights face k by (2k-1)/400: 39 on the 20, 312 across the
    // 8..19 that clear the bar with the +7, and 49 across the 1..7 that do not.
    expect(chances.crit).toBeCloseTo(39 / 400, 12);
    expect(chances.success).toBeCloseTo(312 / 400, 12);
    expect(chances.failure).toBeCloseTo(49 / 400, 12);
  });

  it('reads disadvantage off the check die, so a 20 comes up 1/400 of the time', () => {
    const chances = checkOutcomeChances(
      expr({
        rollMode: 'disadvantage',
        flatModifier: 7,
        check: spec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
      }),
    );
    // Disadvantage weights face k by (41-2k)/400, mirroring the advantage case.
    expect(chances.crit).toBeCloseTo(1 / 400, 12);
    expect(chances.success).toBeCloseTo(168 / 400, 12);
    expect(chances.failure).toBeCloseTo(231 / 400, 12);
  });

  it('never crits when the crit rule lists no faces', () => {
    const chances = checkOutcomeChances(
      expr({ flatModifier: 7, check: spec({ crit: { onFaces: [], effect: 'doubleDice' } }) }),
    );
    expect(chances.crit).toBe(0);
    expect(chances.success).toBeCloseTo(0.65, 12);
  });

  it('never crits on a face the check die cannot show', () => {
    const chances = checkOutcomeChances(
      expr({ flatModifier: 7, check: spec({ crit: { onFaces: [21], effect: 'doubleDice' } }) }),
    );
    expect(chances.crit).toBe(0);
    expect(chances.success).toBeCloseTo(0.65, 12);
  });

  it('reads the crit face off a rerolled check die', () => {
    const chances = checkOutcomeChances(
      expr({
        parts: [part(1, 20, { reroll: { values: [1], mode: 'always' } })],
        check: spec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
      }),
    );
    expect(chances.crit).toBeCloseTo(1 / 19, 12);
  });

  it('crits on the natural face even when that face also explodes', () => {
    const chances = checkOutcomeChances(
      expr({
        parts: [part(1, 20, { explode: { onFaces: [20], depthCap: 10 } })],
        check: spec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
      }),
    );
    // Exploding moves all of a face's mass onto higher totals, so an unstripped
    // 20 would never show up as itself and the crit chance would read 0.
    expect(chances.crit).toBeCloseTo(0.05, 12);
    expect(chances.success).toBeCloseTo(0.25, 12);
    expect(chances.failure).toBeCloseTo(0.7, 12);
  });

  it('still explodes the non-crit faces of an exploding check die', () => {
    const chances = checkOutcomeChances(
      expr({
        parts: [part(1, 6, { explode: { onFaces: [6], depthCap: 1 } })],
        check: spec({
          threshold: { direction: 'gte', value: 7 },
          crit: { onFaces: [1], effect: 'doubleDice' },
        }),
      }),
    );
    // Only an exploded 6 can reach 7: totals 7..12 at 1/36 each.
    expect(chances.crit).toBeCloseTo(1 / 6, 12);
    expect(chances.success).toBeCloseTo(1 / 6, 12);
    expect(chances.failure).toBeCloseTo(4 / 6, 12);
  });

  it('reports an exact zero failure when every multi-die total succeeds', () => {
    const chances = checkOutcomeChances(
      expr({
        parts: [part(3, 6)],
        check: spec({ threshold: { direction: 'gte', value: 3 } }),
      }),
    );
    // Sixteen float additions leave 1 - success at ~1e-16, not 0, and a residue
    // that small would leak a phantom failure mass downstream.
    expect(chances.success).toBeCloseTo(1, 12);
    expect(chances.failure).toBe(0);
  });

  it('never crits on a check that rolls more than one die in a part', () => {
    const chances = checkOutcomeChances(
      expr({
        parts: [part(2, 20)],
        flatModifier: 7,
        check: spec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
      }),
    );
    expect(chances.crit).toBe(0);
  });

  it('never crits on a check split across two parts', () => {
    const chances = checkOutcomeChances(
      expr({
        parts: [part(1, 6), part(1, 6)],
        check: spec({
          threshold: { direction: 'gte', value: 9 },
          crit: { onFaces: [6], effect: 'doubleDice' },
        }),
      }),
    );
    expect(chances.crit).toBe(0);
    expect(chances.success).toBeCloseTo(10 / 36, 12);
  });

  it('buckets a multi-die check on the summed total', () => {
    const chances = checkOutcomeChances(
      expr({
        parts: [part(2, 6)],
        check: spec({ threshold: { direction: 'gte', value: 9 } }),
      }),
    );
    expect(chances.success).toBeCloseTo(10 / 36, 12);
    expect(chances.failure).toBeCloseTo(26 / 36, 12);
  });

  it('adds the flat modifier to a multi-die total before bucketing it', () => {
    const chances = checkOutcomeChances(
      expr({
        parts: [part(2, 6)],
        flatModifier: 2,
        check: spec({ threshold: { direction: 'gte', value: 9 } }),
      }),
    );
    expect(chances.success).toBeCloseTo(21 / 36, 12);
  });

  it('applies advantage to the whole total on a multi-die check', () => {
    const chances = checkOutcomeChances(
      expr({
        parts: [part(2, 6)],
        rollMode: 'advantage',
        check: spec({ threshold: { direction: 'gte', value: 12 } }),
      }),
    );
    expect(chances.success).toBeCloseTo(1 - (35 / 36) ** 2, 12);
  });

  it('treats a lte threshold as roll-under', () => {
    const chances = checkOutcomeChances(
      expr({ check: spec({ threshold: { direction: 'lte', value: 10 } }) }),
    );
    expect(chances.success).toBeCloseTo(0.5, 12);
    expect(chances.failure).toBeCloseTo(0.5, 12);
  });

  it('counts the modifier against the roller on a roll-under check', () => {
    const chances = checkOutcomeChances(
      expr({
        flatModifier: 3,
        check: spec({ threshold: { direction: 'lte', value: 10 } }),
      }),
    );
    expect(chances.success).toBeCloseTo(0.35, 12);
  });

  it('buckets a multi-die roll-under check on the total', () => {
    const chances = checkOutcomeChances(
      expr({
        parts: [part(2, 6)],
        check: spec({ threshold: { direction: 'lte', value: 5 } }),
      }),
    );
    expect(chances.success).toBeCloseTo(10 / 36, 12);
  });

  it('counts a roll-under crit face as a success below the bar', () => {
    const chances = checkOutcomeChances(
      expr({
        check: spec({
          threshold: { direction: 'lte', value: 10 },
          crit: { onFaces: [1], effect: 'doubleDice' },
        }),
      }),
    );
    expect(chances.crit).toBeCloseTo(0.05, 12);
    expect(chances.success).toBeCloseTo(9 / 20, 12);
    expect(chances.failure).toBeCloseTo(0.5, 12);
  });

  it('treats a non-finite check modifier as zero', () => {
    const nan = checkOutcomeChances(expr({ flatModifier: Number.NaN, check: spec({}) }));
    const infinite = checkOutcomeChances(
      expr({ flatModifier: Number.POSITIVE_INFINITY, check: spec({}) }),
    );
    expect(nan.success).toBeCloseTo(0.3, 12);
    expect(infinite.success).toBeCloseTo(0.3, 12);
  });

  it('returns zero for every bucket when the row has no check spec', () => {
    expect(checkOutcomeChances(expr({}))).toEqual({ success: 0, crit: 0, failure: 0 });
  });

  it('returns zero for every bucket when the check has no dice', () => {
    expect(checkOutcomeChances(expr({ parts: [], check: spec({}) }))).toEqual({
      success: 0,
      crit: 0,
      failure: 0,
    });
  });

  it('returns zero for every bucket when the check die has fewer than two sides', () => {
    expect(checkOutcomeChances(expr({ parts: [part(1, 1)], check: spec({}) }))).toEqual({
      success: 0,
      crit: 0,
      failure: 0,
    });
  });

  it('returns zero for every bucket when a multi-die check has an invalid die', () => {
    expect(checkOutcomeChances(expr({ parts: [part(2, 0)], check: spec({}) }))).toEqual({
      success: 0,
      crit: 0,
      failure: 0,
    });
  });
});

describe('checkDistribution', () => {
  it('mixes the effect by how often each outcome happens', () => {
    // 1d4 needs a 4 to clear the bar, so a success is 1 in 4 and a failure 3 in
    // 4. The effect is 1d2: full on a success, halved and floored on a failure.
    // The lopsided split is the point. On an even one the two scales could trade
    // places and the mix would come out identical.
    const dist = checkDistribution(
      expr({
        parts: [part(1, 4)],
        check: spec({
          threshold: { direction: 'gte', value: 4 },
          effect: { parts: [part(1, 2)], flatModifier: 0 },
          onSuccess: 'full',
          onFailure: 'half',
        }),
      }),
    );
    expectDistribution(dist, [
      [0, 0.375],
      [1, 0.5],
      [2, 0.125],
    ]);
    expect(mean(dist)).toBeCloseTo(0.75, 12);
  });

  it('gives a point mass at 0 when neither outcome applies any effect', () => {
    const dist = checkDistribution(
      expr({ check: spec({ onSuccess: 'none', onFailure: 'none' }) }),
    );
    expect(dist.size).toBe(1);
    expectDistribution(dist, [[0, 1]]);
  });

  it('puts no mass on 0 when every total of a multi-die check succeeds', () => {
    const dist = checkDistribution(
      expr({
        parts: [part(3, 6)],
        check: spec({ threshold: { direction: 'gte', value: 3 } }),
      }),
    );
    expect(dist.has(0)).toBe(false);
    expect(range(dist)).toEqual([1, 8]);
  });

  it('collapses a crit to the point mass at 0 when the success scale is none', () => {
    const dist = checkDistribution(alwaysCrits({ onSuccess: 'none' }));
    expectDistribution(dist, [[0, 1]]);
  });

  it('scales an outcome to a point mass at 0 when its scale is none', () => {
    const dist = checkDistribution(
      alwaysSucceeds({
        effect: { parts: [part(1, 8)], flatModifier: 4 },
        onSuccess: 'none',
      }),
    );
    expectDistribution(dist, [[0, 1]]);
  });

  it('leaves the effect untouched when the scale is full', () => {
    const dist = checkDistribution(
      alwaysSucceeds({ effect: { parts: [part(1, 8)], flatModifier: 4 } }),
    );
    expect(range(dist)).toEqual([5, 12]);
    for (let k = 5; k <= 12; k++) {
      expect(dist.get(k)).toBeCloseTo(1 / 8, 12);
    }
  });

  it('rounds an odd total down when the scale is half', () => {
    const dist = checkDistribution(
      alwaysSucceeds({
        effect: { parts: [part(1, 2)], flatModifier: 0 },
        onSuccess: 'half',
      }),
    );
    expectDistribution(dist, [
      [0, 0.5],
      [1, 0.5],
    ]);
  });

  it('rounds a negative total down, away from zero, when the scale is half', () => {
    // Totals are -3 and -2, so floor gives -2 and -1 rather than the -1 and -1
    // that truncation toward zero would produce.
    const dist = checkDistribution(
      alwaysSucceeds({
        effect: { parts: [part(1, 2)], flatModifier: -4 },
        onSuccess: 'half',
      }),
    );
    expectDistribution(dist, [
      [-2, 0.5],
      [-1, 0.5],
    ]);
  });

  it('doubles every effect die on a doubleDice crit', () => {
    // 2d6 + 1d4 + 3 doubles to 4d6 + 2d4 + 3, so the mean is 14 + 5 + 3. The
    // single d4 is what makes this test bite: on a part of two, doubling and
    // adding two land on the same count, so a two-die part alone proves nothing.
    const dist = checkDistribution(
      alwaysCrits({ effect: { parts: [part(2, 6), part(1, 4)], flatModifier: 3 } }),
    );
    expect(mean(dist)).toBeCloseTo(22, 12);
    expect(range(dist)).toEqual([9, 35]);
    expect(totalMass(dist)).toBeCloseTo(1, 9);
  });

  it('adds one die to the first part only on an extraDie crit', () => {
    // 2d8 + 1d6 gains one d8, giving 3d8 + 1d6 and a mean of 13.5 + 3.5. The
    // first part holds two dice on purpose: at one die, adding one and doubling
    // agree, and the second part catches an extra die landing everywhere.
    const dist = checkDistribution(
      alwaysCrits({
        effect: { parts: [part(2, 8), part(1, 6)], flatModifier: 0 },
        crit: { onFaces: [1, 2], effect: 'extraDie' },
      }),
    );
    expect(mean(dist)).toBeCloseTo(17, 12);
    expect(range(dist)).toEqual([4, 30]);
    expect(totalMass(dist)).toBeCloseTo(1, 9);
  });

  it('shifts by the maximum dice total on a maxPlusRoll crit', () => {
    const dist = checkDistribution(
      alwaysCrits({
        effect: { parts: [part(2, 6)], flatModifier: 3 },
        crit: { onFaces: [1, 2], effect: 'maxPlusRoll' },
      }),
    );
    // 2d6 + 3 + max(2d6) = 2d6 + 15. A doubled modifier would mean 2d6 + 18.
    expect(mean(dist)).toBeCloseTo(22, 12);
    expect(range(dist)).toEqual([17, 27]);
  });

  it('leaves the modifier alone when a maxPlusRoll crit adds the dice maximum', () => {
    const dist = checkDistribution(
      alwaysCrits({
        effect: { parts: [part(1, 4)], flatModifier: 5 },
        crit: { onFaces: [1, 2], effect: 'maxPlusRoll' },
      }),
    );
    // 1d4 + 5 + 4, so 10..13 with equal weight, not 1d4 + 10 + 4.
    expectDistribution(dist, [
      [10, 0.25],
      [11, 0.25],
      [12, 0.25],
      [13, 0.25],
    ]);
  });

  it('applies the success scale to the crit effect as well', () => {
    const dist = checkDistribution(
      alwaysCrits({
        effect: { parts: [part(1, 2)], flatModifier: 1 },
        onSuccess: 'half',
      }),
    );
    // 2d2 + 1 is 3, 4, 5 at 1/4, 1/2, 1/4; halved and floored that is 1, 2, 2.
    expectDistribution(dist, [
      [1, 0.25],
      [2, 0.75],
    ]);
    expect(mean(dist)).toBeCloseTo(1.75, 12);
  });

  it('gives a failure the plain effect while the crit slice gets the bigger one', () => {
    const dist = checkDistribution(
      expr({
        check: spec({
          threshold: { direction: 'gte', value: 21 },
          effect: { parts: [part(1, 2)], flatModifier: 0 },
          onSuccess: 'full',
          onFailure: 'full',
          crit: { onFaces: [20], effect: 'doubleDice' },
        }),
      }),
    );
    // Never succeeds without critting: 95% plain 1d2, 5% doubled to 2d2.
    expectDistribution(dist, [
      [1, 0.475],
      [2, 0.4875],
      [3, 0.025],
      [4, 0.0125],
    ]);
  });

  it('keeps the highest die across the effect parts when the effect keeps across', () => {
    const dist = checkDistribution(
      alwaysSucceeds({
        effect: {
          parts: [part(1, 8), part(1, 6)],
          flatModifier: 0,
          keepAcross: { type: 'highest', n: 1 },
        },
      }),
    );
    expect(mean(dist)).toBeCloseTo(251 / 48, 12);
    expect(range(dist)).toEqual([1, 8]);
    expect(totalMass(dist)).toBeCloseTo(1, 9);
  });

  it('rolls a keep-across effect with doubled dice on a crit', () => {
    const dist = checkDistribution(
      alwaysCrits({
        effect: {
          parts: [part(1, 8), part(1, 6)],
          flatModifier: 0,
          keepAcross: { type: 'highest', n: 1 },
        },
      }),
    );
    // Highest one of 2d8 and 2d6.
    expect(mean(dist)).toBeCloseTo(14393 / 2304, 12);
    expect(range(dist)).toEqual([1, 8]);
  });

  it('treats a non-finite effect modifier as zero', () => {
    const dist = checkDistribution(
      alwaysSucceeds({ effect: { parts: [part(1, 2)], flatModifier: Number.NaN } }),
    );
    expectDistribution(dist, [
      [1, 0.5],
      [2, 0.5],
    ]);
  });

  it('returns an empty distribution when the row has no check spec', () => {
    expect(checkDistribution(expr({})).size).toBe(0);
  });

  it('returns an empty distribution when the check has no dice', () => {
    expect(checkDistribution(expr({ parts: [], check: spec({}) })).size).toBe(0);
  });

  it('returns an empty distribution when the check die has fewer than two sides', () => {
    expect(checkDistribution(expr({ parts: [part(1, 1)], check: spec({}) })).size).toBe(0);
  });

  it('returns an empty distribution when the effect has no dice', () => {
    const dist = checkDistribution(
      expr({ check: spec({ effect: { parts: [], flatModifier: 4 } }) }),
    );
    expect(dist.size).toBe(0);
  });

  it('returns an empty distribution when the effect die has fewer than two sides', () => {
    const dist = checkDistribution(
      expr({ check: spec({ effect: { parts: [part(1, 1)], flatModifier: 0 } }) }),
    );
    expect(dist.size).toBe(0);
  });

  it('returns an empty distribution when the effect die count is zero', () => {
    const dist = checkDistribution(
      expr({ check: spec({ effect: { parts: [part(0, 6)], flatModifier: 0 } }) }),
    );
    expect(dist.size).toBe(0);
  });

  it('sums to 1 for every shape of check row', () => {
    const rows: Expression[] = [
      expr({ flatModifier: 7, check: spec({ crit: { onFaces: [20], effect: 'doubleDice' } }) }),
      expr({ flatModifier: 7, check: spec({ crit: { onFaces: [20], effect: 'extraDie' } }) }),
      expr({ flatModifier: 7, check: spec({ crit: { onFaces: [20], effect: 'maxPlusRoll' } }) }),
      expr({ rollMode: 'advantage', flatModifier: 2, check: spec({ onFailure: 'half' }) }),
      expr({ rollMode: 'disadvantage', check: spec({ onSuccess: 'half', onFailure: 'full' }) }),
      expr({ parts: [part(2, 6)], check: spec({ threshold: { direction: 'lte', value: 7 } }) }),
      expr({ check: spec({ onSuccess: 'none', onFailure: 'none' }) }),
      expr({ check: spec({ threshold: { direction: 'gte', value: 21 } }) }),
      alwaysSucceeds({
        effect: {
          parts: [part(1, 8), part(1, 6)],
          flatModifier: 2,
          keepAcross: { type: 'lowest', n: 1 },
        },
      }),
      alwaysCrits({ effect: { parts: [part(3, 6)], flatModifier: -2 }, onSuccess: 'half' }),
    ];
    for (const row of rows) {
      expect(totalMass(checkDistribution(row))).toBeCloseTo(1, 9);
    }
  });
});

describe('check rows through expressionDistribution', () => {
  it('1d20+7 vs 15 dealing 1d8+4, crit 20 doubling dice, averages 5.75', () => {
    const row = expr({
      flatModifier: 7,
      check: spec({
        effect: { parts: [part(1, 8)], flatModifier: 4 },
        crit: { onFaces: [20], effect: 'doubleDice' },
      }),
    });
    const dist = expressionDistribution(row);
    expect(totalMass(dist)).toBeCloseTo(1, 9);
    expect(mean(dist)).toBeCloseTo(5.75, 4);
    expect(stddev(dist)).toBeCloseTo(4.7342, 4);
    expect(range(dist)).toEqual([0, 20]);
  });

  it('1d20+7 vs 15 with a crit on 20 lands something 65% of the time', () => {
    const chances = checkOutcomeChances(
      expr({
        flatModifier: 7,
        check: spec({
          effect: { parts: [part(1, 8)], flatModifier: 4 },
          crit: { onFaces: [20], effect: 'doubleDice' },
        }),
      }),
    );
    expect(chances.success + chances.crit).toBeCloseTo(0.65, 4);
  });

  it('1d20+5 vs 15 dealing 2d6+4, crit 20 doubling dice, averages 6.4', () => {
    const dist = expressionDistribution(
      expr({
        flatModifier: 5,
        check: spec({
          effect: { parts: [part(2, 6)], flatModifier: 4 },
          crit: { onFaces: [20], effect: 'doubleDice' },
        }),
      }),
    );
    expect(totalMass(dist)).toBeCloseTo(1, 9);
    expect(mean(dist)).toBeCloseTo(6.4, 4);
    expect(stddev(dist)).toBeCloseTo(6.2642, 4);
    expect(range(dist)).toEqual([0, 28]);
  });

  it('1d20+3 vs 15 dealing 8d6, half on a success and full on a failure, averages 21.5875', () => {
    const dist = expressionDistribution(
      expr({
        flatModifier: 3,
        check: spec({
          effect: { parts: [part(8, 6)], flatModifier: 0 },
          onSuccess: 'half',
          onFailure: 'full',
        }),
      }),
    );
    expect(totalMass(dist)).toBeCloseTo(1, 9);
    expect(mean(dist)).toBeCloseTo(21.5875, 4);
    expect(stddev(dist)).toBeCloseTo(8.1083, 4);
    expect(range(dist)).toEqual([4, 48]);
  });

  it('returns an empty distribution for a check row with no parts', () => {
    expect(expressionDistribution(expr({ parts: [], check: spec({}) })).size).toBe(0);
  });
});
