import { describe, expect, it } from 'vitest';
import type { DicePart, Distribution, Expression, KeepRule } from '../types';
import { totalMass } from './distribution';
import { expressionDistribution } from './expression';
import { keepAcrossDistribution } from './keepAcross';
import { partDistribution } from './parts';
import { mean, stddev } from './stats';

const part = (overrides: Partial<DicePart>): DicePart => ({
  id: 'p',
  count: 1,
  sides: 6,
  ...overrides,
});

const expr = (overrides: Partial<Expression>): Expression => ({
  id: 'e',
  name: 'r',
  parts: [part({})],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
  ...overrides,
});

const exploding = (sides: number, id: string): DicePart =>
  part({ id, count: 1, sides, explode: { onFaces: [sides], depthCap: 10 } });

// An independent enumeration of every die face, sorted and sliced. It shares no
// code with the level walk under test, so agreement between the two is evidence
// rather than a restatement.
function bruteForce(parts: DicePart[], rule: KeepRule): Distribution {
  const sides: number[] = [];
  for (const p of parts) for (let i = 0; i < p.count; i++) sides.push(p.sides);

  let outcomes = 1;
  for (const s of sides) outcomes *= s;

  const result = new Map<number, number>();
  const roll: number[] = new Array(sides.length).fill(1);

  const recurse = (i: number): void => {
    if (i === sides.length) {
      const sorted = [...roll].sort((a, b) => a - b);
      const kept =
        rule.type === 'highest'
          ? sorted.slice(Math.max(0, sorted.length - rule.n))
          : sorted.slice(0, rule.n);
      const sum = kept.reduce((a, b) => a + b, 0);
      result.set(sum, (result.get(sum) ?? 0) + 1 / outcomes);
      return;
    }
    const faces = sides[i] ?? 0;
    for (let f = 1; f <= faces; f++) {
      roll[i] = f;
      recurse(i + 1);
    }
  };

  recurse(0);
  return result;
}

function expectSameDistribution(actual: Distribution, expected: Distribution): void {
  const keys = [...new Set([...actual.keys(), ...expected.keys()])].sort((a, b) => a - b);
  for (const k of keys) {
    expect(actual.get(k) ?? 0, `probability at ${k}`).toBeCloseTo(expected.get(k) ?? 0, 12);
  }
}

describe('keepAcrossDistribution — agrees with brute-force enumeration', () => {
  const cases: { name: string; parts: DicePart[]; rule: KeepRule }[] = [
    {
      name: 'highest 1 of d8 + d6 (a trait die beside a wild die)',
      parts: [part({ id: 'a', sides: 8 }), part({ id: 'b', sides: 6 })],
      rule: { type: 'highest', n: 1 },
    },
    {
      name: 'lowest 1 of d8 + d6',
      parts: [part({ id: 'a', sides: 8 }), part({ id: 'b', sides: 6 })],
      rule: { type: 'lowest', n: 1 },
    },
    {
      name: 'highest 1 of 3d6 (several dice inside one part)',
      parts: [part({ count: 3, sides: 6 })],
      rule: { type: 'highest', n: 1 },
    },
    {
      name: 'lowest 1 of 3d6 (several dice inside one part)',
      parts: [part({ count: 3, sides: 6 })],
      rule: { type: 'lowest', n: 1 },
    },
    {
      name: 'highest 1 of d8 + 2d6 (mixed sizes, one part doubled up)',
      parts: [part({ id: 'a', sides: 8 }), part({ id: 'b', count: 2, sides: 6 })],
      rule: { type: 'highest', n: 1 },
    },
    {
      name: 'lowest 1 of d8 + 2d6 (mixed sizes, one part doubled up)',
      parts: [part({ id: 'a', sides: 8 }), part({ id: 'b', count: 2, sides: 6 })],
      rule: { type: 'lowest', n: 1 },
    },
    {
      name: 'highest 2 of 3d6',
      parts: [part({ count: 3, sides: 6 })],
      rule: { type: 'highest', n: 2 },
    },
    {
      name: 'lowest 2 of 3d6',
      parts: [part({ count: 3, sides: 6 })],
      rule: { type: 'lowest', n: 2 },
    },
    {
      name: 'highest 2 of d8 + 2d6',
      parts: [part({ id: 'a', sides: 8 }), part({ id: 'b', count: 2, sides: 6 })],
      rule: { type: 'highest', n: 2 },
    },
    {
      name: 'lowest 2 of d8 + 2d6',
      parts: [part({ id: 'a', sides: 8 }), part({ id: 'b', count: 2, sides: 6 })],
      rule: { type: 'lowest', n: 2 },
    },
    {
      name: 'highest 3 of d4 + d6 + 2d8',
      parts: [
        part({ id: 'a', sides: 4 }),
        part({ id: 'b', sides: 6 }),
        part({ id: 'c', count: 2, sides: 8 }),
      ],
      rule: { type: 'highest', n: 3 },
    },
    {
      name: 'highest 2 of d4 + d20 (widely mismatched faces)',
      parts: [part({ id: 'a', sides: 4 }), part({ id: 'b', sides: 20 })],
      rule: { type: 'highest', n: 2 },
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const d = keepAcrossDistribution(c.parts, c.rule);
      expectSameDistribution(d, bruteForce(c.parts, c.rule));
      expect(totalMass(d)).toBeCloseTo(1, 12);
    });
  }
});

