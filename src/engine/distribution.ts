import type { Distribution } from '../types';

const EPSILON = 1e-15;

export function emptyDistribution(): Distribution {
  return new Map<number, number>();
}

export function uniformDistribution(sides: number): Distribution {
  if (!Number.isInteger(sides) || sides < 1) return emptyDistribution();
  const dist = new Map<number, number>();
  const p = 1 / sides;
  for (let face = 1; face <= sides; face++) {
    dist.set(face, p);
  }
  return dist;
}

export function totalMass(dist: Distribution): number {
  let sum = 0;
  for (const p of dist.values()) sum += p;
  return sum;
}

export function normalise(dist: Distribution): Distribution {
  const total = totalMass(dist);
  if (total <= 0) return emptyDistribution();
  const result = new Map<number, number>();
  for (const [k, p] of dist) {
    const q = p / total;
    if (q > EPSILON) result.set(k, q);
  }
  return result;
}

export function shift(dist: Distribution, offset: number): Distribution {
  if (!Number.isFinite(offset)) return emptyDistribution();
  if (offset === 0) return new Map(dist);
  const result = new Map<number, number>();
  for (const [k, p] of dist) {
    result.set(k + offset, p);
  }
  return result;
}

export function convolve(a: Distribution, b: Distribution): Distribution {
  if (a.size === 0 || b.size === 0) return emptyDistribution();
  const result = new Map<number, number>();
  for (const [ka, pa] of a) {
    for (const [kb, pb] of b) {
      const k = ka + kb;
      const prev = result.get(k) ?? 0;
      result.set(k, prev + pa * pb);
    }
  }
  return result;
}

export function convolveMany(dists: Distribution[]): Distribution {
  if (dists.length === 0) return emptyDistribution();
  const first = dists[0];
  if (!first) return emptyDistribution();
  let acc: Distribution = new Map(first);
  for (let i = 1; i < dists.length; i++) {
    const next = dists[i];
    if (!next) return emptyDistribution();
    acc = convolve(acc, next);
    if (acc.size === 0) return emptyDistribution();
  }
  return acc;
}

export function pruneSmall(dist: Distribution, epsilon: number = EPSILON): Distribution {
  const result = new Map<number, number>();
  for (const [k, p] of dist) {
    if (p > epsilon) result.set(k, p);
  }
  return result;
}

export function sortedKeys(dist: Distribution): number[] {
  return [...dist.keys()].sort((a, b) => a - b);
}
