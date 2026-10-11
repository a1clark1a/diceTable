import { describe, expect, it } from 'vitest';
import { validateExpression } from '../state/persistedSchema';
import type { DicePart, Distribution, Expression, ModStep, RollMode } from '../types';
import { sortedKeys, totalMass } from './distribution';
import { expressionDistribution } from './expression';
import { applyMods } from './mods';
import { mean } from './stats';

function expectDistribution(dist: Distribution, expected: Array<[number, number]>): void {
  const sorted = [...expected].sort((a, b) => a[0] - b[0]);
  expect(sortedKeys(dist)).toEqual(sorted.map(([k]) => k));
  for (const [k, p] of sorted) expect(dist.get(k)).toBeCloseTo(p, 12);
}

function expectSameDistribution(actual: Distribution, expected: Distribution): void {
  expect(sortedKeys(actual)).toEqual(sortedKeys(expected));
  for (const [k, p] of expected) expect(actual.get(k)).toBeCloseTo(p, 12);
}

const d6 = (count: number): DicePart => ({ id: `d6x${count}`, count, sides: 6 });

const sumRow = (overrides: Partial<Expression> = {}): Expression => ({
  id: 'sum',
  name: 'Sum row',
  parts: [d6(2)],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
  ...overrides,
});

// Each die counts a 5 or 6, a third of the time, so two dice count
// 0: (2/3)^2 = 4/9, 1: 2 x (1/3)(2/3) = 4/9, 2: (1/3)^2 = 1/9.
const poolRow = (overrides: Partial<Expression> = {}): Expression => ({
  id: 'pool',
  name: 'Pool row',
  parts: [d6(2)],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'pool',
  successThreshold: { direction: 'gte', value: 5 },
  ...overrides,
});

