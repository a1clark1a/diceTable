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
  // Past 2^53 neighbouring totals round onto one double, so two keys can land
  // on the same value; adding keeps the mass that overwriting would drop.
  for (const [k, p] of dist) {
    const key = k + offset;
    result.set(key, (result.get(key) ?? 0) + p);
  }
  return result;
}

// Success counts have a floor: a penalty bigger than the successes rolled leaves
// zero, not a negative count. Every key below the floor collapses onto 0, so the
// mass accumulates.
export function clampAtZero(dist: Distribution): Distribution {
  const result = new Map<number, number>();
  for (const [k, p] of dist) {
    const clamped = Math.max(0, k);
    result.set(clamped, (result.get(clamped) ?? 0) + p);
  }
  return result;
}

// Multiplying spreads the totals apart without creating any, so the map keeps
// its size and only the gaps between keys grow.
export function scale(dist: Distribution, factor: number): Distribution {
  if (!Number.isInteger(factor) || factor < 1) return emptyDistribution();
  if (factor === 1) return new Map(dist);
  const result = new Map<number, number>();
  for (const [k, p] of dist) {
    result.set(k * factor, p);
  }
  return result;
}

// Rounds down, so a negative total moves away from zero: -3 / 2 is -2. Totals
// next to each other land on the same value, so the mass accumulates.
export function divideFloor(dist: Distribution, divisor: number): Distribution {
  if (!Number.isInteger(divisor) || divisor < 1) return emptyDistribution();
  if (divisor === 1) return new Map(dist);
  const result = new Map<number, number>();
  for (const [k, p] of dist) {
    const divided = Math.floor(k / divisor);
    result.set(divided, (result.get(divided) ?? 0) + p);
  }
  return result;
}

export function halveFloor(dist: Distribution): Distribution {
  return divideFloor(dist, 2);
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

export function sortedKeys(dist: Distribution): number[] {
  return [...dist.keys()].sort((a, b) => a - b);
}
