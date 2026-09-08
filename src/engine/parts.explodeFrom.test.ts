import { describe, expect, it } from 'vitest';
import type { Distribution, ExplodeRule } from '../types';
import { emptyDistribution, sortedKeys, totalMass, uniformDistribution } from './distribution';
import { applyExplode, explodeFrom } from './parts';

const d6 = (): Distribution => uniformDistribution(6);

/** A d6 with the 6 stripped off: faces 1..5 at 1/6 each, mass 5/6. */
const d6WithoutSix = (): Distribution => {
  const dist = d6();
  dist.delete(6);
  return dist;
};

function expectSameDistribution(actual: Distribution, expected: Distribution): void {
  expect(sortedKeys(actual)).toEqual(sortedKeys(expected));
  for (const [k, p] of expected) {
    expect(actual.get(k), `probability at ${k}`).toBeCloseTo(p, 12);
  }
}

describe('explodeFrom: with first equal to continuation it is applyExplode', () => {
  const rules: ExplodeRule[] = [
    { onFaces: [6], depthCap: 1 },
    { onFaces: [6], depthCap: 2 },
    { onFaces: [5, 6], depthCap: 3 },
    { onFaces: [1], depthCap: 2 },
  ];

  for (const rule of rules) {
    it(`matches applyExplode on faces [${rule.onFaces.join(',')}] at cap ${rule.depthCap}`, () => {
      expectSameDistribution(explodeFrom(d6(), d6(), rule), applyExplode(d6(), rule));
    });
  }

  it('a d6 exploding on 6 at cap 2 chains exactly two levels deep', () => {
    const dist = explodeFrom(d6(), d6(), { onFaces: [6], depthCap: 2 });
    // The 6 chains into 6 + tail, where the tail is the cap-1 explosion of a d6:
    // 1..5 at 1/6 and 7..12 at 1/36. A 12 would need the second die to stop on
    // a 6, which still explodes with one level of depth left.
    expect(dist.get(1)).toBeCloseTo(1 / 6, 12);
    expect(dist.get(7)).toBeCloseTo(1 / 36, 12);
    expect(dist.get(13)).toBeCloseTo(1 / 216, 12);
    expect(dist.has(12)).toBe(false);
    expect(totalMass(dist)).toBeCloseTo(1, 12);
  });
});

describe('explodeFrom: the first draw', () => {
  it('hands back a copy of first, not the same Map, when the cap is 0', () => {
    const first = d6();
    const dist = explodeFrom(first, d6(), { onFaces: [6], depthCap: 0 });
    expect(dist).not.toBe(first);
    expect(dist.size).toBe(6);
    for (let f = 1; f <= 6; f++) expect(dist.get(f)).toBeCloseTo(1 / 6, 12);
    dist.set(99, 1);
    expect(first.has(99)).toBe(false);
  });

  it('returns a copy of first when first has no mass on any exploding face', () => {
    const first = new Map([[1, 0.5], [2, 0.5]]);
    const dist = explodeFrom(first, d6(), { onFaces: [6], depthCap: 3 });
    expect(dist).not.toBe(first);
    expect(sortedKeys(dist)).toEqual([1, 2]);
    expect(dist.get(1)).toBeCloseTo(0.5, 12);
    expect(dist.get(2)).toBeCloseTo(0.5, 12);
    expect(totalMass(dist)).toBeCloseTo(1, 12);
  });

  it('returns empty when first is empty', () => {
    const dist = explodeFrom(emptyDistribution(), d6(), { onFaces: [6], depthCap: 2 });
    expect(dist.size).toBe(0);
  });

  it('keeps the total mass of an unnormalised first', () => {
    const first = new Map([[1, 0.2], [6, 0.3]]);
    const dist = explodeFrom(first, d6(), { onFaces: [6], depthCap: 1 });
    // The 0.3 on the 6 spreads evenly over 7..12; the 0.2 on the 1 stays put.
    expect(dist.get(1)).toBeCloseTo(0.2, 12);
    for (let t = 7; t <= 12; t++) expect(dist.get(t)).toBeCloseTo(0.05, 12);
    expect(dist.has(6)).toBe(false);
    expect(totalMass(dist)).toBeCloseTo(0.5, 12);
  });
});

