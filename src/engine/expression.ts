import type { Distribution, Expression, RollMode } from '../types';
import { expressionTooComplex } from './complexity';
import {
  convolveMany,
  emptyDistribution,
  shift,
  shiftClampedAtZero,
  sortedKeys,
} from './distribution';
import { partDistribution, poolPartDistribution } from './parts';

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

// Advantage means "roll the whole thing twice and keep the better one", which for
// a pool would mean comparing two success counts. That is a distinct mechanic
// nobody has asked for, and running applyRollMode over a count distribution would
// answer it anyway, plausibly and wrongly. rollMode is preserved on the row for
// the day it flips back to sum, and ignored here.
function poolDistribution(expr: Expression): Distribution {
  const threshold = expr.successThreshold;
  if (threshold === undefined) return emptyDistribution();

  const partDists: Distribution[] = [];
  for (const part of expr.parts) {
    const d = poolPartDistribution(part, threshold);
    if (d.size === 0) return emptyDistribution();
    partDists.push(d);
  }

  let dist = convolveMany(partDists);
  if (dist.size === 0) return emptyDistribution();

  if (Number.isFinite(expr.flatModifier) && expr.flatModifier !== 0) {
    dist = shiftClampedAtZero(dist, expr.flatModifier);
  }

  return dist;
}

export function expressionDistribution(expr: Expression): Distribution {
  if (!Array.isArray(expr.parts) || expr.parts.length === 0) return emptyDistribution();
  if (expressionTooComplex(expr)) return emptyDistribution();

  if (expr.mode === 'pool') return poolDistribution(expr);

  const partDists: Distribution[] = [];
  for (const part of expr.parts) {
    const d = partDistribution(part);
    if (d.size === 0) return emptyDistribution();
    partDists.push(d);
  }

  let dist = convolveMany(partDists);
  if (dist.size === 0) return emptyDistribution();

  if (Number.isFinite(expr.flatModifier) && expr.flatModifier !== 0) {
    dist = shift(dist, expr.flatModifier);
  }

  if (expr.rollMode !== 'normal') {
    dist = applyRollMode(dist, expr.rollMode);
  }

  return dist;
}
