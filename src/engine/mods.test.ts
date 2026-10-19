import { describe, expect, it } from 'vitest';
import type { Distribution, ModStep } from '../types';
import {
  clampAtZero,
  divideFloor,
  scale,
  shift,
  sortedKeys,
  totalMass,
  uniformDistribution,
} from './distribution';
import { applyMods, modsWidth } from './mods';

function expectDistribution(dist: Distribution, expected: Array<[number, number]>): void {
  const sorted = [...expected].sort((a, b) => a[0] - b[0]);
  expect(sortedKeys(dist)).toEqual(sorted.map(([k]) => k));
  for (const [k, p] of sorted) expect(dist.get(k)).toBeCloseTo(p, 12);
}

/** Every integer from `low` to `low + width - 1`, equally likely. */
function evenRange(low: number, width: number): Distribution {
  return shift(uniformDistribution(width), low - 1);
}

function spanOf(dist: Distribution): number {
  const keys = sortedKeys(dist);
  const lowest = keys[0];
  const highest = keys[keys.length - 1];
  if (lowest === undefined || highest === undefined) return 0;
  return highest - lowest + 1;
}

const sixth = 1 / 6;

describe('shift', () => {
  it('adds the mass of two totals that round onto one value instead of dropping one', () => {
    // Doubles are 4 apart past 2^54, so 2^54 + 2 rounds (half to even) onto 2^54.
    const big = 2 ** 53;
    const shifted = shift(new Map([[big, 0.25], [big + 2, 0.75]]), big);
    expectDistribution(shifted, [[2 ** 54, 1]]);
  });

  it('hands back a copy at offset 0 that can change without touching the input', () => {
    const input = uniformDistribution(6);
    const copy = shift(input, 0);
    copy.set(1, 0.5);
    expect(input.get(1)).toBeCloseTo(sixth, 12);
  });
});