// 1d20 against 15 succeeds on 15..20, 6 in 20, and then deals 1d8; a miss deals 0.
const checkRow = (overrides: Partial<Expression> = {}): Expression => ({
  id: 'check',
  name: 'Check row',
  parts: [{ id: 'd20', count: 1, sides: 20 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'check',
  check: {
    threshold: { direction: 'gte', value: 15 },
    effect: { parts: [{ id: 'd8', count: 1, sides: 8 }], flatModifier: 0 },
    onSuccess: 'full',
    onFailure: 'none',
  },
  ...overrides,
});

/** Ways to roll each total of 2d6, from 2 up to 12, out of 36. */
const twoD6Ways = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];

/** 2d6 with every total S moved to `place(S)`, each keeping its chance. */
function twoD6At(place: (total: number) => number): Array<[number, number]> {
  return twoD6Ways.map((ways, i): [number, number] => [place(i + 2), ways / 36]);
}

/** The check row's d8 hit: each face 1..8 an equal share of `hitChance`. */
function d8Faces(hitChance: number): Array<[number, number]> {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((face): [number, number] => [face, hitChance / 8]);
}

const addThenDouble: ModStep[] = [{ op: 'add', value: 3 }, { op: 'mul', value: 2 }];
const doubleThenAdd: ModStep[] = [{ op: 'mul', value: 2 }, { op: 'add', value: 3 }];

function migrated(raw: Record<string, unknown>): Expression {
  const row = validateExpression(raw);
  if (row === null) throw new Error('the saved row was refused');
  return row;
}

describe('a sum row with a chain', () => {
  it('averages 20 for 2d6 with +3 then x2', () => {
    // (7 + 3) x 2.
    expect(mean(expressionDistribution(sumRow({ mods: addThenDouble })))).toBeCloseTo(20, 12);
  });

  it('averages 17 for 2d6 with x2 then +3', () => {
    // 7 x 2 + 3.
    expect(mean(expressionDistribution(sumRow({ mods: doubleThenAdd })))).toBeCloseTo(17, 12);
  });

  it('lands 2d6 with +3 then x2 on the even totals 10 to 30', () => {
    const dist = expressionDistribution(sumRow({ mods: addThenDouble }));
    expectDistribution(dist, twoD6At((total) => (total + 3) * 2));
  });

  it('lands 2d6 with x2 then +3 on the odd totals 7 to 27', () => {
    const dist = expressionDistribution(sumRow({ mods: doubleThenAdd }));
    expectDistribution(dist, twoD6At((total) => total * 2 + 3));
  });

  it('gives 2d6 with +3 then x2 a 1 in 36 chance of 10 and a 1 in 6 chance of 20', () => {
    const dist = expressionDistribution(sumRow({ mods: addThenDouble }));
    expect(dist.get(10)).toBeCloseTo(1 / 36, 12);
    expect(dist.get(20)).toBeCloseTo(6 / 36, 12);
  });

  it('gives 2d6 with x2 then +3 a 1 in 36 chance of 7 and a 1 in 6 chance of 17', () => {
    const dist = expressionDistribution(sumRow({ mods: doubleThenAdd }));
    expect(dist.get(7)).toBeCloseTo(1 / 36, 12);
    expect(dist.get(17)).toBeCloseTo(6 / 36, 12);
  });

  it('merges neighbouring totals when 1d6 is divided by 2', () => {
    // 1 -> 0, 2 and 3 -> 1, 4 and 5 -> 2, 6 -> 3.
    const row = sumRow({ parts: [d6(1)], mods: [{ op: 'div', value: 2 }] });
    expectDistribution(expressionDistribution(row), [
      [0, 1 / 6], [1, 2 / 6], [2, 2 / 6], [3, 1 / 6],
    ]);
  });

  it('rounds a negative total down when it divides, not toward zero', () => {
    // 1d6 - 4 is -3..2; halved down: -3 -> -2, -2 and -1 -> -1, 0 and 1 -> 0, 2 -> 1.
    const mods: ModStep[] = [{ op: 'sub', value: 4 }, { op: 'div', value: 2 }];
    const dist = expressionDistribution(sumRow({ parts: [d6(1)], mods }));
    expectDistribution(dist, [[-2, 1 / 6], [-1, 2 / 6], [0, 2 / 6], [1, 1 / 6]]);
  });

  it('averages 11.75 for 2d6 with +1, x3, /2', () => {
    // 3(S + 1) / 2 averages 12; it is odd, and loses half a point to the floor,
    // whenever S is even, which is half the time: 12 - 0.25.
    const mods: ModStep[] = [
      { op: 'add', value: 1 },
      { op: 'mul', value: 3 },
      { op: 'div', value: 2 },
    ];
    expect(mean(expressionDistribution(sumRow({ mods })))).toBeCloseTo(11.75, 12);
  });

  it.each<[string, ModStep[], RollMode]>([
    ['+3', [{ op: 'add', value: 3 }], 'normal'],
    ['-10, into negative totals', [{ op: 'sub', value: 10 }], 'normal'],
    ['x100', [{ op: 'mul', value: 100 }], 'normal'],
    ['/7, which merges totals', [{ op: 'div', value: 7 }], 'normal'],
    ['+3 then x2', addThenDouble, 'normal'],
    ['x2 then +3', doubleThenAdd, 'normal'],
    [
      '-9, /2, x3',
      [{ op: 'sub', value: 9 }, { op: 'div', value: 2 }, { op: 'mul', value: 3 }],
      'normal',
    ],
    ['/3 twice', [{ op: 'div', value: 3 }, { op: 'div', value: 3 }], 'normal'],
    ['x7 then /7', [{ op: 'mul', value: 7 }, { op: 'div', value: 7 }], 'normal'],
    ['x3 with advantage', [{ op: 'mul', value: 3 }], 'advantage'],
    [
      '-4, /3 with disadvantage',
      [{ op: 'sub', value: 4 }, { op: 'div', value: 3 }],
      'disadvantage',
    ],
  ])('keeps total mass at 1 for 3d6 with %s', (_label, mods, rollMode) => {
    const dist = expressionDistribution(sumRow({ parts: [d6(3)], mods, rollMode }));
    expect(totalMass(dist)).toBeCloseTo(1, 12);
  });
});

describe('a pool row with a chain', () => {
  it('clamps once after the chain, so losing 2 then gaining 1 takes a lone success to 0', () => {
    // Every face meets "1 or more", so the count is always 1: 1 - 2 + 1 = 0.
    // Clamping between the steps would hand the success back (-1 -> 0, then 1).
    const row = poolRow({
      parts: [d6(1)],
      successThreshold: { direction: 'gte', value: 1 },
      mods: [{ op: 'sub', value: 2 }, { op: 'add', value: 1 }],
    });
    expectDistribution(expressionDistribution(row), [[0, 1]]);
  });

  it('nets one fewer success, floored at 0, when two dice lose 2 then gain 1', () => {
    // Counts 0, 1, 2 become -1, 0, 1; the -1 joins 0: 4/9 + 4/9.
    const row = poolRow({ mods: [{ op: 'sub', value: 2 }, { op: 'add', value: 1 }] });
    expectDistribution(expressionDistribution(row), [[0, 8 / 9], [1, 1 / 9]]);
  });

  it('spreads the count when it doubles', () => {
    const row = poolRow({ mods: [{ op: 'mul', value: 2 }] });
    expectDistribution(expressionDistribution(row), [[0, 4 / 9], [2, 4 / 9], [4, 1 / 9]]);
  });

  it('rounds the count down when it halves', () => {
    // Three dice count 0: 8/27, 1: 12/27, 2: 6/27, 3: 1/27; halving puts 0 and 1
    // on 0 and 2 and 3 on 1.
    const row = poolRow({ parts: [d6(3)], mods: [{ op: 'div', value: 2 }] });
    expectDistribution(expressionDistribution(row), [[0, 20 / 27], [1, 7 / 27]]);
  });

  it.each<[string, ModStep[]]>([
    ['-1', [{ op: 'sub', value: 1 }]],
    ['-5, past every count', [{ op: 'sub', value: 5 }]],
    ['+2', [{ op: 'add', value: 2 }]],
    ['x3', [{ op: 'mul', value: 3 }]],
    ['/2', [{ op: 'div', value: 2 }]],
    ['-2 then +1', [{ op: 'sub', value: 2 }, { op: 'add', value: 1 }]],
    ['-1, x2, /3', [{ op: 'sub', value: 1 }, { op: 'mul', value: 2 }, { op: 'div', value: 3 }]],
  ])('keeps total mass at 1 for a pool with %s', (_label, mods) => {
    const dist = expressionDistribution(poolRow({ parts: [d6(4)], mods }));
    expect(totalMass(dist)).toBeCloseTo(1, 12);
  });
});

describe('advantage on a row with a chain', () => {
  it('equals the multiply chain applied to the advantaged roll', () => {
    const mods: ModStep[] = [{ op: 'mul', value: 3 }, { op: 'add', value: 1 }];
    const chainFirst = expressionDistribution(sumRow({ mods, rollMode: 'advantage' }));
    const advantaged = expressionDistribution(sumRow({ rollMode: 'advantage' }));
    expectSameDistribution(chainFirst, applyMods(advantaged, mods));
  });

  it('equals the divide chain applied to the advantaged roll', () => {
    const mods: ModStep[] = [{ op: 'add', value: 1 }, { op: 'div', value: 4 }];
    const chainFirst = expressionDistribution(sumRow({ mods, rollMode: 'advantage' }));
    const advantaged = expressionDistribution(sumRow({ rollMode: 'advantage' }));
    expectSameDistribution(chainFirst, applyMods(advantaged, mods));
  });

  it('equals the divide chain applied to the disadvantaged roll', () => {
    const mods: ModStep[] = [{ op: 'sub', value: 5 }, { op: 'div', value: 3 }];
    const chainFirst = expressionDistribution(sumRow({ mods, rollMode: 'disadvantage' }));
    const disadvantaged = expressionDistribution(sumRow({ rollMode: 'disadvantage' }));
    expectSameDistribution(chainFirst, applyMods(disadvantaged, mods));
  });

  it('halves 1d6 rolled with advantage to 0: 1/36, 1: 8/36, 2: 16/36, 3: 11/36', () => {
    // Advantage on 1d6 shows k with chance (2k - 1) / 36: 1/36, 3/36, 5/36,
    // 7/36, 9/36, 11/36. Halving merges 2 with 3 and 4 with 5.
    const row = sumRow({ parts: [d6(1)], mods: [{ op: 'div', value: 2 }], rollMode: 'advantage' });
    expectDistribution(expressionDistribution(row), [
      [0, 1 / 36], [1, 8 / 36], [2, 16 / 36], [3, 11 / 36],
    ]);
  });
});

describe('a row saved with a flat modifier before the chain', () => {
  const legacySum = {
    id: 'legacy-sum',
    name: '2d6 + 3',
    parts: [{ id: 'p', count: 2, sides: 6 }],
    flatModifier: 3,
    rollMode: 'normal',
    mode: 'sum',
  };

  const legacyPool = {
    id: 'legacy-pool',
    name: 'Two dice, one success off',
    parts: [{ id: 'p', count: 2, sides: 6 }],
    flatModifier: -1,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 5 },
  };

  it('keeps the numbers of a 2d6 + 3 sum row', () => {
    expectDistribution(expressionDistribution(migrated(legacySum)), twoD6At((total) => total + 3));
  });

  it('computes a 2d6 + 3 sum row exactly as a +3 step does', () => {
    expectSameDistribution(
      expressionDistribution(migrated(legacySum)),
      expressionDistribution(sumRow({ mods: [{ op: 'add', value: 3 }] })),
    );
  });

  it('keeps the numbers of a 1d6 - 2 row rolled with advantage', () => {
    // The old engine added the modifier before advantage: face k shows k - 2
    // with chance (2k - 1) / 36.
    const raw = {
      ...legacySum,
      parts: [{ id: 'p', count: 1, sides: 6 }],
      flatModifier: -2,
      rollMode: 'advantage',
    };
    expectDistribution(expressionDistribution(migrated(raw)), [
      [-1, 1 / 36], [0, 3 / 36], [1, 5 / 36], [2, 7 / 36], [3, 9 / 36], [4, 11 / 36],
    ]);
  });

  it('keeps the numbers of a pool row one success down, floored at 0', () => {
    // Counts 0, 1, 2 become -1, 0, 1; the old engine clamped the -1 onto 0.
    expectDistribution(expressionDistribution(migrated(legacyPool)), [[0, 8 / 9], [1, 1 / 9]]);
  });

  it('computes a pool row one success down exactly as a -1 step does', () => {
    expectSameDistribution(
      expressionDistribution(migrated(legacyPool)),
      expressionDistribution(poolRow({ mods: [{ op: 'sub', value: 1 }] })),
    );
  });
});