describe('keepAcrossDistribution — n against the dice count', () => {
  it('keeping every die is the plain sum', () => {
    const parts = [part({ id: 'a', sides: 8 }), part({ id: 'b', count: 2, sides: 6 })];
    const d = keepAcrossDistribution(parts, { type: 'highest', n: 3 });
    expect(mean(d)).toBeCloseTo(4.5 + 3.5 + 3.5, 12);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  it('keeping more dice than were rolled keeps them all', () => {
    const parts = [part({ count: 3, sides: 6 })];
    const d = keepAcrossDistribution(parts, { type: 'highest', n: 5 });
    expectSameDistribution(d, partDistribution(part({ count: 3, sides: 6 })));
  });

  it('highest and lowest agree when every die is kept', () => {
    const parts = [part({ id: 'a', sides: 8 }), part({ id: 'b', sides: 6 })];
    const highest = keepAcrossDistribution(parts, { type: 'highest', n: 2 });
    const lowest = keepAcrossDistribution(parts, { type: 'lowest', n: 2 });
    expectSameDistribution(highest, lowest);
  });
});

describe('keepAcrossDistribution — matches the per-part keep rule', () => {
  it('highest 3 across one part equals 4d6kh3, mean 15869/1296', () => {
    const across = keepAcrossDistribution([part({ count: 4, sides: 6 })], {
      type: 'highest',
      n: 3,
    });
    const perPart = partDistribution(
      part({ count: 4, sides: 6, keep: { type: 'highest', n: 3 } }),
    );
    expectSameDistribution(across, perPart);
    expect(mean(across)).toBeCloseTo(15869 / 1296, 10);
  });

  it('lowest 1 across one part equals 2d6kl1', () => {
    const across = keepAcrossDistribution([part({ count: 2, sides: 6 })], {
      type: 'lowest',
      n: 1,
    });
    const perPart = partDistribution(
      part({ count: 2, sides: 6, keep: { type: 'lowest', n: 1 } }),
    );
    expectSameDistribution(across, perPart);
  });
});

describe('keepAcrossDistribution — per-die rules feed the keep', () => {
  it('reads exploding dice at their post-explosion faces', () => {
    const d = keepAcrossDistribution([exploding(8, 'a'), exploding(6, 'b')], {
      type: 'highest',
      n: 1,
    });
    expect(mean(d)).toBeCloseTo(6.4786, 4);
    expect(stddev(d)).toBeCloseTo(3.9577, 4);
    expect(totalMass(d)).toBeCloseTo(1, 10);
  });

  it('reads rerolled dice at their post-reroll odds', () => {
    const rerolled = (id: string): DicePart =>
      part({ id, sides: 6, reroll: { values: [1], mode: 'once' } });
    const d = keepAcrossDistribution([rerolled('a'), rerolled('b')], {
      type: 'highest',
      n: 1,
    });
    // Each die is 1 with probability 1/36 and any other face with 7/36, so the
    // highest of two is 1 only when both are, and 6 unless both land under it.
    expect(d.get(1)).toBeCloseTo(1 / 1296, 12);
    expect(d.get(6)).toBeCloseTo(1 - (29 / 36) ** 2, 12);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });
});

describe('keepAcrossDistribution — invalid input yields an empty distribution', () => {
  const parts = [part({ id: 'a', sides: 8 }), part({ id: 'b', sides: 6 })];

  it('no parts', () => {
    expect(keepAcrossDistribution([], { type: 'highest', n: 1 }).size).toBe(0);
  });

  it('n of zero', () => {
    expect(keepAcrossDistribution(parts, { type: 'highest', n: 0 }).size).toBe(0);
  });

  it('negative n', () => {
    expect(keepAcrossDistribution(parts, { type: 'highest', n: -2 }).size).toBe(0);
  });

  it('fractional n', () => {
    expect(keepAcrossDistribution(parts, { type: 'highest', n: 1.5 }).size).toBe(0);
  });

  it('a part with no dice', () => {
    expect(
      keepAcrossDistribution([part({ count: 0, sides: 6 })], { type: 'highest', n: 1 })
        .size,
    ).toBe(0);
  });

  it('a part with fewer than two sides', () => {
    expect(
      keepAcrossDistribution([part({ sides: 1 })], { type: 'highest', n: 1 }).size,
    ).toBe(0);
  });

  it('a part whose every face is rerolled away', () => {
    const impossible = part({
      sides: 6,
      reroll: { values: [1, 2, 3, 4, 5, 6], mode: 'always' },
    });
    expect(
      keepAcrossDistribution([impossible, part({ id: 'b' })], { type: 'highest', n: 1 })
        .size,
    ).toBe(0);
  });
});

describe('expressionDistribution — keepAcross in a whole roll', () => {
  it('applies the flat modifier after keeping', () => {
    const parts = [exploding(8, 'a'), exploding(6, 'b')];
    const plain = expressionDistribution(
      expr({ parts, keepAcross: { type: 'highest', n: 1 } }),
    );
    const shifted = expressionDistribution(
      expr({ parts, keepAcross: { type: 'highest', n: 1 }, flatModifier: 2 }),
    );
    expect(mean(shifted)).toBeCloseTo(mean(plain) + 2, 10);
    expect(stddev(shifted)).toBeCloseTo(stddev(plain), 10);
  });

  it('applies advantage to the kept result, not to each die', () => {
    const twoD6 = [part({ id: 'a', sides: 6 }), part({ id: 'b', sides: 6 })];
    const advantaged = expressionDistribution(
      expr({ parts: twoD6, keepAcross: { type: 'highest', n: 1 }, rollMode: 'advantage' }),
    );
    // Rolling "best of two d6" twice and keeping the better is the best of four
    // d6, so it has to land on 6797/1296 exactly.
    expectSameDistribution(
      advantaged,
      partDistribution(part({ count: 4, sides: 6, keep: { type: 'highest', n: 1 } })),
    );
    expect(mean(advantaged)).toBeCloseTo(6797 / 1296, 10);
  });

  it('leaves a roll without the rule untouched', () => {
    const parts = [part({ id: 'a', count: 2, sides: 6 })];
    expectSameDistribution(
      expressionDistribution(expr({ parts })),
      partDistribution(part({ count: 2, sides: 6 })),
    );
  });

  it('returns empty rather than hanging on a runaway keep', () => {
    const parts = [
      part({ id: 'a', count: 20, sides: 6 }),
      part({ id: 'b', count: 20, sides: 8 }),
      part({ id: 'c', count: 20, sides: 10 }),
    ];
    const t0 = performance.now();
    const d = expressionDistribution(expr({ parts, keepAcross: { type: 'highest', n: 3 } }));
    const elapsed = performance.now() - t0;
    expect(d.size).toBe(0);
    expect(elapsed).toBeLessThan(50);
  });
});
