import { describe, expect, it } from 'vitest';
import {
  convolve,
  convolveMany,
  emptyDistribution,
  normalise,
  shift,
  sortedKeys,
  totalMass,
  uniformDistribution,
} from './distribution';

describe('uniformDistribution', () => {
  it('builds a uniform 1..sides distribution', () => {
    const d = uniformDistribution(6);
    expect(d.size).toBe(6);
    for (let f = 1; f <= 6; f++) expect(d.get(f)).toBeCloseTo(1 / 6, 12);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  it('returns empty for invalid sides', () => {
    expect(uniformDistribution(0).size).toBe(0);
    expect(uniformDistribution(-3).size).toBe(0);
    expect(uniformDistribution(2.5).size).toBe(0);
  });
});

describe('normalise', () => {
  it('rescales mass to 1', () => {
    const d = new Map([[1, 2], [2, 6]]);
    const n = normalise(d);
    expect(n.get(1)).toBeCloseTo(0.25, 12);
    expect(n.get(2)).toBeCloseTo(0.75, 12);
  });

  it('returns empty for zero-mass input', () => {
    expect(normalise(emptyDistribution()).size).toBe(0);
  });
});

describe('shift', () => {
  it('translates keys by offset', () => {
    const d = uniformDistribution(6);
    const s = shift(d, 2);
    expect(sortedKeys(s)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(s.get(3)).toBeCloseTo(1 / 6, 12);
  });
});

describe('convolve', () => {
  it('produces 2d6 distribution with apex at 7 and mass 6/36', () => {
    const d6 = uniformDistribution(6);
    const two = convolve(d6, d6);
    expect(two.get(2)).toBeCloseTo(1 / 36, 12);
    expect(two.get(7)).toBeCloseTo(6 / 36, 12);
    expect(two.get(12)).toBeCloseTo(1 / 36, 12);
    expect(totalMass(two)).toBeCloseTo(1, 12);
  });

  it('returns empty when either operand is empty', () => {
    expect(convolve(emptyDistribution(), uniformDistribution(6)).size).toBe(0);
    expect(convolve(uniformDistribution(6), emptyDistribution()).size).toBe(0);
  });
});

describe('convolveMany', () => {
  it('matches repeated pairwise convolution', () => {
    const d6 = uniformDistribution(6);
    const triple = convolveMany([d6, d6, d6]);
    expect(triple.get(3)).toBeCloseTo(1 / 216, 12);
    expect(triple.get(18)).toBeCloseTo(1 / 216, 12);
    expect(totalMass(triple)).toBeCloseTo(1, 12);
  });

  it('returns empty for empty input', () => {
    expect(convolveMany([]).size).toBe(0);
  });
});
