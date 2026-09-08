import type { Distribution, TargetRuling } from '../types';
import { sortedKeys } from './distribution';

export function mean(dist: Distribution): number {
  if (dist.size === 0) return 0;
  let m = 0;
  for (const [k, p] of dist) m += k * p;
  return m;
}

export function variance(dist: Distribution): number {
  if (dist.size === 0) return 0;
  const mu = mean(dist);
  let v = 0;
  for (const [k, p] of dist) {
    const d = k - mu;
    v += p * d * d;
  }
  return v;
}

export function stddev(dist: Distribution): number {
  return Math.sqrt(variance(dist));
}

export function min(dist: Distribution): number {
  if (dist.size === 0) return 0;
  let lo = Infinity;
  for (const k of dist.keys()) if (k < lo) lo = k;
  return lo;
}

export function max(dist: Distribution): number {
  if (dist.size === 0) return 0;
  let hi = -Infinity;
  for (const k of dist.keys()) if (k > hi) hi = k;
  return hi;
}

export function mode(dist: Distribution): number[] {
  if (dist.size === 0) return [];
  let best = -Infinity;
  for (const p of dist.values()) if (p > best) best = p;
  const modes: number[] = [];
  for (const k of sortedKeys(dist)) {
    if (Math.abs((dist.get(k) ?? 0) - best) < 1e-12) modes.push(k);
  }
  return modes;
}

export function cdf(dist: Distribution, k: number): number {
  if (dist.size === 0) return 0;
  let c = 0;
  for (const [key, p] of dist) {
    if (key <= k) c += p;
  }
  return c;
}

export function ccdf(dist: Distribution, k: number): number {
  if (dist.size === 0) return 0;
  let c = 0;
  for (const [key, p] of dist) {
    if (key >= k) c += p;
  }
  return c;
}

export function probEqual(dist: Distribution, k: number): number {
  return dist.get(k) ?? 0;
}

export function probAtLeast(dist: Distribution, k: number): number {
  return ccdf(dist, k);
}

export function probAtMost(dist: Distribution, k: number): number {
  return cdf(dist, k);
}

export function hitProbability(
  dist: Distribution,
  target: number,
  ruling: TargetRuling,
): number {
  if (dist.size === 0) return 0;
  if (!Number.isFinite(target)) return 0;
  switch (ruling) {
    case 'gte':
      return probAtLeast(dist, target);
    case 'gt':
      return ccdf(dist, target + 1);
    case 'lte':
      return probAtMost(dist, target);
    case 'lt':
      return cdf(dist, target - 1);
    case 'eq':
      return probEqual(dist, target);
  }
}

export function percentile(dist: Distribution, p: number): number {
  if (dist.size === 0) return 0;
  if (!Number.isFinite(p)) return 0;
  const target = Math.min(1, Math.max(0, p));
  const keys = sortedKeys(dist);
  let cum = 0;
  for (const k of keys) {
    cum += dist.get(k) ?? 0;
    if (cum >= target - 1e-12) return k;
  }
  return keys[keys.length - 1] ?? 0;
}

// hitProbability(dist, v, ruling) for every integer v in [min..max], computed
// in one cumulative pass instead of one full-distribution scan per point.
export function hitSeries(
  dist: Distribution,
  min: number,
  max: number,
  ruling: TargetRuling,
): number[] {
  if (dist.size === 0) return [];
  // A fractional bound would index the buckets off by a fraction, and an
  // inverted one would ask for an array of negative length; both are answered
  // the way hitProbability answers a target it cannot read, with no chance.
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) return [];
  const size = max - min + 1;
  const pmf = new Array<number>(size).fill(0);
  // A window narrower than the distribution still has mass on either side of
  // it, and that mass counts toward a cumulative reading inside the window, so
  // it seeds the running total rather than falling out of the array.
  let below = 0;
  let above = 0;
  for (const [v, p] of dist) {
    if (v < min) below += p;
    else if (v > max) above += p;
    else pmf[v - min] = p;
  }
  if (ruling === 'eq') return pmf;
  const out = new Array<number>(size).fill(0);
  if (ruling === 'gte' || ruling === 'gt') {
    let acc = above;
    for (let i = size - 1; i >= 0; i--) {
      if (ruling === 'gt') {
        out[i] = acc;
        acc += pmf[i] ?? 0;
      } else {
        acc += pmf[i] ?? 0;
        out[i] = acc;
      }
    }
  } else {
    let acc = below;
    for (let i = 0; i < size; i++) {
      if (ruling === 'lt') {
        out[i] = acc;
        acc += pmf[i] ?? 0;
      } else {
        acc += pmf[i] ?? 0;
        out[i] = acc;
      }
    }
  }
  return out;
}
