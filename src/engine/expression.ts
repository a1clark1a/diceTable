import type { Distribution, Expression } from '../types';
import { checkDistribution } from './check';
import { expressionTooComplex } from './complexity';
import {
  convolveMany,
  emptyDistribution,
  shift,
  shiftClampedAtZero,
} from './distribution';
import { poolPartDistribution } from './parts';
import { applyRollMode, sumPartsDistribution } from './roll';

// Named homes for the mode semantics every consumer needs, so a future mode is a
// one-decision change here instead of a hunt for anonymous `mode !== 'pool'` and
// `mode === 'check'` comparisons scattered across chart, header, and share code.
export function isTotalsMode(expr: Pick<Expression, 'mode'>): boolean {
  return expr.mode !== 'pool';
}

// A row "can miss" when part of its probability mass means "nothing happened at
// all" (a failed check landing on 0), which the zero-spike cap treats specially.
export function canMiss(expr: Pick<Expression, 'mode'>): boolean {
  return expr.mode === 'check';
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
  if (expr.mode === 'check') return checkDistribution(expr);

  let dist = sumPartsDistribution(expr.parts, expr.keepAcross);
  if (dist.size === 0) return emptyDistribution();

  if (Number.isFinite(expr.flatModifier) && expr.flatModifier !== 0) {
    dist = shift(dist, expr.flatModifier);
  }

  if (expr.rollMode !== 'normal') {
    dist = applyRollMode(dist, expr.rollMode);
  }

  return dist;
}
