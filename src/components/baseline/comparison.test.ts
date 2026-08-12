import { describe, expect, it } from 'vitest';
import { buildBaselineComparison } from './comparison';
import type { Expression, TargetState } from '../../types';

function sumExpr(
  id: string,
  parts: { count: number; sides: number }[],
  flatModifier = 0,
): Expression {
  return {
    id,
    name: `${id} name`,
    parts: parts.map((p, i) => ({ id: `${id}-p${i}`, ...p })),
    flatModifier,
    rollMode: 'normal',
    mode: 'sum',
  };
}

function poolExpr(
  id: string,
  count: number,
  sides: number,
  threshold: number,
): Expression {
  return {
    id,
    name: `${id} name`,
    parts: [{ id: `${id}-p0`, count, sides }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: threshold },
  };
}

const noTargets: TargetState = { values: [], ruling: 'gte' };
const targets: TargetState = { values: [7, 10], ruling: 'gte' };

// 2d6: mean 7, σ = √(35/6). 1d6+5: mean 8.5, σ = √(35/12). 1d20: mean 10.5,
// σ = √(399/12). 2d6 pool on 4+: per-die p = 0.5, mean 1 success.
const base2d6 = sumExpr('base', [{ count: 2, sides: 6 }]);
const row1d6p5 = sumExpr('a', [{ count: 1, sides: 6 }], 5);
const row1d20 = sumExpr('b', [{ count: 1, sides: 20 }]);
const pool2d6 = poolExpr('p', 2, 6, 4);

const allRows = [base2d6, row1d6p5, row1d20, pool2d6];

describe('buildBaselineComparison', () => {
  it('returns null when no baseline is pinned', () => {
    expect(buildBaselineComparison(allRows, null, targets, 2)).toBeNull();
  });

  it('returns null when the pinned id matches no expression', () => {
    expect(buildBaselineComparison(allRows, 'gone', targets, 2)).toBeNull();
  });

  it('carries the baseline identity and stats for a sum baseline', () => {
    const c = buildBaselineComparison(allRows, 'base', targets, 2);
    expect(c).not.toBeNull();
    expect(c!.id).toBe('base');
    expect(c!.name).toBe('base name');
    expect(c!.isPool).toBe(false);
    expect(c!.stats.mean).toBeCloseTo(7, 12);
    expect(c!.stats.stddev).toBeCloseTo(Math.sqrt(35 / 6), 12);
  });

  it('computes one hit per toolbar target for a sum baseline', () => {
    const c = buildBaselineComparison(allRows, 'base', targets, 2);
    expect(c!.hits).not.toBeNull();
    expect(c!.hits).toHaveLength(2);
    expect(c!.hits![0]).toBeCloseTo(21 / 36, 12);
    expect(c!.hits![1]).toBeCloseTo(6 / 36, 12);
  });

  it('computes a single pool-target hit for a pool baseline', () => {
    const c = buildBaselineComparison(allRows, 'p', targets, 2);
    expect(c!.isPool).toBe(true);
    expect(c!.hits).toHaveLength(1);
    expect(c!.hits![0]).toBeCloseTo(0.25, 12);
  });

  it('leaves hits null when no targets are set', () => {
    const c = buildBaselineComparison(allRows, 'base', noTargets, 2);
    expect(c!.hits).toBeNull();
    expect(c!.maxHitDelta).toBe(0);
  });

  it('shares one Hit % maximum across every comparing row, cross-scale included', () => {
    const c = buildBaselineComparison(allRows, 'base', targets, 2);
    // Candidates vs the 2d6 baseline: 1d6+5 gives 0.25 and 6/36; 1d20 gives
    // 0.55 − 6/36 (the largest); the pool row contributes |0.25 − 21/36|.
    expect(c!.maxHitDelta).toBeCloseTo(11 / 20 - 6 / 36, 12);
  });

  it('takes the column maxima over same-scale rows only, excluding pool rows from a sum baseline', () => {
    const c = buildBaselineComparison(allRows, 'base', noTargets, 2);
    // 1d20 delta 3.5 beats 1d6+5 delta 1.5; the pool row's delta of 6 would
    // dominate if it were wrongly included.
    expect(c!.maxMeanDelta).toBeCloseTo(3.5, 12);
    expect(c!.maxSigmaDelta).toBeCloseTo(
      Math.sqrt(399 / 12) - Math.sqrt(35 / 6),
      12,
    );
  });

  it('takes the column maxima over pool rows only for a pool baseline', () => {
    const pool3d6 = poolExpr('q', 3, 6, 4);
    const c = buildBaselineComparison(
      [pool2d6, pool3d6, base2d6],
      'p',
      noTargets,
      2,
    );
    // 3d6 pool mean 1.5 vs 1: delta 0.5. The 2d6 sum row's delta of 6 would
    // dominate if sum rows leaked into a pool baseline's maxima.
    expect(c!.maxMeanDelta).toBeCloseTo(0.5, 12);
  });

  it('excludes the baseline row itself from the maxima', () => {
    const c = buildBaselineComparison([base2d6, row1d6p5], 'base', noTargets, 2);
    expect(c!.maxMeanDelta).toBeCloseTo(1.5, 12);
  });
});
