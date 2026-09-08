import { describe, expect, it } from 'vitest';
import { buildSeriesEval, evalSeriesAt } from './seriesEval';
import type { Distribution } from '../../types';

function dist(entries: readonly (readonly [number, number])[]): Distribution {
  return new Map(entries);
}

// min 1, max 3, cdf [0.25, 0.5, 1]
const SIMPLE = buildSeriesEval(dist([[1, 0.25], [2, 0.25], [3, 0.5]]), 1, 3);

// A hole at 2 must read as zero mass, not a lookup failure.
const GAPPED = buildSeriesEval(dist([[1, 0.5], [3, 0.5]]), 1, 3);

describe('buildSeriesEval', () => {
  it('builds one dense cumulative bucket per integer in [min, max]', () => {
    expect(Array.from(SIMPLE.cdf)).toEqual([0.25, 0.5, 1]);
  });

  it('carries the running total across values with no mass', () => {
    expect(Array.from(GAPPED.cdf)).toEqual([0.5, 0.5, 1]);
  });
});

describe('evalSeriesAt', () => {
  it('reads the pmf directly and treats absent values as zero', () => {
    expect(evalSeriesAt(SIMPLE, 2, 'pmf')).toBeCloseTo(0.25, 12);
    expect(evalSeriesAt(SIMPLE, 0, 'pmf')).toBe(0);
    expect(evalSeriesAt(SIMPLE, 4, 'pmf')).toBe(0);
    expect(evalSeriesAt(GAPPED, 2, 'pmf')).toBe(0);
  });

  it('reads the target view with the same semantics as the pmf', () => {
    expect(evalSeriesAt(SIMPLE, 3, 'target')).toBeCloseTo(0.5, 12);
    expect(evalSeriesAt(SIMPLE, 0, 'target')).toBe(0);
  });

  it('clamps the cdf to 0 below min and 1 at and above max', () => {
    expect(evalSeriesAt(SIMPLE, 0, 'cdf')).toBe(0);
    expect(evalSeriesAt(SIMPLE, 1, 'cdf')).toBeCloseTo(0.25, 12);
    expect(evalSeriesAt(SIMPLE, 2, 'cdf')).toBeCloseTo(0.5, 12);
    expect(evalSeriesAt(SIMPLE, 3, 'cdf')).toBe(1);
    expect(evalSeriesAt(SIMPLE, 5, 'cdf')).toBe(1);
  });

  it('returns exactly 1 at max even when the running total drifted below 1', () => {
    const drifting = buildSeriesEval(dist([[1, 0.3], [2, 0.3], [3, 0.3999999]]), 1, 3);
    expect(evalSeriesAt(drifting, 3, 'cdf')).toBe(1);
  });

  it('clamps the ccdf to 1 at and below min and 0 above max', () => {
    expect(evalSeriesAt(SIMPLE, 0, 'ccdf')).toBe(1);
    expect(evalSeriesAt(SIMPLE, 1, 'ccdf')).toBe(1);
    expect(evalSeriesAt(SIMPLE, 2, 'ccdf')).toBeCloseTo(0.75, 12);
    expect(evalSeriesAt(SIMPLE, 3, 'ccdf')).toBeCloseTo(0.5, 12);
    expect(evalSeriesAt(SIMPLE, 4, 'ccdf')).toBe(0);
  });

  it('carries cumulative reads across a gap', () => {
    expect(evalSeriesAt(GAPPED, 2, 'cdf')).toBeCloseTo(0.5, 12);
    expect(evalSeriesAt(GAPPED, 3, 'ccdf')).toBeCloseTo(0.5, 12);
  });
});
