import { describe, expect, it } from 'vitest';
import { uniformDistribution } from './distribution';
import { partDistribution } from './parts';
import {
  ccdf,
  cdf,
  hitProbability,
  max,
  mean,
  middleRange,
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

describe('middleRange', () => {
  // Running totals over 36: 3 reaches 3, 4 reaches 6 (past 10%); 9 reaches 30,
  // 10 reaches 33 (past 90%).
  it('spans 4 to 10 on 2d6 for the middle 80%', () => {
    const d = partDistribution({ id: 'p', count: 2, sides: 6 });
    expect(middleRange(d, 0.8)).toEqual([4, 10]);
  });

  // Each face is 5%. The running total at 2 is exactly 10%, which is all the
  // band may leave below it, so 2 stays outside, as 19 and 20 do above.
  it('spans 3 to 18 on 1d20, leaving 10% out on each side', () => {
    expect(middleRange(uniformDistribution(20), 0.8)).toEqual([3, 18]);
  });

  it('sits symmetrically on a symmetric roll', () => {
    expect(middleRange(uniformDistribution(10), 0.8)).toEqual([2, 9]);
    const d = partDistribution({ id: 'p', count: 2, sides: 10 });
    expect(middleRange(d, 0.8)).toEqual([6, 16]);
  });

  it('covers 30 of 36 results on 2d6, at least the share asked for', () => {
    const d = partDistribution({ id: 'p', count: 2, sides: 6 });
    const [lo, hi] = middleRange(d, 0.8);
    let covered = 0;
    for (const [k, p] of d) if (k >= lo && k <= hi) covered += p;
    expect(covered).toBeCloseTo(30 / 36, 12);
  });

  it('spans every result when asked for all of them', () => {
    expect(middleRange(uniformDistribution(6), 1)).toEqual([1, 6]);
  });

  it('narrows to the two middle faces of an even die when asked for none', () => {
    expect(middleRange(uniformDistribution(6), 0)).toEqual([3, 4]);
  });

  it('narrows to the median of an odd one', () => {
    expect(middleRange(uniformDistribution(5), 0)).toEqual([3, 3]);
  });

  it('clamps a share outside 0 to 1', () => {
    expect(middleRange(uniformDistribution(6), 2)).toEqual([1, 6]);
    expect(middleRange(uniformDistribution(6), -1)).toEqual([3, 4]);
  });

  it('returns [0, 0] for an empty distribution', () => {
    expect(middleRange(new Map<number, number>(), 0.8)).toEqual([0, 0]);
  });

  it('returns the one value on both ends for a single-value distribution', () => {
    expect(middleRange(new Map([[7, 1]]), 0.8)).toEqual([7, 7]);
  });
});
