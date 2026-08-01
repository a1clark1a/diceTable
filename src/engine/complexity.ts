import type { DicePart, Expression } from '../types';

const DEFAULT_EXPLODE_CAP = 10;

export const MAX_COMPLEXITY = 1e5;

export const COMPLEXITY_OVERFLOW = Number.POSITIVE_INFINITY;

function binomial(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k)) return 0;
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < kk; i++) {
    result = (result * (n - i)) / (i + 1);
    if (!Number.isFinite(result) || result > MAX_COMPLEXITY * 10) {
      return COMPLEXITY_OVERFLOW;
    }
  }
  return result;
}

export function partComplexity(part: DicePart): number {
  if (!Number.isInteger(part.count) || part.count < 1) return 0;
  if (!Number.isInteger(part.sides) || part.sides < 2) return 0;

  let cost = 0;

  if (part.explode) {
    const cap =
      Number.isInteger(part.explode.depthCap) && part.explode.depthCap >= 0
        ? part.explode.depthCap
        : DEFAULT_EXPLODE_CAP;
    cost += part.sides * cap;
  }

  if (part.keep) {
    const leaves = binomial(part.count + part.sides - 1, part.sides - 1);
    if (leaves === COMPLEXITY_OVERFLOW) return COMPLEXITY_OVERFLOW;
    cost += leaves;
  }

  return cost;
}

// Pool rows strip keep and explode, the only two things partComplexity scores, so
// they would all score 0 and never trip the guard while their real cost, the
// Bernoulli convolution, stays quadratic in dice count with nothing bounding it.
// Squaring the total dice puts pool rows on the same scale as the sum path.
function poolComplexity(expr: Expression): number {
  let dice = 0;
  for (const part of expr.parts) {
    if (!Number.isInteger(part.count) || part.count < 1) continue;
    if (!Number.isInteger(part.sides) || part.sides < 2) continue;
    dice += part.count;
    if (dice > MAX_COMPLEXITY) return COMPLEXITY_OVERFLOW;
  }
  return dice * dice;
}

export function expressionComplexity(expr: Expression): number {
  if (!Array.isArray(expr.parts) || expr.parts.length === 0) return 0;
  if (expr.mode === 'pool') return poolComplexity(expr);

  let total = 0;
  for (const part of expr.parts) {
    const c = partComplexity(part);
    if (c === COMPLEXITY_OVERFLOW) return COMPLEXITY_OVERFLOW;
    total += c;
    if (total > MAX_COMPLEXITY) return total;
  }
  return total;
}

export function partTooComplex(part: DicePart): boolean {
  return partComplexity(part) > MAX_COMPLEXITY;
}

export function expressionTooComplex(expr: Expression): boolean {
  return expressionComplexity(expr) > MAX_COMPLEXITY;
}
