import type { DicePart, Expression, KeepRule } from '../types';
import { critApplies, critEffectParts } from './critEffect';

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

function partMaxFace(part: DicePart): number {
  if (!part.explode || part.explode.onFaces.length === 0) return part.sides;
  const cap =
    Number.isInteger(part.explode.depthCap) && part.explode.depthCap >= 0
      ? part.explode.depthCap
      : DEFAULT_EXPLODE_CAP;
  return part.sides * (cap + 1);
}

// The keep-across walk holds one accumulator per (per-part counted vector,
// running sum), and every level can move any state to any other, so the work
// scales with the square of the state count times the sum domain. Keeping n = 1
// and "keep them all" at zero leaves the cheap closed-form paths unguarded.
export function keepAcrossComplexity(
  parts: readonly DicePart[],
  rule: KeepRule,
): number {
  if (!Number.isInteger(rule.n) || rule.n < 1) return 0;
  if (rule.n === 1) return 0;

  let totalDice = 0;
  for (const part of parts) {
    if (!Number.isInteger(part.count) || part.count < 1) return 0;
    if (!Number.isInteger(part.sides) || part.sides < 2) return 0;
    totalDice += part.count;
  }
  // Keeping every die is a plain sum that keepAcrossDistribution short-circuits
  // before the walk, so the state space is never built. Deciding that first
  // keeps a big keep-all roll from being flagged for work it never does.
  if (rule.n >= totalDice) return 0;

  let stateCount = 1;
  let maxFace = 0;
  for (const part of parts) {
    stateCount *= part.count + 1;
    maxFace = Math.max(maxFace, partMaxFace(part));
    if (stateCount > MAX_COMPLEXITY) return COMPLEXITY_OVERFLOW;
  }

  const cost = stateCount * stateCount * rule.n * maxFace;
  return Number.isFinite(cost) ? cost : COMPLEXITY_OVERFLOW;
}

function partsComplexity(
  parts: readonly DicePart[],
  keepAcross: KeepRule | undefined,
): number {
  let total = 0;
  for (const part of parts) {
    const c = partComplexity(part);
    if (c === COMPLEXITY_OVERFLOW) return COMPLEXITY_OVERFLOW;
    total += c;
    if (total > MAX_COMPLEXITY) return total;
  }

  if (keepAcross) {
    const across = keepAcrossComplexity(parts, keepAcross);
    if (across === COMPLEXITY_OVERFLOW) return COMPLEXITY_OVERFLOW;
    total += across;
  }

  return total;
}

// A check row pays for three rolls, not one: the check itself, the effect, and
// the bigger effect a critical rolls. Scoring only the check dice would let an
// unbounded effect through the guard.
export function checkComplexity(expr: Expression): number {
  const spec = expr.check;
  const trigger = partsComplexity(expr.parts, undefined);
  if (spec === undefined || trigger === COMPLEXITY_OVERFLOW) return trigger;

  const effect = partsComplexity(spec.effect.parts, spec.effect.keepAcross);
  if (effect === COMPLEXITY_OVERFLOW) return COMPLEXITY_OVERFLOW;
  let total = trigger + effect;
  if (total > MAX_COMPLEXITY) return total;

  // A 'none' success scale means the crit roll is skipped, so it costs nothing.
  if (spec.onSuccess !== 'none' && critApplies(spec, expr.parts)) {
    const onCrit = partsComplexity(critEffectParts(spec), spec.effect.keepAcross);
    if (onCrit === COMPLEXITY_OVERFLOW) return COMPLEXITY_OVERFLOW;
    total += onCrit;
  }

  return total;
}

export function expressionComplexity(expr: Expression): number {
  if (!Array.isArray(expr.parts) || expr.parts.length === 0) return 0;
  if (expr.mode === 'pool') return poolComplexity(expr);
  if (expr.mode === 'check') return checkComplexity(expr);

  return partsComplexity(expr.parts, expr.keepAcross);
}

export function partTooComplex(part: DicePart): boolean {
  return partComplexity(part) > MAX_COMPLEXITY;
}

export function expressionTooComplex(expr: Expression): boolean {
  return expressionComplexity(expr) > MAX_COMPLEXITY;
}
