import { describe, expect, it } from 'vitest';
import { buildSeriesEval, evalSeriesAt, type SeriesEval } from './seriesEval';
import { convolve, uniformDistribution } from '../../engine/distribution';
import type { Distribution } from '../../types';

interface Case {
  label: string;
  dist: Distribution;
}

const CASES: Case[] = [
  { label: 'a single certain value', dist: new Map([[5, 1]]) },
  {
    label: 'a negative-min spread',
    dist: new Map([
      [-3, 0.125],
      [-1, 0.25],
      [0, 0.5],
      [2, 0.125],
    ]),
  },
  {
    label: 'a gappy support',
    dist: new Map([
      [1, 0.25],
      [4, 0.25],
      [9, 0.5],
    ]),
  },
  { label: 'a flat d20', dist: uniformDistribution(20) },
  { label: 'a 2d6 bell', dist: convolve(uniformDistribution(6), uniformDistribution(6)) },
  {
    label: 'an all-negative support',
    dist: new Map([
      [-10, 0.5],
      [-7, 0.5],
    ]),
  },
];

function support(dist: Distribution): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const value of dist.keys()) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

function build(dist: Distribution): SeriesEval {
  const { min, max } = support(dist);
  return buildSeriesEval(dist, min, max);
}

function massAtMost(dist: Distribution, x: number): number {
  let sum = 0;
  for (const [value, p] of dist) if (value <= x) sum += p;
  return sum;
}

function massAtLeast(dist: Distribution, x: number): number {
  let sum = 0;
  for (const [value, p] of dist) if (value >= x) sum += p;
  return sum;
}

function massExactly(dist: Distribution, x: number): number {
  let sum = 0;
  for (const [value, p] of dist) if (value === x) sum += p;
  return sum;
}

describe.each(CASES)('evalSeriesAt over $label', ({ dist }) => {
  const s = build(dist);
  const xs: number[] = [];
  for (let x = s.min - 2; x <= s.max + 2; x += 1) xs.push(x);

  it('matches a brute-force cumulative sum at every point from below min to above max', () => {
    for (const x of xs) {
      expect(evalSeriesAt(s, x, 'cdf')).toBeCloseTo(massAtMost(dist, x), 12);
    }
  });

  it('matches a brute-force tail sum at every point from below min to above max', () => {
    for (const x of xs) {
      expect(evalSeriesAt(s, x, 'ccdf')).toBeCloseTo(massAtLeast(dist, x), 12);
    }
  });

  it('reads the pmf as exactly the mass at each point and zero elsewhere', () => {
    for (const x of xs) {
      expect(evalSeriesAt(s, x, 'pmf')).toBe(massExactly(dist, x));
    }
  });

  it('reads the target view with the same mass as the pmf at every point', () => {
    for (const x of xs) {
      expect(evalSeriesAt(s, x, 'target')).toBe(evalSeriesAt(s, x, 'pmf'));
    }
  });

  it('keeps the complement identity ccdf(x) = 1 - cdf(x - 1) across the whole range', () => {
    for (const x of xs) {
      expect(evalSeriesAt(s, x, 'ccdf')).toBeCloseTo(1 - evalSeriesAt(s, x - 1, 'cdf'), 12);
    }
  });

  it('pins the cdf to exactly 0 below min and exactly 1 from max upward', () => {
    expect(evalSeriesAt(s, s.min - 1, 'cdf')).toBe(0);
    expect(evalSeriesAt(s, s.min - 2, 'cdf')).toBe(0);
    expect(evalSeriesAt(s, s.max, 'cdf')).toBe(1);
    expect(evalSeriesAt(s, s.max + 2, 'cdf')).toBe(1);
  });

  it('pins the ccdf to exactly 1 up to min and exactly 0 above max', () => {
    expect(evalSeriesAt(s, s.min, 'ccdf')).toBe(1);
    expect(evalSeriesAt(s, s.min - 2, 'ccdf')).toBe(1);
    expect(evalSeriesAt(s, s.max + 1, 'ccdf')).toBe(0);
    expect(evalSeriesAt(s, s.max + 2, 'ccdf')).toBe(0);
  });
});
