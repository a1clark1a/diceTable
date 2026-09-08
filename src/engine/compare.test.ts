import { describe, expect, it } from 'vitest';
import { beatChance, beatMatrix, winChances } from './compare';
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

describe('beatMatrix', () => {
  const d6 = uniformDistribution(6);
  const d6plus3 = shift(uniformDistribution(6), 3);
  const d20 = uniformDistribution(20);
  const field = [d6, d6plus3, d20];

  it('gives every off-diagonal cell the odds of that one-on-one pair', () => {
    const matrix = beatMatrix(field);
    field.forEach((a, i) => {
      field.forEach((b, j) => {
        if (i === j) return;
        const pair = beatChance(a, b);
        expect(matrix[i]?.[j]?.win).toBeCloseTo(pair.win, 12);
        expect(matrix[i]?.[j]?.tie).toBeCloseTo(pair.tie, 12);
      });
    });
  });

  it('d6 against d6 + 3 wins 1/12 and ties 1/12', () => {
    // The higher roll covers 4..9, so the d6 only takes it with a 5 (over a 4)
    // or a 6 (over a 4 or a 5): 3 of the 36 pairs. They meet on 4, 5 and 6, so
    // another 3 tie.
    const matrix = beatMatrix([d6, d6plus3]);
    expect(matrix[0]?.[1]?.win).toBeCloseTo(1 / 12, 12);
    expect(matrix[0]?.[1]?.tie).toBeCloseTo(1 / 12, 12);
  });

  it('reads the same pair the other way round for the remaining 5/6', () => {
    const matrix = beatMatrix([d6, d6plus3]);
    expect(matrix[1]?.[0]?.win).toBeCloseTo(5 / 6, 12);
    expect(matrix[1]?.[0]?.tie).toBeCloseTo(1 / 12, 12);
  });

  it('leaves the diagonal empty because a roll has no odds against itself', () => {
    const matrix = beatMatrix(field);
    field.forEach((_, i) => {
      expect(matrix[i]?.[i]).toBeNull();
    });
  });

  it('gives a field of three rolls a three by three grid', () => {
    const matrix = beatMatrix(field);
    expect(matrix).toHaveLength(3);
    for (const row of matrix) expect(row).toHaveLength(3);
  });

  it('returns no rows at all for an empty field', () => {
    expect(beatMatrix([])).toEqual([]);
  });

  it('gives a lone roll nothing but its own empty diagonal', () => {
    expect(beatMatrix([d6])).toEqual([[null]]);
  });

  it('scores a roll with no distribution at zero rather than dropping it', () => {
    const matrix = beatMatrix([d6, emptyDistribution()]);
    expect(matrix[0]?.[1]).toEqual({ win: 0, tie: 0 });
    expect(matrix[1]?.[0]).toEqual({ win: 0, tie: 0 });
    expect(matrix[0]?.[0]).toBeNull();
    expect(matrix[1]?.[1]).toBeNull();
  });

  it('keeps equal cells as separate objects', () => {
    const matrix = beatMatrix([d6, d6, d6]);
    const first = matrix[0]?.[1];
    const second = matrix[0]?.[2];
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
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