describe('scale', () => {
  it('spreads the totals apart without merging or creating any', () => {
    expectDistribution(scale(uniformDistribution(6), 3), [
      [3, sixth], [6, sixth], [9, sixth], [12, sixth], [15, sixth], [18, sixth],
    ]);
  });

  it('moves a negative total further from zero', () => {
    expectDistribution(scale(new Map([[-2, 0.5], [1, 0.5]]), 3), [[-6, 0.5], [3, 0.5]]);
  });

  it('hands back a copy at a factor of 1 that can change without touching the input', () => {
    const input = uniformDistribution(6);
    const copy = scale(input, 1);
    copy.set(1, 0.5);
    expect(input.get(1)).toBeCloseTo(sixth, 12);
  });

  it.each([
    ['0', 0],
    ['a negative factor', -2],
    ['a fraction', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('refuses %s with an empty distribution', (_label, factor) => {
    expect(scale(uniformDistribution(6), factor).size).toBe(0);
  });
});

describe('divideFloor', () => {
  it('merges neighbouring totals and adds their mass', () => {
    // 1 -> 0, 2 and 3 -> 1, 4 and 5 -> 2, 6 -> 3.
    expectDistribution(divideFloor(uniformDistribution(6), 2), [
      [0, sixth], [1, 2 * sixth], [2, 2 * sixth], [3, sixth],
    ]);
  });

  it('rounds a negative total down, away from zero', () => {
    // -3 / 2 = -1.5 floors to -2; rounding toward zero would give -1.
    expectDistribution(divideFloor(new Map([[-3, 0.5], [3, 0.5]]), 2), [[-2, 0.5], [1, 0.5]]);
  });

  it('puts every total on 0 when the divisor is bigger than all of them', () => {
    expectDistribution(divideFloor(uniformDistribution(6), 7), [[0, 1]]);
  });

  it('keeps total mass at 1 however many totals merge', () => {
    for (let divisor = 1; divisor <= 25; divisor++) {
      expect(totalMass(divideFloor(evenRange(-12, 20), divisor))).toBeCloseTo(1, 12);
    }
  });

  it('hands back a copy at a divisor of 1 that can change without touching the input', () => {
    const input = uniformDistribution(6);
    const copy = divideFloor(input, 1);
    copy.set(1, 0.5);
    expect(input.get(1)).toBeCloseTo(sixth, 12);
  });

  it.each([
    ['0', 0],
    ['a negative divisor', -2],
    ['a fraction', 2.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('refuses %s with an empty distribution', (_label, divisor) => {
    expect(divideFloor(uniformDistribution(6), divisor).size).toBe(0);
  });
});

describe('clampAtZero', () => {
  it('collapses every negative total onto 0 and adds their mass', () => {
    const clamped = clampAtZero(new Map([[-2, 0.25], [-1, 0.25], [0, 0.25], [3, 0.25]]));
    expectDistribution(clamped, [[0, 0.75], [3, 0.25]]);
  });

  it('leaves totals that are all at least 0 where they were', () => {
    expectDistribution(clampAtZero(new Map([[0, 0.5], [2, 0.5]])), [[0, 0.5], [2, 0.5]]);
  });
});

describe('applyMods', () => {
  it.each<[string, ModStep[] | undefined]>([
    ['no chain', undefined],
    ['an empty chain', []],
  ])('changes nothing with %s', (_label, mods) => {
    expectDistribution(applyMods(uniformDistribution(4), mods), [
      [1, 0.25], [2, 0.25], [3, 0.25], [4, 0.25],
    ]);
  });

  it('moves the total down by the size of a subtract step', () => {
    expectDistribution(applyMods(uniformDistribution(6), [{ op: 'sub', value: 2 }]), [
      [-1, sixth], [0, sixth], [1, sixth], [2, sixth], [3, sixth], [4, sixth],
    ]);
  });

  it('adds before multiplying when the add comes first', () => {
    // (k + 1) x 2 for k = 1..6.
    const mods: ModStep[] = [{ op: 'add', value: 1 }, { op: 'mul', value: 2 }];
    expect(sortedKeys(applyMods(uniformDistribution(6), mods))).toEqual([4, 6, 8, 10, 12, 14]);
  });

  it('multiplies before adding when the multiply comes first', () => {
    // k x 2 + 1 for k = 1..6.
    const mods: ModStep[] = [{ op: 'mul', value: 2 }, { op: 'add', value: 1 }];
    expect(sortedKeys(applyMods(uniformDistribution(6), mods))).toEqual([3, 5, 7, 9, 11, 13]);
  });

  it('runs a three-step chain first to last', () => {
    // 1d6 - 1 is 0..5, halved down is 0, 0, 1, 1, 2, 2, and x3 is 0, 3, 6.
    const mods: ModStep[] = [
      { op: 'sub', value: 1 },
      { op: 'div', value: 2 },
      { op: 'mul', value: 3 },
    ];
    expectDistribution(applyMods(uniformDistribution(6), mods), [
      [0, 1 / 3], [3, 1 / 3], [6, 1 / 3],
    ]);
  });

  it.each<[string, ModStep]>([
    ['a multiplier of 0', { op: 'mul', value: 0 }],
    ['a fractional multiplier', { op: 'mul', value: 1.5 }],
    ['a divisor of 0', { op: 'div', value: 0 }],
    ['a negative divisor', { op: 'div', value: -2 }],
  ])('empties the result for %s, even with steps after it', (_label, refused) => {
    const mods: ModStep[] = [{ op: 'add', value: 1 }, refused, { op: 'add', value: 2 }];
    expect(applyMods(uniformDistribution(6), mods).size).toBe(0);
  });
});

describe('modsWidth', () => {
  it('leaves the width alone for adds and subtracts', () => {
    expect(modsWidth(11, [{ op: 'add', value: 3 }, { op: 'sub', value: 40 }])).toBe(11);
  });

  it.each<[string, ModStep[] | undefined]>([
    ['no chain', undefined],
    ['an empty chain', []],
  ])('returns the width unchanged with %s', (_label, mods) => {
    expect(modsWidth(11, mods)).toBe(11);
  });

  it('ignores a multiplier or divisor of 1', () => {
    expect(modsWidth(11, [{ op: 'mul', value: 1 }, { op: 'div', value: 1 }])).toBe(11);
  });

  it('turns a width of W into (W - 1) x M + 1 for a multiply', () => {
    // 2d6 spans 2..12, 11 integers; x3 spans 6..36, which is 31.
    expect(modsWidth(11, [{ op: 'mul', value: 3 }])).toBe(31);
  });

  it('folds two multiplies in order', () => {
    // 20d100 spans 1981 integers: (1980 x 10 + 1) = 19801, then (19800 x 10 + 1).
    const mods: ModStep[] = [{ op: 'mul', value: 10 }, { op: 'mul', value: 10 }];
    expect(modsWidth(1981, mods)).toBe(198001);
  });

  it('narrows a width of W to ceil((W - 1) / D) + 1 for a divide', () => {
    // 100d100 spans 9901 integers: ceil(9900 / 10) + 1 = 991.
    expect(modsWidth(9901, [{ op: 'div', value: 10 }])).toBe(991);
  });

  it('is exactly the span a multiplied range covers, wherever the range starts', () => {
    const misses: string[] = [];
    for (let width = 1; width <= 12; width++) {
      for (let factor = 1; factor <= 7; factor++) {
        const mods: ModStep[] = [{ op: 'mul', value: factor }];
        for (let low = -10; low <= 10; low++) {
          const span = spanOf(applyMods(evenRange(low, width), mods));
          if (span !== modsWidth(width, mods)) misses.push(`${low}+${width} x${factor}`);
        }
      }
    }
    expect(misses).toEqual([]);
  });

  it('never counts fewer totals than a divided range actually lands on', () => {
    const over: string[] = [];
    for (let width = 1; width <= 40; width++) {
      for (let divisor = 1; divisor <= 9; divisor++) {
        const mods: ModStep[] = [{ op: 'div', value: divisor }];
        for (let low = -30; low <= 30; low++) {
          const landed = applyMods(evenRange(low, width), mods).size;
          if (landed > modsWidth(width, mods)) over.push(`${low}+${width} /${divisor}`);
        }
      }
    }
    expect(over).toEqual([]);
  });

  it('is reached by some divided range for every width and divisor', () => {
    const neverReached: string[] = [];
    for (let width = 1; width <= 40; width++) {
      for (let divisor = 1; divisor <= 9; divisor++) {
        const mods: ModStep[] = [{ op: 'div', value: divisor }];
        let reached = false;
        for (let low = -30; low <= 30 && !reached; low++) {
          reached = applyMods(evenRange(low, width), mods).size === modsWidth(width, mods);
        }
        if (!reached) neverReached.push(`${width} /${divisor}`);
      }
    }
    expect(neverReached).toEqual([]);
  });

  it.each<[string, ModStep[]]>([
    ['x3 then /2', [{ op: 'mul', value: 3 }, { op: 'div', value: 2 }]],
    ['/2 then x3', [{ op: 'div', value: 2 }, { op: 'mul', value: 3 }]],
    ['/2 then /3', [{ op: 'div', value: 2 }, { op: 'div', value: 3 }]],
    ['+5, /4, x2', [{ op: 'add', value: 5 }, { op: 'div', value: 4 }, { op: 'mul', value: 2 }]],
    ['x7 then /7', [{ op: 'mul', value: 7 }, { op: 'div', value: 7 }]],
  ])('never undercounts the span of the chain %s', (_label, mods) => {
    const over: string[] = [];
    for (let width = 1; width <= 30; width++) {
      for (let low = -20; low <= 20; low++) {
        const span = spanOf(applyMods(evenRange(low, width), mods));
        if (span > modsWidth(width, mods)) over.push(`${low}+${width}`);
      }
    }
    expect(over).toEqual([]);
  });

  it('returns a width of 0 unchanged, since there is nothing to spread', () => {
    expect(modsWidth(0, [{ op: 'mul', value: 5 }])).toBe(0);
  });
});
