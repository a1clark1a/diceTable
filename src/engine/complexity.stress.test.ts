import { describe, expect, it } from 'vitest';
import type { DicePart, Distribution, Expression, KeepRule } from '../types';
import { COMPLEXITY_OVERFLOW, expressionTooComplex, keepAcrossComplexity } from './complexity';
import { totalMass } from './distribution';
import { expressionDistribution } from './expression';
import { keepAcrossDistribution } from './keepAcross';
import { partDistribution } from './parts';
import { sumPartsDistribution } from './roll';

let nextId = 0;
const mk = (count: number, sides: number, extra: Partial<DicePart> = {}): DicePart => ({
  id: `p${nextId++}`,
  count,
  sides,
  ...extra,
});

const keepExpr = (parts: DicePart[], keepAcross: KeepRule): Expression => ({
  id: 'e',
  name: 'r',
  parts,
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
  keepAcross,
});

interface Shape {
  label: string;
  parts: DicePart[];
  totalDice: number;
}

// 1..4 parts, up to 20 dice per part. The last shape's state count (21^4) sits
// past the overflow edge, so only its closed-form rules may compute.
const shapes: Shape[] = [
  { label: '20d6', parts: [mk(20, 6)], totalDice: 20 },
  { label: '10d6 + 10d8', parts: [mk(10, 6), mk(10, 8)], totalDice: 20 },
  { label: '3d6 + 3d8', parts: [mk(3, 6), mk(3, 8)], totalDice: 6 },
  { label: '2d4 + 2d6 + 2d8', parts: [mk(2, 4), mk(2, 6), mk(2, 8)], totalDice: 6 },
  {
    label: '1d4 + 1d6 + 1d8 + 1d10',
    parts: [mk(1, 4), mk(1, 6), mk(1, 8), mk(1, 10)],
    totalDice: 4,
  },
  {
    label: '20d6 x 4 parts',
    parts: [mk(20, 6), mk(20, 6), mk(20, 6), mk(20, 6)],
    totalDice: 80,
  },
];

const boundaryNs = (totalDice: number): number[] =>
  [...new Set([1, 2, totalDice - 1, totalDice, totalDice + 3])];

const KEEP_TYPES = ['highest', 'lowest'] as const;

function expectSameDistribution(
  actual: Distribution,
  expected: Distribution,
  label: string,
): void {
  const keys = [...new Set([...actual.keys(), ...expected.keys()])].sort((a, b) => a - b);
  expect(keys.length, `${label}: keys`).toBeGreaterThan(0);
  for (const k of keys) {
    expect(actual.get(k) ?? 0, `${label}: probability at ${k}`).toBeCloseTo(
      expected.get(k) ?? 0,
      12,
    );
  }
}

describe('keep-across guard and distribution agree at the boundaries', () => {
  it('every shape the guard allows computes a distribution with full mass', () => {
    let allowed = 0;
    for (const shape of shapes) {
      for (const n of boundaryNs(shape.totalDice)) {
        for (const type of KEEP_TYPES) {
          const expr = keepExpr(shape.parts, { type, n });
          if (expressionTooComplex(expr)) continue;
          allowed++;
          const label = `${shape.label} keep ${type} ${n}`;
          const dist = expressionDistribution(expr);
          expect(dist.size, `${label} size`).toBeGreaterThan(0);
          expect(totalMass(dist), `${label} mass`).toBeCloseTo(1, 12);
        }
      }
    }
    // The sweep must actually exercise the walk, not skip everything.
    expect(allowed).toBeGreaterThan(30);
  });

  it('every shape the guard refuses comes back as the empty distribution', () => {
    let refused = 0;
    for (const shape of shapes) {
      for (const n of boundaryNs(shape.totalDice)) {
        for (const type of KEEP_TYPES) {
          const expr = keepExpr(shape.parts, { type, n });
          if (!expressionTooComplex(expr)) continue;
          refused++;
          expect(
            expressionDistribution(expr).size,
            `${shape.label} keep ${type} ${n}`,
          ).toBe(0);
        }
      }
    }
    expect(refused).toBeGreaterThan(0);
  });
});

describe('keeping every die', () => {
  it('keep-all (or more) equals the plain sum of the same parts', () => {
    for (const shape of shapes) {
      const plain = sumPartsDistribution(shape.parts);
      for (const n of [shape.totalDice, shape.totalDice + 3]) {
        for (const type of KEEP_TYPES) {
          const kept = keepAcrossDistribution(shape.parts, { type, n });
          expectSameDistribution(kept, plain, `${shape.label} keep ${type} ${n}`);
        }
      }
    }
  });

  it('keep-all scores zero complexity no matter how many parts there are', () => {
    for (const shape of shapes) {
      for (const n of [shape.totalDice, shape.totalDice + 3]) {
        for (const type of KEEP_TYPES) {
          expect(
            keepAcrossComplexity(shape.parts, { type, n }),
            `${shape.label} keep ${type} ${n}`,
          ).toBe(0);
        }
      }
    }
  });

  it('the keep-all short-circuit wins over the state-count overflow check', () => {
    const parts = shapes[5]!.parts;
    expect(keepAcrossComplexity(parts, { type: 'highest', n: 79 })).toBe(
      COMPLEXITY_OVERFLOW,
    );
    expect(keepAcrossComplexity(parts, { type: 'highest', n: 80 })).toBe(0);
    expect(keepAcrossComplexity(parts, { type: 'lowest', n: 80 })).toBe(0);
    expect(keepAcrossComplexity(parts, { type: 'highest', n: 1 })).toBe(0);
  });
});

describe('level walk cross-check against the per-part keep rule', () => {
  // The per-part keep rule enumerates multinomial leaves; the keep-across walk
  // runs a threshold-level DP. On a single part they must agree exactly.
  it('keep highest 19 of 20d6 matches the per-part keep rule', () => {
    const walk = keepAcrossDistribution([mk(20, 6)], { type: 'highest', n: 19 });
    const perPart = partDistribution(mk(20, 6, { keep: { type: 'highest', n: 19 } }));
    expectSameDistribution(walk, perPart, '20d6 keep highest 19');
  });

  it('keep lowest 19 of 20d6 matches the per-part keep rule', () => {
    const walk = keepAcrossDistribution([mk(20, 6)], { type: 'lowest', n: 19 });
    const perPart = partDistribution(mk(20, 6, { keep: { type: 'lowest', n: 19 } }));
    expectSameDistribution(walk, perPart, '20d6 keep lowest 19');
  });
});
