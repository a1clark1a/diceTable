import { describe, expect, it } from 'vitest';
import { uniformDistribution } from '../../engine/distribution';
import { computeRowStats } from '../../state/rowStats';
import type { RowStats } from '../../state/rowStats';
import { buildRowCompare, type RowCompareInput } from './rowCompare';
import type { BaselineComparison } from './comparison';

function statsFor(sides: number): RowStats {
  return computeRowStats(uniformDistribution(sides));
}

function baseline(overrides: Partial<BaselineComparison> = {}): BaselineComparison {
  return {
    id: 'base',
    name: 'Sum row',
    isPool: false,
    stats: statsFor(6),
    hits: null,
    ...overrides,
  };
}

function input(overrides: Partial<RowCompareInput> = {}): RowCompareInput {
  return {
    stats: statsFor(8),
    isPool: false,
    sameScale: true,
    hasHitValue: false,
    firstHit: null,
    comparison: baseline(),
    target: { values: [], ruling: 'gte' },
    poolTargets: [1],
    ...overrides,
  };
}

describe('buildRowCompare same scale', () => {
  it('lists average and spread against the baseline', () => {
    const compare = buildRowCompare(input());
    expect(compare.rows.map((r) => r.label)).toEqual(['Average', 'Spread']);
    const [avg] = compare.rows;
    expect(avg?.value).toBe('4.50');
    expect(avg?.base).toBe('3.50');
    expect(avg?.delta).toBe('+1.00');
    expect(avg?.tone).toBe('good');
  });

  it('leaves spread neutral, because neither direction is better', () => {
    const spread = buildRowCompare(input()).rows[1];
    expect(spread?.label).toBe('Spread');
    expect(spread?.neutral).toBe(true);
  });

  it('names the hit row after the ruling and the first target', () => {
    const compare = buildRowCompare(
      input({
        firstHit: 0.5,
        hasHitValue: true,
        target: { values: [4], ruling: 'gte' },
        comparison: baseline({ hits: [0.5] }),
      }),
    );
    expect(compare.rows[2]?.label).toBe('Hit 4 or more');
  });

  it('names a pool row’s hit row after the pool target', () => {
    const compare = buildRowCompare(
      input({
        isPool: true,
        firstHit: 0.5,
        hasHitValue: true,
        poolTargets: [3],
        comparison: baseline({ isPool: true, hits: [0.25] }),
      }),
    );
    expect(compare.rows[2]?.label).toBe('Hit 3+ successes');
    expect(compare.rows[2]?.delta).toBe('+25.0%');
  });

  it('omits the hit row when the row has no target to answer', () => {
    expect(buildRowCompare(input()).rows).toHaveLength(2);
  });

  it('speaks the verdict with commas so the clauses are not run together', () => {
    const compare = buildRowCompare(input());
    expect(compare.verdict).toContain(' · ');
    expect(compare.speech).not.toContain(' · ');
    expect(compare.speech).toBe(compare.verdict.split(' · ').join(', '));
  });
});

describe('buildRowCompare across scales', () => {
  it('drops average and spread, which measure different things', () => {
    const compare = buildRowCompare(
      input({ isPool: true, sameScale: false, comparison: baseline() }),
    );
    expect(compare.crossScale).toBe(true);
    expect(compare.rows.map((r) => r.label)).not.toContain('Average');
    expect(compare.rows.map((r) => r.label)).not.toContain('Spread');
  });

  it('labels the hit row plainly, because the two numbers answer different questions', () => {
    const compare = buildRowCompare(
      input({
        isPool: true,
        sameScale: false,
        hasHitValue: true,
        firstHit: 0.4,
        target: { values: [10], ruling: 'gte' },
        comparison: baseline({ hits: [0.6] }),
      }),
    );
    expect(compare.rows).toHaveLength(1);
    expect(compare.rows[0]?.label).toBe('Hit chance');
    expect(compare.rows[0]?.tone).toBe('bad');
  });

  it('points a row with a hit value at Hit % and one without at the plain reason', () => {
    expect(
      buildRowCompare(input({ sameScale: false, hasHitValue: true })).crossScaleTip,
    ).toBe('differentScaleHit');
    expect(
      buildRowCompare(input({ sameScale: false, hasHitValue: false })).crossScaleTip,
    ).toBe('differentScale');
  });
});
