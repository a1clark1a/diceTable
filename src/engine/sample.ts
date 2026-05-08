import type { Distribution } from '../types';
import { sortedKeys, totalMass } from './distribution';

export function sampleDistribution(
  dist: Distribution,
  rng: () => number = Math.random,
): number | null {
  if (dist.size === 0) return null;
  const total = totalMass(dist);
  if (total <= 0) return null;

  const keys = sortedKeys(dist);
  const target = rng() * total;
  let cum = 0;
  for (const k of keys) {
    cum += dist.get(k) ?? 0;
    if (cum >= target) return k;
  }
  return keys[keys.length - 1] ?? null;
}
