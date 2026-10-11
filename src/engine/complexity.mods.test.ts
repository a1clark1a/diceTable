import { describe, expect, it } from 'vitest';
import type { CheckSpec, DicePart, Distribution, Expression, ModStep } from '../types';
import { expressionTooComplex, MAX_SUPPORT_WORK, supportWidth } from './complexity';
import { totalMass } from './distribution';
import { expressionDistribution } from './expression';

const dice = (count: number, sides: number, extra: Partial<DicePart> = {}): DicePart => ({
  id: `${count}d${sides}`,
  count,
  sides,
  ...extra,
});

const add = (value: number): ModStep => ({ op: 'add', value });
const sub = (value: number): ModStep => ({ op: 'sub', value });
const mul = (value: number): ModStep => ({ op: 'mul', value });
const div = (value: number): ModStep => ({ op: 'div', value });

function sumRow(parts: DicePart[], mods?: ModStep[]): Expression {
  const row: Expression = {
    id: 'sum',
    name: 'sum',
    parts,
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
  if (mods) row.mods = mods;
  return row;
}

function poolRow(parts: DicePart[], mods?: ModStep[]): Expression {
  const row: Expression = {
    id: 'pool',
    name: 'pool',
    parts,
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 4 },
  };
  if (mods) row.mods = mods;
  return row;
}

// How many integers lie between the lowest and highest total: what hitSeries
// and the chart axis walk one at a time.
function drawnSpan(dist: Distribution): number {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const k of dist.keys()) {
    if (k < lo) lo = k;
    if (k > hi) hi = k;
  }
  return hi - lo + 1;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

describe('supportWidth prices a sum row by its chain', () => {
  it('turns a width of W into (W - 1) x M + 1 under a multiply by M', () => {
    // 2d6 lands on 2..12, 11 totals; tripled they land on 6..36, 31 integers.
    expect(supportWidth(sumRow([dice(2, 6)], [mul(3)]))).toBe(31);
  });

  it('prices a multiplied row exactly as wide as the totals it draws', () => {
    // 2..12 times 700 is 1,400..8,400, which is 7,001 integers.
    const row = sumRow([dice(2, 6)], [mul(100), mul(7)]);
    expect(supportWidth(row)).toBe(7001);
    expect(drawnSpan(expressionDistribution(row))).toBe(7001);
  });

  it('leaves the width alone for an add or subtract step, however big', () => {
    // 3d6 lands on 3..18, 16 totals, wherever the chain moves them.
    expect(supportWidth(sumRow([dice(3, 6)], [add(5)]))).toBe(16);
    expect(supportWidth(sumRow([dice(3, 6)], [sub(5)]))).toBe(16);
    expect(supportWidth(sumRow([dice(3, 6)], [add(1e6)]))).toBe(16);
    expect(supportWidth(sumRow([dice(3, 6)], [sub(1e6), add(999), sub(1)]))).toBe(16);
  });

  it('ignores an add between two multiplies', () => {
    // x2 +3 x2 spreads 2d6 as far as x4 does: (11 - 1) x 4 + 1 = 41.
    expect(supportWidth(sumRow([dice(2, 6)], [mul(2), add(3), mul(2)]))).toBe(41);
  });

  it('still charges for the dice when a divide narrows what is drawn', () => {
    // 2d6 halved draws only 1..6, but all eleven totals are convolved first.
    expect(supportWidth(sumRow([dice(2, 6)], [div(2)]))).toBe(11);
  });

  it('narrows a multiplied width when a divide follows', () => {
    // x10 spreads 2d6 to 20..120, 101 wide; halving draws 10..60, 51 wide.
    const row = sumRow([dice(2, 6)], [mul(10), div(2)]);
    expect(supportWidth(row)).toBe(51);
    expect(drawnSpan(expressionDistribution(row))).toBe(51);
  });

  it('folds the chain in order, so swapping a multiply and a divide changes the width', () => {
    // x10 then /3: 20..120 becomes 6..40, 35 wide.
    // /3 then x10: 0..4 becomes 0..40, 41 wide.
    expect(supportWidth(sumRow([dice(2, 6)], [mul(10), div(3)]))).toBe(35);
    expect(supportWidth(sumRow([dice(2, 6)], [div(3), mul(10)]))).toBe(41);
  });

  it('matches the drawn span whichever order the multiply and divide run in', () => {
    const multiplyFirst = sumRow([dice(2, 6)], [mul(10), div(3)]);
    const divideFirst = sumRow([dice(2, 6)], [div(3), mul(10)]);
    expect(drawnSpan(expressionDistribution(multiplyFirst))).toBe(supportWidth(multiplyFirst));
    expect(drawnSpan(expressionDistribution(divideFirst))).toBe(supportWidth(divideFirst));
  });

  it('leaves the width alone for a multiply or divide by 1', () => {
    expect(supportWidth(sumRow([dice(2, 6)], [mul(1)]))).toBe(11);
    expect(supportWidth(sumRow([dice(2, 6)], [div(1)]))).toBe(11);
  });

  it('spreads only the dice a keep rule keeps', () => {
    // Three kept d6 land on 3..18, 16 totals: (16 - 1) x 10 + 1 = 151, not the
    // 201 that four rolled dice would spread to.
    const row = sumRow([dice(4, 6, { keep: { type: 'highest', n: 3 } })], [mul(10)]);
    expect(supportWidth(row)).toBe(151);
  });

  it('prices a check row without a chain it never applies', () => {
    const spec: CheckSpec = {
      threshold: { direction: 'gte', value: 15 },
      effect: { parts: [dice(1, 8)], flatModifier: 0 },
      onSuccess: 'full',
      onFailure: 'none',
    };
    const check: Expression = { ...sumRow([dice(1, 20)]), mode: 'check', check: spec };
    // The widest thing it rolls is the d20 (19 apart), plus one: 20.
    expect(supportWidth(check)).toBe(20);
    expect(supportWidth({ ...check, mods: [mul(100), mul(100)] })).toBe(20);
  });
});

