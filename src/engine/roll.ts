import type { DicePart, Distribution, KeepRule, RollMode } from '../types';
import { convolveMany, emptyDistribution, sortedKeys } from './distribution';
import { keepAcrossDistribution } from './keepAcross';
import { partDistribution } from './parts';

export function applyRollMode(dist: Distribution, mode: RollMode): Distribution {
  if (dist.size === 0) return emptyDistribution();
  if (mode === 'normal') return new Map(dist);

  const keys = sortedKeys(dist);
  const cdf = new Map<number, number>();
  let cum = 0;
  for (const k of keys) {
    cum += dist.get(k) ?? 0;
    cdf.set(k, cum);
  }

  const result = new Map<number, number>();
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    const cdfK = cdf.get(k)!;
    const cdfPrev = i > 0 ? cdf.get(keys[i - 1]!)! : 0;

    let p: number;
    if (mode === 'advantage') {
      p = cdfK * cdfK - cdfPrev * cdfPrev;
    } else {
      const ccdfK = 1 - cdfK;
      const ccdfPrev = 1 - cdfPrev;
      p = ccdfPrev * ccdfPrev - ccdfK * ccdfK;
    }
    if (p > 0) result.set(k, p);
  }
  return result;
}

/**
 * The dice of one roll, added up. A keep-across rule replaces the addition with
 * "keep the best or worst n across every part", which is why it is handled here
 * rather than by the caller.
 */
export function sumPartsDistribution(
  parts: readonly DicePart[],
  keepAcross?: KeepRule,
): Distribution {
  if (parts.length === 0) return emptyDistribution();
  if (keepAcross) return keepAcrossDistribution(parts, keepAcross);

  const partDists: Distribution[] = [];
  for (const part of parts) {
    const d = partDistribution(part);
    if (d.size === 0) return emptyDistribution();
    partDists.push(d);
  }
  return convolveMany(partDists);
}
