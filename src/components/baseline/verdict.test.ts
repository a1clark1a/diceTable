import { describe, expect, it } from 'vitest';
import { buildVerdict, type VerdictInput } from './verdict';

function sumVsSum(overrides: Partial<VerdictInput> = {}): VerdictInput {
  return {
    mean: 7,
    stddev: 2.4,
    isPool: false,
    firstHit: null,
    baseMean: 7,
    baseStddev: 2.4,
    baseIsPool: false,
    baseFirstHit: null,
    ...overrides,
  };
}

describe('buildVerdict same-scale', () => {
  it('reports a higher average with one decimal and capitalizes the sentence', () => {
    expect(buildVerdict(sumVsSum({ mean: 10.5 }))).toBe('Averages 3.5 higher');
  });

  it('reports a lower average', () => {
    expect(buildVerdict(sumVsSum({ mean: 5 }))).toBe('Averages 2.0 lower');
  });

  it('calls an average within 0.005 the same', () => {
    expect(buildVerdict(sumVsSum({ mean: 7.002 }))).toBe('Same average');
  });

  it('appends swingier when the spread is clearly wider', () => {
    expect(buildVerdict(sumVsSum({ mean: 10.5, stddev: 3.4 }))).toBe(
      'Averages 3.5 higher · swingier',
    );
  });

  it('appends steadier when the spread is clearly tighter', () => {
    expect(buildVerdict(sumVsSum({ mean: 10.5, stddev: 1.4 }))).toBe(
      'Averages 3.5 higher · steadier',
    );
  });

  it('stays silent about spread differences under 0.05', () => {
    expect(buildVerdict(sumVsSum({ mean: 10.5, stddev: 2.44 }))).toBe(
      'Averages 3.5 higher',
    );
  });

  it('appends the hit comparison when both sides have targets', () => {
    expect(
      buildVerdict(sumVsSum({ mean: 10.5, firstHit: 0.7, baseFirstHit: 0.24 })),
    ).toBe('Averages 3.5 higher · hits 46% more often');
  });

  it('reports hitting less often', () => {
    expect(
      buildVerdict(sumVsSum({ firstHit: 0.24, baseFirstHit: 0.7 })),
    ).toBe('Same average · hits 46% less often');
  });

  it('calls a hit gap under half a point about as often', () => {
    expect(
      buildVerdict(sumVsSum({ firstHit: 0.503, baseFirstHit: 0.5 })),
    ).toBe('Same average · hits about as often');
  });

  it('labels pool-vs-pool average deltas in successes', () => {
    expect(
      buildVerdict(
        sumVsSum({
          isPool: true,
          baseIsPool: true,
          mean: 3.2,
          baseMean: 2,
          stddev: 0.9,
          baseStddev: 0.9,
        }),
      ),
    ).toBe('Averages 1.2 successes higher');
  });
});

describe('buildVerdict cross-scale', () => {
  it('falls back to the hit comparison when targets exist', () => {
    expect(
      buildVerdict(
        sumVsSum({
          isPool: true,
          baseIsPool: false,
          firstHit: 0.8,
          baseFirstHit: 0.6,
        }),
      ),
    ).toBe('Different scale, but hits 20% more often');
  });

  it('uses the about-as-often phrasing for a negligible hit gap', () => {
    expect(
      buildVerdict(
        sumVsSum({
          isPool: true,
          baseIsPool: false,
          firstHit: 0.602,
          baseFirstHit: 0.6,
        }),
      ),
    ).toBe('Different scale, but hits about as often');
  });

  it('explains a pool row against a sum baseline when no targets are set', () => {
    expect(
      buildVerdict(sumVsSum({ isPool: true, baseIsPool: false })),
    ).toBe('Counts successes, so totals aren’t comparable to the baseline');
  });

  it('explains a sum row against a pool baseline when no targets are set', () => {
    expect(
      buildVerdict(sumVsSum({ isPool: false, baseIsPool: true })),
    ).toBe('The baseline counts successes, so totals aren’t comparable');
  });
});