describe('supportWidth prices a pool row by its chain', () => {
  it('counts a pool row as wide as its successes, 0 up to the number of dice', () => {
    expect(supportWidth(poolRow([dice(4, 6), dice(6, 10)]))).toBe(11);
  });

  it('spreads the success count under a multiply', () => {
    // 0..10 successes tripled land on 0..30, 31 integers.
    expect(supportWidth(poolRow([dice(10, 6)], [mul(3)]))).toBe(31);
  });

  it('leaves a pool row alone for an add or subtract step', () => {
    expect(supportWidth(poolRow([dice(10, 6)], [add(2)]))).toBe(11);
    expect(supportWidth(poolRow([dice(10, 6)], [sub(1e6)]))).toBe(11);
  });

  it('narrows a pool row under a divide', () => {
    // 0..10 successes halved land on 0..5, 6 integers.
    expect(supportWidth(poolRow([dice(10, 6)], [div(2)]))).toBe(6);
  });
});

describe('the guard edge under a multiply', () => {
  it('sits between a width of 7,071 and 7,072', () => {
    expect(7071 * 7071).toBeLessThanOrEqual(MAX_SUPPORT_WORK);
    expect(7072 * 7072).toBeGreaterThan(MAX_SUPPORT_WORK);
  });

  it('admits a multiplied row exactly at the edge', () => {
    // 101d8 is 707 apart; times 10 that is 7,071 wide.
    const row = sumRow([dice(101, 8)], [mul(10)]);
    expect(supportWidth(row)).toBe(7071);
    expect(expressionTooComplex(row)).toBe(false);
  });

  it('refuses a multiplied row one integer past the edge', () => {
    // 2357d2 is 2,357 apart; tripled that is 7,072 wide.
    const plain = sumRow([dice(2357, 2)]);
    const tripled = sumRow([dice(2357, 2)], [mul(3)]);
    expect(expressionTooComplex(plain)).toBe(false);
    expect(supportWidth(tripled)).toBe(7072);
    expect(expressionTooComplex(tripled)).toBe(true);
  });

  it('admits 20d100 plain and refuses it multiplied by 4', () => {
    // 20d100 is 1,980 apart: 1,981 wide plain, 7,921 wide quadrupled.
    expect(expressionTooComplex(sumRow([dice(20, 100)]))).toBe(false);
    const quadrupled = sumRow([dice(20, 100)], [mul(4)]);
    expect(supportWidth(quadrupled)).toBe(7921);
    expect(expressionTooComplex(quadrupled)).toBe(true);
  });

  it('admits 20d100 multiplied by 3', () => {
    // 1,980 x 3 + 1 = 5,941 wide, squared about 3.5e7.
    const tripled = sumRow([dice(20, 100)], [mul(3)]);
    expect(supportWidth(tripled)).toBe(5941);
    expect(expressionTooComplex(tripled)).toBe(false);
  });

  it('admits 2d6 x100 x7 and refuses 2d6 x100 x8', () => {
    // 10 x 700 + 1 = 7,001 and 10 x 800 + 1 = 8,001.
    expect(expressionTooComplex(sumRow([dice(2, 6)], [mul(100), mul(7)]))).toBe(false);
    expect(expressionTooComplex(sumRow([dice(2, 6)], [mul(100), mul(8)]))).toBe(true);
  });

  it('holds the edge for a multiplier past the editor cap', () => {
    // 10 x 707 + 1 = 7,071 and 10 x 708 + 1 = 7,081.
    expect(expressionTooComplex(sumRow([dice(2, 6)], [mul(707)]))).toBe(false);
    expect(expressionTooComplex(sumRow([dice(2, 6)], [mul(708)]))).toBe(true);
  });

  it('admits a 101-die pool at x70 and refuses it at x71', () => {
    // 0..101 successes: 101 x 70 + 1 = 7,071 and 101 x 71 + 1 = 7,172.
    expect(expressionTooComplex(poolRow([dice(101, 6)]))).toBe(false);
    expect(expressionTooComplex(poolRow([dice(101, 6)], [mul(70)]))).toBe(false);
    expect(expressionTooComplex(poolRow([dice(101, 6)], [mul(71)]))).toBe(true);
  });

  it('draws a pool at the edge exactly as wide as it was priced', () => {
    const row = poolRow([dice(101, 6)], [mul(70)]);
    expect(drawnSpan(expressionDistribution(row))).toBe(7071);
  });

  it('never lets a divide through a convolution too wide to run', () => {
    // 100d100 is 9,901 wide before any step, and the dice are summed first.
    expect(expressionTooComplex(sumRow([dice(100, 100)], [div(10)]))).toBe(true);
    expect(expressionTooComplex(sumRow([dice(100, 100)], [div(100), div(100), div(100)]))).toBe(
      true,
    );
  });

  it('returns the empty distribution for a row the multiply pushed past the edge', () => {
    expect(expressionDistribution(sumRow([dice(20, 100)], [mul(4)])).size).toBe(0);
  });

  it('computes an admitted multiplied row with full mass and no new totals', () => {
    // Multiplying spreads 20d100's 1,981 totals apart without adding any.
    const dist = expressionDistribution(sumRow([dice(20, 100)], [mul(3)]));
    expect(dist.size).toBe(1981);
    expect(totalMass(dist)).toBeCloseTo(1, 12);
  });
});

