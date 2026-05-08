import { describe, expect, it } from 'vitest';
import { emptyDistribution, uniformDistribution } from './distribution';
import { sampleDistribution } from './sample';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('sampleDistribution', () => {
  it('returns null for an empty distribution', () => {
    expect(sampleDistribution(emptyDistribution())).toBeNull();
  });

  it('returns the only outcome for a singleton distribution', () => {
    const dist = new Map([[7, 1]]);
    for (let i = 0; i < 50; i++) {
      expect(sampleDistribution(dist, () => Math.random())).toBe(7);
    }
  });

  it('matches the uniform 1d6 distribution within a tight band over many samples', () => {
    const d6 = uniformDistribution(6);
    const rng = mulberry32(0xc0ffee);
    const counts = new Map<number, number>();
    const N = 60_000;
    for (let i = 0; i < N; i++) {
      const v = sampleDistribution(d6, rng);
      expect(v).not.toBeNull();
      counts.set(v as number, (counts.get(v as number) ?? 0) + 1);
    }
    for (let face = 1; face <= 6; face++) {
      const observed = (counts.get(face) ?? 0) / N;
      expect(observed).toBeGreaterThan(1 / 6 - 0.01);
      expect(observed).toBeLessThan(1 / 6 + 0.01);
    }
  });

  it('respects a weighted distribution at fixed rng samples', () => {
    const dist = new Map([
      [1, 0.1],
      [2, 0.9],
    ]);
    expect(sampleDistribution(dist, () => 0.05)).toBe(1);
    expect(sampleDistribution(dist, () => 0.5)).toBe(2);
    expect(sampleDistribution(dist, () => 0.999)).toBe(2);
  });

  it('returns the smallest key when rng is 0 and the largest key when rng approaches 1', () => {
    const dist = new Map([
      [3, 0.25],
      [5, 0.25],
      [9, 0.5],
    ]);
    expect(sampleDistribution(dist, () => 0)).toBe(3);
    expect(sampleDistribution(dist, () => 1 - 1e-9)).toBe(9);
  });

  it('normalises a slightly-low total so the largest key is still reachable', () => {
    const dist = new Map([
      [1, 0.4999999],
      [2, 0.4999999],
    ]);
    expect(sampleDistribution(dist, () => 1 - 1e-12)).toBe(2);
  });

  it('returns null when total mass is zero', () => {
    const dist = new Map([
      [1, 0],
      [2, 0],
    ]);
    expect(sampleDistribution(dist)).toBeNull();
  });
});