describe('what the engine reads from a row', () => {
  it('ignores flatModifier on a sum row, whose modifier lives in the chain', () => {
    const row = sumRow({ flatModifier: 5 });
    expectDistribution(expressionDistribution(row), twoD6At((total) => total));
  });

  it('ignores flatModifier on a pool row, whose modifier lives in the chain', () => {
    const dist = expressionDistribution(poolRow({ flatModifier: 2 }));
    expectDistribution(dist, [[0, 4 / 9], [1, 4 / 9], [2, 1 / 9]]);
  });

  it('ignores a chain left on a check row', () => {
    // A miss is 14 in 20; a hit, 6 in 20, spreads over the 8 faces of the d8.
    const row = checkRow({ mods: [{ op: 'mul', value: 10 }, { op: 'add', value: 3 }] });
    expectDistribution(expressionDistribution(row), [[0, 0.7], ...d8Faces(0.3)]);
  });

  it('reads flatModifier on a check row as the check roll\'s modifier, not the effect\'s', () => {
    // 1d20 + 5 meets 15 on a 10 or more, 11 in 20, and the hit still deals 1d8.
    const row = checkRow({ flatModifier: 5 });
    expectDistribution(expressionDistribution(row), [[0, 0.45], ...d8Faces(0.55)]);
  });
});
