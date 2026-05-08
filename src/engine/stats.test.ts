import { describe, expect, it } from 'vitest';
import { uniformDistribution } from './distribution';
import { partDistribution } from './parts';
import {
  ccdf,
  cdf,
  hitProbability,
  max,
  mean,
  min,
  mode,
  percentile,
  probAtLeast,
  probAtMost,
  probEqual,
  stddev,
  variance,
} from './stats';

describe('stats — 1d6', () => {
  const d6 = uniformDistribution(6);

  it('mean = 3.5', () => {
    expect(mean(d6)).toBeCloseTo(3.5, 12);
  });

  it('variance = 35/12, stddev ≈ 1.7078', () => {
    expect(variance(d6)).toBeCloseTo(35 / 12, 12);
    expect(stddev(d6)).toBeCloseTo(Math.sqrt(35 / 12), 10);
    expect(stddev(d6)).toBeCloseTo(1.7078, 3);
  });

  it('min = 1, max = 6', () => {
    expect(min(d6)).toBe(1);
    expect(max(d6)).toBe(6);
  });

  it('mode returns every face (tie)', () => {
    expect(mode(d6)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('cdf(3) = 0.5, ccdf(4) = 0.5', () => {
    expect(cdf(d6, 3)).toBeCloseTo(0.5, 12);
    expect(ccdf(d6, 4)).toBeCloseTo(0.5, 12);
  });

  it('probAtLeast / probAtMost / probEqual', () => {
    expect(probAtLeast(d6, 5)).toBeCloseTo(2 / 6, 12);
    expect(probAtMost(d6, 2)).toBeCloseTo(2 / 6, 12);
    expect(probEqual(d6, 4)).toBeCloseTo(1 / 6, 12);
    expect(probEqual(d6, 99)).toBe(0);
  });

  it('percentile boundaries', () => {
    expect(percentile(d6, 0)).toBe(1);
    expect(percentile(d6, 0.5)).toBe(3);
    expect(percentile(d6, 1)).toBe(6);
  });
});

describe('stats — 2d6 (skewed by sum)', () => {
  it('mode of 2d6 is 7', () => {
    const d = partDistribution({ id: 'p', count: 2, sides: 6 });
    expect(mode(d)).toEqual([7]);
    expect(mean(d)).toBeCloseTo(7, 12);
  });
});

describe('hitProbability — 1d6 (target inside range)', () => {
  const d6 = uniformDistribution(6);

  it('gte 4 = 3/6', () => {
    expect(hitProbability(d6, 4, 'gte')).toBeCloseTo(3 / 6, 12);
  });

  it('gt 4 = 2/6 (= P(>=5))', () => {
    expect(hitProbability(d6, 4, 'gt')).toBeCloseTo(2 / 6, 12);
  });

  it('lte 4 = 4/6', () => {
    expect(hitProbability(d6, 4, 'lte')).toBeCloseTo(4 / 6, 12);
  });

  it('lt 4 = 3/6 (= P(<=3))', () => {
    expect(hitProbability(d6, 4, 'lt')).toBeCloseTo(3 / 6, 12);
  });

  it('eq 4 = 1/6', () => {
    expect(hitProbability(d6, 4, 'eq')).toBeCloseTo(1 / 6, 12);
  });

  it('gte 1 = 1 (always succeeds at min)', () => {
    expect(hitProbability(d6, 1, 'gte')).toBeCloseTo(1, 12);
  });

  it('lte 6 = 1 (always succeeds at max)', () => {
    expect(hitProbability(d6, 6, 'lte')).toBeCloseTo(1, 12);
  });
});

describe('hitProbability — target outside dist range', () => {
  const d6 = uniformDistribution(6);

  it('gte above max = 0', () => {
    expect(hitProbability(d6, 7, 'gte')).toBe(0);
    expect(hitProbability(d6, 100, 'gte')).toBe(0);
  });

  it('gt at max = 0', () => {
    expect(hitProbability(d6, 6, 'gt')).toBe(0);
  });

  it('lte below min = 0', () => {
    expect(hitProbability(d6, 0, 'lte')).toBe(0);
    expect(hitProbability(d6, -5, 'lte')).toBe(0);
  });

  it('lt at min = 0', () => {
    expect(hitProbability(d6, 1, 'lt')).toBe(0);
  });

  it('eq outside range = 0', () => {
    expect(hitProbability(d6, 0, 'eq')).toBe(0);
    expect(hitProbability(d6, 7, 'eq')).toBe(0);
  });

  it('gte below min = 1 (covers entire dist)', () => {
    expect(hitProbability(d6, 1, 'gte')).toBeCloseTo(1, 12);
    expect(hitProbability(d6, -10, 'gte')).toBeCloseTo(1, 12);
  });

  it('lte above max = 1', () => {
    expect(hitProbability(d6, 6, 'lte')).toBeCloseTo(1, 12);
    expect(hitProbability(d6, 100, 'lte')).toBeCloseTo(1, 12);
  });
});

describe('hitProbability — empty / non-finite', () => {
  it('returns 0 for empty distribution', () => {
    const empty = new Map<number, number>();
    expect(hitProbability(empty, 5, 'gte')).toBe(0);
    expect(hitProbability(empty, 5, 'eq')).toBe(0);
  });

  it('returns 0 for non-finite target', () => {
    const d6 = uniformDistribution(6);
    expect(hitProbability(d6, NaN, 'gte')).toBe(0);
    expect(hitProbability(d6, Infinity, 'gte')).toBe(0);
  });
});

describe('stats — empty distribution', () => {
  const empty = new Map<number, number>();

  it('returns 0 / [] without throwing', () => {
    expect(mean(empty)).toBe(0);
    expect(variance(empty)).toBe(0);
    expect(stddev(empty)).toBe(0);
    expect(min(empty)).toBe(0);
    expect(max(empty)).toBe(0);
    expect(mode(empty)).toEqual([]);
    expect(cdf(empty, 3)).toBe(0);
    expect(ccdf(empty, 3)).toBe(0);
    expect(percentile(empty, 0.5)).toBe(0);
  });
});