describe('refusing before anything is built', () => {
  it('refuses 20d100 x10 x10 in under a millisecond', () => {
    // 1,980 x 100 + 1 = 198,001 wide.
    const row = sumRow([dice(20, 100)], [mul(10), mul(10)]);
    expect(supportWidth(row)).toBe(198001);

    const calls = 2000;
    let refused = 0;
    const t0 = performance.now();
    for (let i = 0; i < calls; i++) {
      if (expressionTooComplex(row)) refused++;
    }
    const average = (performance.now() - t0) / calls;

    expect(refused).toBe(calls);
    expect(average).toBeLessThan(1);
  });

  it('returns a refused row empty without paying for its dice', () => {
    // 70d100 alone measured about 300ms to convolve, so building it on even one
    // call would put the average far past a millisecond. Doubled it is 13,861
    // wide and refused.
    const row = sumRow([dice(70, 100)], [mul(2)]);
    const calls = 20;
    let empty = 0;
    const t0 = performance.now();
    for (let i = 0; i < calls; i++) {
      if (expressionDistribution(row).size === 0) empty++;
    }
    const average = (performance.now() - t0) / calls;

    expect(empty).toBe(calls);
    expect(average).toBeLessThan(1);
  });

  it('scores a row without changing it', () => {
    const row = deepFreeze(sumRow([dice(20, 100)], [mul(10), add(3), div(2)]));
    const copy = structuredClone(row);
    expect(() => supportWidth(row)).not.toThrow();
    expect(() => expressionTooComplex(row)).not.toThrow();
    expect(row).toEqual(copy);
  });
});
