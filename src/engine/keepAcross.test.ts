import { describe, expect, it } from 'vitest';
import type { DicePart, Distribution, Expression, KeepRule } from '../types';
import { totalMass, uniformDistribution } from './distribution';
import { expressionDistribution } from './expression';
import { keepAcrossDistribution } from './keepAcross';
import { partDistribution, singleDieDistribution } from './parts';
import { mean, stddev } from './stats';
import { referenceKeep } from '../test/referenceKeep';

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

describe('keepAcrossDistribution: agrees with brute-force enumeration', () => {
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

describe('keepAcrossDistribution: n against the dice count', () => {
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

// A per-part keep rule runs this same walk, so asserting the two against each
// other would only assert that one function equals itself. The oracle is the
// enumeration the engine used to run, which shares no code and no idea with it.
describe('keepAcrossDistribution: matches an independent enumeration', () => {
  it('highest 3 across one part equals 4d6kh3, mean 15869/1296', () => {
    const across = keepAcrossDistribution([part({ count: 4, sides: 6 })], {
      type: 'highest',
      n: 3,
    });
    const reference = referenceKeep(uniformDistribution(6), 4, {
      type: 'highest',
      n: 3,
    });
    expectSameDistribution(across, reference);
    expect(mean(across)).toBeCloseTo(15869 / 1296, 10);
  });

  it('lowest 1 across one part equals 2d6kl1', () => {
    const across = keepAcrossDistribution([part({ count: 2, sides: 6 })], {
      type: 'lowest',
      n: 1,
    });
    const reference = referenceKeep(uniformDistribution(6), 2, { type: 'lowest', n: 1 });
    expectSameDistribution(across, reference);
  });

  // The whole subject of the change that moved per-part keep onto this walk: a
  // die whose faces come from a chain, which the enumeration prices by distinct
  // face and the walk prices by threshold.
  it('agrees with the enumeration on dice whose faces come from a chain', () => {
    const exploding = part({
      count: 4,
      sides: 6,
      explode: { onFaces: [6], depthCap: 2 },
    });
    const single = singleDieDistribution(exploding);
    for (const type of ['highest', 'lowest'] as const) {
      for (let n = 1; n <= 4; n++) {
        expectSameDistribution(
          partDistribution({ ...exploding, keep: { type, n } }),
          referenceKeep(single, 4, { type, n }),
        );
      }
    }
  });
});

describe('keepAcrossDistribution: per-die rules feed the keep', () => {
  it('reads exploding dice at their post-explosion faces', () => {
    const d = keepAcrossDistribution([exploding(8, 'a'), exploding(6, 'b')], {
      type: 'highest',
      n: 1,
    });
    // An exploding die never stops on its top face, so P(d8 <= 8) is 7/8 and
    // P(d6 <= 8) is 5/6 + 2/36 (a 6 chained into a 1 or a 2). Then
    // P(max <= 6) = 6/8 * 5/6 = 180/288, P(max <= 7) = 7/8 * 31/36 = 217/288
    // and P(max <= 8) = 7/8 * 32/36 = 224/288. Ten chained eights plus a final
    // stopped 8 put the top key at 88, past anything a plain d8 could show.
    expect(d.get(1)).toBeCloseTo(1 / 48, 12);
    expect(d.get(6)).toBeCloseTo(5 / 48, 12);
    expect(d.get(7)).toBeCloseTo(37 / 288, 12);
    expect(d.get(8)).toBeCloseTo(7 / 288, 12);
    expect(Math.max(...d.keys())).toBe(88);
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

  // A die that always rerolls its 1 is uniform on 2..6 at 1/5, so the face set
  // starts above 1 and the keep has to read a zero at face 1.
  const noOnes = (id: string): DicePart =>
    part({ id, sides: 6, reroll: { values: [1], mode: 'always' } });

  it('keeps the highest of two dice whose 1 was rerolled away', () => {
    const d = keepAcrossDistribution([noOnes('a'), noOnes('b')], {
      type: 'highest',
      n: 1,
    });
    // P(max = v) = ((v-1)^2 - (v-2)^2) / 25 = (2v - 3) / 25 for v in 2..6.
    expect(d.has(1)).toBe(false);
    expect(d.get(2)).toBeCloseTo(1 / 25, 12);
    expect(d.get(3)).toBeCloseTo(3 / 25, 12);
    expect(d.get(4)).toBeCloseTo(5 / 25, 12);
    expect(d.get(5)).toBeCloseTo(7 / 25, 12);
    expect(d.get(6)).toBeCloseTo(9 / 25, 12);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  it('keeps the lowest of two dice whose 1 was rerolled away', () => {
    const d = keepAcrossDistribution([noOnes('a'), noOnes('b')], {
      type: 'lowest',
      n: 1,
    });
    // P(min = v) = ((7-v)^2 - (6-v)^2) / 25 = (13 - 2v) / 25 for v in 2..6.
    expect(d.has(1)).toBe(false);
    expect(d.get(2)).toBeCloseTo(9 / 25, 12);
    expect(d.get(3)).toBeCloseTo(7 / 25, 12);
    expect(d.get(4)).toBeCloseTo(5 / 25, 12);
    expect(d.get(5)).toBeCloseTo(3 / 25, 12);
    expect(d.get(6)).toBeCloseTo(1 / 25, 12);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  // Three d4s that always reroll a 3 are each uniform on {1, 2, 4} at 1/3, so a
  // zero-probability face sits between two live ones and the 27 equally likely
  // triples can be listed by hand.
  const gapped = (): DicePart =>
    part({ count: 3, sides: 4, reroll: { values: [3], mode: 'always' } });

  it('sums the top two dice across a face set with a gap in the middle', () => {
    const d = keepAcrossDistribution([gapped()], { type: 'highest', n: 2 });
    // Top-two sums over the 27 triples: 2 from (1,1,1); 3 from (1,1,2) x3;
    // 4 from (1,2,2) x3 and (2,2,2); 5 from (1,1,4) x3; 6 from (1,2,4) x6 and
    // (2,2,4) x3; 8 from (1,4,4) x3, (2,4,4) x3 and (4,4,4).
    expect(d.get(2)).toBeCloseTo(1 / 27, 12);
    expect(d.get(3)).toBeCloseTo(3 / 27, 12);
    expect(d.get(4)).toBeCloseTo(4 / 27, 12);
    expect(d.get(5)).toBeCloseTo(3 / 27, 12);
    expect(d.get(6)).toBeCloseTo(9 / 27, 12);
    expect(d.get(8)).toBeCloseTo(7 / 27, 12);
    expect(d.has(7)).toBe(false);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  it('sums the bottom two dice across a face set with a gap in the middle', () => {
    const d = keepAcrossDistribution([gapped()], { type: 'lowest', n: 2 });
    // Bottom-two sums over the 27 triples: 2 from (1,1,x) x7; 3 from (1,2,2) x3
    // and (1,2,4) x6; 4 from (2,2,2) and (2,2,4) x3; 5 from (1,4,4) x3; 6 from
    // (2,4,4) x3; 8 from (4,4,4).
    expect(d.get(2)).toBeCloseTo(7 / 27, 12);
    expect(d.get(3)).toBeCloseTo(9 / 27, 12);
    expect(d.get(4)).toBeCloseTo(4 / 27, 12);
    expect(d.get(5)).toBeCloseTo(3 / 27, 12);
    expect(d.get(6)).toBeCloseTo(3 / 27, 12);
    expect(d.get(8)).toBeCloseTo(1 / 27, 12);
    expect(d.has(7)).toBe(false);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });
});

describe('keepAcrossDistribution: invalid input yields an empty distribution', () => {
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

describe('expressionDistribution: keepAcross in a whole roll', () => {
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
    // 60 dice across three parts is far past the complexity guard. If the guard
    // ever stopped catching it the walk itself would blow the test timeout, so
    // the empty result is the only assertion needed.
    const d = expressionDistribution(expr({ parts, keepAcross: { type: 'highest', n: 3 } }));
    expect(d.size).toBe(0);
  });
});
