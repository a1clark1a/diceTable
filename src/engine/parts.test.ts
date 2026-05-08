import { describe, expect, it } from 'vitest';
import type { DicePart } from '../types';
import { totalMass } from './distribution';
import { partDistribution } from './parts';
import { mean, stddev } from './stats';

const part = (overrides: Partial<DicePart>): DicePart => ({
  id: 'p',
  count: 1,
  sides: 6,
  ...overrides,
});

describe('partDistribution — plain dice', () => {
  it('1d6: mean 3.5, stddev sqrt(35/12) ≈ 1.7078', () => {
    const d = partDistribution(part({ count: 1, sides: 6 }));
    expect(mean(d)).toBeCloseTo(3.5, 10);
    expect(stddev(d)).toBeCloseTo(Math.sqrt(35 / 12), 10);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  it('2d6: PMF apex at 7 with mass 6/36', () => {
    const d = partDistribution(part({ count: 2, sides: 6 }));
    expect(d.get(7)).toBeCloseTo(6 / 36, 12);
    expect(d.get(2)).toBeCloseTo(1 / 36, 12);
    expect(d.get(12)).toBeCloseTo(1 / 36, 12);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });
});

describe('partDistribution — keep highest/lowest', () => {
  it('4d6kh3 mean = 15869/1296 ≈ 12.2446', () => {
    const d = partDistribution(part({
      count: 4,
      sides: 6,
      keep: { type: 'highest', n: 3 },
    }));
    expect(mean(d)).toBeCloseTo(15869 / 1296, 9);
    expect(totalMass(d)).toBeCloseTo(1, 10);
  });

  it('2d20 keep highest 1 (advantage analogue) matches 1d20-adv mean 13.825', () => {
    const d = partDistribution(part({
      count: 2,
      sides: 20,
      keep: { type: 'highest', n: 1 },
    }));
    expect(mean(d)).toBeCloseTo(13.825, 10);
  });

  it('keep.n > count returns empty distribution', () => {
    const d = partDistribution(part({
      count: 2,
      sides: 6,
      keep: { type: 'highest', n: 5 },
    }));
    expect(d.size).toBe(0);
  });
});

describe('partDistribution — reroll', () => {
  // Standard "reroll once" semantics: roll, if face ∈ values then reroll uniformly
  // and keep the new value (even if it lands in `values` again — "once" caps it).
  // For 1d6 reroll {1} once:
  //   P(final=1) = 1/6 * 1/6        = 1/36
  //   P(final=k) = 1/6 + 1/6 * 1/6  = 7/36   for k=2..6
  //   mean = (1 + 20*7) / 36 = 141/36 ≈ 3.9167
  it('1d6 reroll 1s once: mean = 141/36 ≈ 3.9167', () => {
    const d = partDistribution(part({
      count: 1,
      sides: 6,
      reroll: { values: [1], mode: 'once' },
    }));
    expect(d.get(1)).toBeCloseTo(1 / 36, 12);
    expect(d.get(2)).toBeCloseTo(7 / 36, 12);
    expect(d.get(6)).toBeCloseTo(7 / 36, 12);
    expect(mean(d)).toBeCloseTo(141 / 36, 10);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  it('1d6 reroll 1s always: uniform on 2..6, mean = 4', () => {
    const d = partDistribution(part({
      count: 1,
      sides: 6,
      reroll: { values: [1], mode: 'always' },
    }));
    expect(d.get(1)).toBeUndefined();
    expect(d.get(2)).toBeCloseTo(1 / 5, 12);
    expect(mean(d)).toBeCloseTo(4, 12);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  it('reroll-always with all faces in set returns empty', () => {
    const d = partDistribution(part({
      count: 1,
      sides: 6,
      reroll: { values: [1, 2, 3, 4, 5, 6], mode: 'always' },
    }));
    expect(d.size).toBe(0);
  });
});

describe('partDistribution — explode', () => {
  it('exploding 1d6 mean ≈ 4.2 (geometric, depth-capped)', () => {
    const d = partDistribution(part({
      count: 1,
      sides: 6,
      explode: { onFaces: [6], depthCap: 10 },
    }));
    expect(mean(d)).toBeCloseTo(4.2, 6);
    expect(totalMass(d)).toBeCloseTo(1, 10);
  });

  it('exploding face 6 cannot itself terminate at value 6', () => {
    const d = partDistribution(part({
      count: 1,
      sides: 6,
      explode: { onFaces: [6], depthCap: 10 },
    }));
    expect(d.get(6) ?? 0).toBe(0);
    expect(d.get(7)).toBeGreaterThan(0);
  });

  it('depthCap=0 leaves base distribution unchanged', () => {
    const d = partDistribution(part({
      count: 1,
      sides: 6,
      explode: { onFaces: [6], depthCap: 0 },
    }));
    for (let f = 1; f <= 6; f++) expect(d.get(f)).toBeCloseTo(1 / 6, 12);
  });
});

describe('partDistribution — invalid input', () => {
  it('count < 1 returns empty', () => {
    expect(partDistribution(part({ count: 0 })).size).toBe(0);
    expect(partDistribution(part({ count: -1 })).size).toBe(0);
  });

  it('sides < 2 returns empty', () => {
    expect(partDistribution(part({ sides: 1 })).size).toBe(0);
    expect(partDistribution(part({ sides: 0 })).size).toBe(0);
  });

  it('non-integer count or sides returns empty', () => {
    expect(partDistribution(part({ count: 1.5 })).size).toBe(0);
    expect(partDistribution(part({ sides: 6.5 })).size).toBe(0);
  });
});