describe('explodeFrom: chain dice are full continuation draws', () => {
  it('chains through a face that first lacks', () => {
    const dist = explodeFrom(d6WithoutSix(), d6(), { onFaces: [5, 6], depthCap: 2 });
    // tail = applyExplode(d6, [5, 6], cap 1) = 1..4 at 1/6, 6 at 1/36, 7..11 at
    // 2/36, 12 at 1/36. Only the 5 in first explodes, into 5 + tail:
    // 6..9 at 1/36, 11 at 1/216, 12..16 at 2/216, 17 at 1/216. Reaching 17 means
    // the chain went 5 -> 6 -> 6 through a 6 that first cannot show.
    expect(dist.get(1)).toBeCloseTo(1 / 6, 12);
    expect(dist.get(17)).toBeCloseTo(1 / 216, 12);
    expect(dist.get(16)).toBeCloseTo(2 / 216, 12);
    expect(dist.get(11)).toBeCloseTo(1 / 216, 12);
    expect(dist.has(5)).toBe(false);
    expect(dist.has(10)).toBe(false);
    expect(totalMass(dist)).toBeCloseTo(5 / 6, 12);
  });

  it('ends every chain after one extra draw when the continuation cannot explode', () => {
    const dist = explodeFrom(d6(), new Map([[1, 0.5], [2, 0.5]]), { onFaces: [6], depthCap: 3 });
    for (let f = 1; f <= 5; f++) expect(dist.get(f)).toBeCloseTo(1 / 6, 12);
    expect(dist.get(7)).toBeCloseTo(1 / 12, 12);
    expect(dist.get(8)).toBeCloseTo(1 / 12, 12);
    expect(dist.has(6)).toBe(false);
    expect(Math.max(...dist.keys())).toBe(8);
    expect(totalMass(dist)).toBeCloseTo(1, 12);
  });

  it('returns empty when the continuation explodes on every face with depth to spare', () => {
    const always6 = new Map([[6, 1]]);
    const dist = explodeFrom(d6(), always6, { onFaces: [6], depthCap: 2 });
    expect(dist.size).toBe(0);
  });

  it('lets a single chain die stop on its exploding face when the cap is 1', () => {
    const always6 = new Map([[6, 1]]);
    const dist = explodeFrom(d6(), always6, { onFaces: [6], depthCap: 1 });
    for (let f = 1; f <= 5; f++) expect(dist.get(f)).toBeCloseTo(1 / 6, 12);
    expect(dist.get(12)).toBeCloseTo(1 / 6, 12);
    expect(dist.size).toBe(6);
    expect(totalMass(dist)).toBeCloseTo(1, 12);
  });
});

describe('explodeFrom: the cap counts the first draw as depth one', () => {
  it('at cap 1 the chain die may stop on an exploding face', () => {
    const dist = explodeFrom(d6WithoutSix(), d6(), { onFaces: [5], depthCap: 1 });
    // The tail is a plain d6, so the 5 chains into 6..11 at 1/36 each; a 10 is
    // a 5 followed by a 5 that the cap stops.
    for (let t = 6; t <= 11; t++) expect(dist.get(t)).toBeCloseTo(1 / 36, 12);
    expect(dist.has(5)).toBe(false);
    expect(totalMass(dist)).toBeCloseTo(5 / 6, 12);
  });

  it('at cap 2 the chain die keeps exploding, so no total is a stopped 5', () => {
    const dist = explodeFrom(d6WithoutSix(), d6(), { onFaces: [5], depthCap: 2 });
    // tail = applyExplode(d6, [5], cap 1) = 1..4 at 1/6, 6 at 7/36, 7..11 at
    // 1/36. The 5 chains into 6..9 at 1/36, 11 at 7/216, 12..16 at 1/216.
    for (let t = 6; t <= 9; t++) expect(dist.get(t)).toBeCloseTo(1 / 36, 12);
    expect(dist.has(10)).toBe(false);
    expect(dist.get(11)).toBeCloseTo(7 / 216, 12);
    expect(dist.get(15)).toBeCloseTo(1 / 216, 12);
    expect(totalMass(dist)).toBeCloseTo(5 / 6, 12);
  });
});

describe('explodeFrom: depth cap fallback', () => {
  for (const depthCap of [Number.NaN, -1]) {
    it(`falls back to a cap of 10 for a depthCap of ${depthCap}`, () => {
      const dist = explodeFrom(d6(), d6(), { onFaces: [6], depthCap });
      // Ten exploding sixes plus an eleventh die that stops on a 6.
      expect(Math.max(...dist.keys())).toBe(66);
      expect(dist.has(6)).toBe(false);
      expect(dist.get(66)).toBeCloseTo((1 / 6) ** 11, 12);
      expect(totalMass(dist)).toBeCloseTo(1, 12);
    });
  }
});
