import { describe, expect, it } from 'vitest';
import type { CheckSpec, DicePart, Distribution, Expression } from '../types';
import { checkDistribution, checkOutcomeChances } from './check';
import { sortedKeys, totalMass } from './distribution';
import { mean } from './stats';

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

function range(dist: Distribution): [number, number] {
  const keys = sortedKeys(dist);
  return [keys[0] ?? 0, keys[keys.length - 1] ?? 0];
}

describe('checkOutcomeChances:roll modes on a single die without a crit rule', () => {
  it('advantage on 1d20 vs 15 succeeds 1 - (14/20)^2 of the time', () => {
    const chances = checkOutcomeChances(expr({ rollMode: 'advantage', check: spec({}) }));
    // Face k carries (2k-1)/400 under advantage: 29 + 31 + 33 + 35 + 37 + 39
    // across 15..20 is 204.
    expect(chances.success).toBeCloseTo(204 / 400, 12);
    expect(chances.failure).toBeCloseTo(196 / 400, 12);
    expect(chances.crit).toBe(0);
  });

  it('disadvantage on 1d20 vs 15 succeeds (6/20)^2 of the time', () => {
    const chances = checkOutcomeChances(expr({ rollMode: 'disadvantage', check: spec({}) }));
    // Face k carries (41-2k)/400 under disadvantage: 11 + 9 + 7 + 5 + 3 + 1
    // across 15..20 is 36.
    expect(chances.success).toBeCloseTo(36 / 400, 12);
    expect(chances.failure).toBeCloseTo(364 / 400, 12);
    expect(chances.crit).toBe(0);
  });
});

describe('checkOutcomeChances:crit weight under advantage over several faces', () => {
  it('crits when the better of two d20s shows a 19 or a 20', () => {
    const chances = checkOutcomeChances(
      expr({
        rollMode: 'advantage',
        check: spec({ crit: { onFaces: [19, 20], effect: 'doubleDice' } }),
      }),
    );
    // 1 - (18/20)^2 = 76/400: the 19 carries 37/400 and the 20 carries 39/400.
    // Plain successes are 15..18 at 29 + 31 + 33 + 35 = 128.
    expect(chances.crit).toBeCloseTo(76 / 400, 12);
    expect(chances.success).toBeCloseTo(128 / 400, 12);
    expect(chances.failure).toBeCloseTo(196 / 400, 12);
  });
});

describe('checkOutcomeChances:reroll feeds the explosion chain', () => {
  it('chain dice draw from the rerolled faces and a rerolled crit face never crits', () => {
    const chances = checkOutcomeChances(
      expr({
        parts: [
          part(1, 6, {
            reroll: { values: [1], mode: 'always' },
            explode: { onFaces: [6], depthCap: 1 },
          }),
        ],
        check: spec({
          threshold: { direction: 'gte', value: 8 },
          crit: { onFaces: [1], effect: 'doubleDice' },
        }),
      }),
    );
    // The die is uniform on 2..6 after the reroll, so the 6 chains into 8..12
    // at 1/25 each and no chain can total 7. A fresh d6 as the chain die would
    // put a 6 -> 1 = 7 below the bar and drop success to 1/6.
    expect(chances.crit).toBe(0);
    expect(chances.success).toBeCloseTo(1 / 5, 12);
    expect(chances.failure).toBeCloseTo(4 / 5, 12);
  });
});

describe('checkOutcomeChances:runaway single dice', () => {
  const rerolledAway = (): DicePart =>
    part(1, 6, { reroll: { values: [1, 2, 3, 4, 5, 6], mode: 'always' } });

  it('gives zero for every bucket when every face is rerolled away', () => {
    expect(checkOutcomeChances(expr({ parts: [rerolledAway()], check: spec({}) }))).toEqual({
      success: 0,
      crit: 0,
      failure: 0,
    });
  });

  it('gives an empty distribution when every face is rerolled away', () => {
    expect(checkDistribution(expr({ parts: [rerolledAway()], check: spec({}) })).size).toBe(0);
  });

  it('gives zero for every bucket when the die explodes on every face', () => {
    // The 2 is plain but its chain die explodes on both faces with depth to
    // spare, so the plain side empties out and the crit side is discarded with
    // it rather than reported as a 50% crit.
    const chances = checkOutcomeChances(
      expr({
        parts: [part(1, 2, { explode: { onFaces: [1, 2], depthCap: 10 } })],
        check: spec({
          threshold: { direction: 'gte', value: 1 },
          crit: { onFaces: [1], effect: 'doubleDice' },
        }),
      }),
    );
    expect(chances).toEqual({ success: 0, crit: 0, failure: 0 });
  });
});

describe('checkOutcomeChances:a single die that cannot fail', () => {
  for (const rollMode of ['normal', 'advantage'] as const) {
    it(`reports an exact zero failure under ${rollMode}`, () => {
      const chances = checkOutcomeChances(
        expr({ rollMode, check: spec({ threshold: { direction: 'gte', value: 1 } }) }),
      );
      expect(chances.failure).toBe(0);
      expect(chances.success).toBeCloseTo(1, 12);
    });

    it(`puts no mass on 0 under ${rollMode}`, () => {
      const dist = checkDistribution(
        expr({ rollMode, check: spec({ threshold: { direction: 'gte', value: 1 } }) }),
      );
      expect(dist.has(0)).toBe(false);
      expect(sortedKeys(dist)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      for (let k = 1; k <= 8; k++) expect(dist.get(k)).toBeCloseTo(1 / 8, 12);
    });
  }
});

describe('checkDistribution:crit effects on a keep-across effect', () => {
  const keepHighestOfD8D6 = { parts: [part(1, 8), part(1, 6)], flatModifier: 0 };

  it('maxPlusRoll adds the maximum of the kept die, not of the summed parts', () => {
    const dist = checkDistribution(
      alwaysCrits({
        effect: { ...keepHighestOfD8D6, keepAcross: { type: 'highest', n: 1 } },
        crit: { onFaces: [1, 2], effect: 'maxPlusRoll' },
      }),
    );
    // Highest of d8 and d6 spans 1..8 with mean 251/48; the bonus is that 8,
    // not the 14 a sum of the face maxima would give.
    expect(range(dist)).toEqual([9, 16]);
    expect(dist.get(9)).toBeCloseTo(1 / 48, 12);
    expect(dist.get(16)).toBeCloseTo(6 / 48, 12);
    expect(mean(dist)).toBeCloseTo(635 / 48, 12);
    expect(totalMass(dist)).toBeCloseTo(1, 12);
  });

  it('extraDie adds one die to the first part before keeping', () => {
    const dist = checkDistribution(
      alwaysCrits({
        effect: { ...keepHighestOfD8D6, keepAcross: { type: 'highest', n: 1 } },
        crit: { onFaces: [1, 2], effect: 'extraDie' },
      }),
    );
    // Highest of d8, d8 and d6: P(max <= v) = (v/8)^2 * min(v, 6)/6, so the
    // weights over 1..8 are 1, 7, 19, 37, 61, 91, 78, 90 out of 384 and the
    // mean is 2337/384.
    expect(range(dist)).toEqual([1, 8]);
    expect(dist.get(1)).toBeCloseTo(1 / 384, 12);
    expect(dist.get(6)).toBeCloseTo(91 / 384, 12);
    expect(dist.get(7)).toBeCloseTo(78 / 384, 12);
    expect(dist.get(8)).toBeCloseTo(90 / 384, 12);
    expect(mean(dist)).toBeCloseTo(2337 / 384, 12);
    expect(totalMass(dist)).toBeCloseTo(1, 12);
  });
});
