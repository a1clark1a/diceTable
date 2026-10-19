import type { Distribution, Expression } from '../types';
import { checkDistribution } from './check';
import { expressionTooComplex } from './complexity';
import { clampAtZero, convolveMany, emptyDistribution } from './distribution';
import { applyMods } from './mods';
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

  const counted = convolveMany(partDists);
  if (counted.size === 0) return emptyDistribution();
  if (expr.mods === undefined) return counted;

  // Once, after the whole chain: "lose 2, then gain 1" on a single success
  // nets zero, where clamping between the steps would hand back a success the
  // chain took away.
  const dist = applyMods(counted, expr.mods);
  return dist.size === 0 ? dist : clampAtZero(dist);
}

export function expressionDistribution(expr: Expression): Distribution {
  if (!Array.isArray(expr.parts) || expr.parts.length === 0) return emptyDistribution();
  if (expressionTooComplex(expr)) return emptyDistribution();

  if (expr.mode === 'pool') return poolDistribution(expr);
  if (expr.mode === 'check') return checkDistribution(expr);

  let dist = sumPartsDistribution(expr.parts, expr.keepAcross);
  if (dist.size === 0) return emptyDistribution();

  // Before advantage, which keeps the better of two whole rolls. Picking the
  // better total and then applying the chain only equals applying the chain
  // and then picking because no step can turn a bigger total into a smaller
  // one. A negative multiplier would break that silently.
  dist = applyMods(dist, expr.mods);
  if (dist.size === 0) return emptyDistribution();

  if (expr.rollMode !== 'normal') {
    dist = applyRollMode(dist, expr.rollMode);
  }

  return dist;
}
