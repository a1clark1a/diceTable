import { describe, expect, it } from 'vitest';
import { beatChance, winChances } from './compare';
import {
  emptyDistribution,
  shift,
  uniformDistribution,
} from './distribution';

describe('beatChance', () => {
  it('d6 vs d6 wins 15/36 and ties 6/36', () => {
    const { win, tie } = beatChance(
      uniformDistribution(6),
      uniformDistribution(6),
    );
    expect(win).toBeCloseTo(15 / 36, 12);
    expect(tie).toBeCloseTo(6 / 36, 12);
  });

  it('d20 vs d6 wins 33/40 and ties 1/20', () => {
    const { win, tie } = beatChance(
      uniformDistribution(20),
      uniformDistribution(6),
    );
    expect(win).toBeCloseTo(33 / 40, 12);
    expect(tie).toBeCloseTo(1 / 20, 12);
  });

  it('a roll shifted past the other side always wins and never ties', () => {
    const { win, tie } = beatChance(
      shift(uniformDistribution(6), 10),
      uniformDistribution(6),
    );
    expect(win).toBeCloseTo(1, 12);
    expect(tie).toBe(0);
  });

  it('win, reverse win, and tie cover every outcome', () => {
    const a = uniformDistribution(20);
    const b = uniformDistribution(6);
    const forward = beatChance(a, b);
    const reverse = beatChance(b, a);
    expect(forward.win + reverse.win + forward.tie).toBeCloseTo(1, 12);
    expect(forward.tie).toBeCloseTo(reverse.tie, 12);
  });

  it('returns zeros when either side has no distribution', () => {
    const d6 = uniformDistribution(6);
    expect(beatChance(emptyDistribution(), d6)).toEqual({ win: 0, tie: 0 });
    expect(beatChance(d6, emptyDistribution())).toEqual({ win: 0, tie: 0 });
  });
});

describe('winChances', () => {
  it('matches beatChance for a two-roll field', () => {
    const [low, high] = winChances([
      uniformDistribution(6),
      shift(uniformDistribution(6), 10),
    ]);
    expect(low?.win).toBe(0);
    expect(low?.tie).toBe(0);
    expect(high?.win).toBeCloseTo(1, 12);
    expect(high?.tie).toBeCloseTo(0, 12);
  });

  it('two identical d6s split wins and ties symmetrically, covering all outcomes', () => {
    const results = winChances([uniformDistribution(6), uniformDistribution(6)]);
    for (const r of results) {
      expect(r.win).toBeCloseTo(15 / 36, 12);
      expect(r.tie).toBeCloseTo(6 / 36, 12);
    }
    const [a, b] = results;
    expect((a?.win ?? 0) + (b?.win ?? 0) + (a?.tie ?? 0)).toBeCloseTo(1, 12);
  });

  it('three identical d6s each win 55/216 and tie for best 1/6', () => {
    const d6 = uniformDistribution(6);
    const results = winChances([d6, d6, d6]);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.win).toBeCloseTo(55 / 216, 12);
      expect(r.tie).toBeCloseTo(36 / 216, 12);
    }
  });

  it('a lone roll wins with certainty', () => {
    const [only] = winChances([uniformDistribution(6)]);
    expect(only?.win).toBeCloseTo(1, 12);
    expect(only?.tie).toBeCloseTo(0, 12);
  });

  it('an empty distribution anywhere in the field zeroes every result', () => {
    const results = winChances([uniformDistribution(6), emptyDistribution()]);
    expect(results).toEqual([
      { win: 0, tie: 0 },
      { win: 0, tie: 0 },
    ]);
  });

  it('never reports a negative tie share', () => {
    const results = winChances([
      uniformDistribution(20),
      uniformDistribution(6),
      shift(uniformDistribution(6), 3),
    ]);
    for (const r of results) {
      expect(r.tie).toBeGreaterThanOrEqual(0);
    }
  });
});
