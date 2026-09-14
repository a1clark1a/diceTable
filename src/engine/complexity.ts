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
    cost += part.sides * explodeCap(part.explode);
  }

  // applyKeep enumerates weak compositions of `count` over the die's DISTINCT
  // VALUES, and those come from singleDieDistribution, which has already applied
  // reroll and explode. Charging `sides` prices a die that no longer exists: an
  // exploding d6 at the default cap shows 56 distinct faces, not 6, so 6d6
  // keeping 5 scored 522 against a 1e5 gate and then ran for 25 seconds on the
  // main thread. partMaxFace bounds the post-explode face set from above, which
  // is the honest thing to charge and stays a pure function of the part.
  if (part.keep) {
    const faces = partMaxFace(part);
    const leaves = binomial(part.count + faces - 1, faces - 1);
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

function explodeCap(rule: NonNullable<DicePart['explode']>): number {
  return Number.isInteger(rule.depthCap) && rule.depthCap >= 0
    ? rule.depthCap
    : DEFAULT_EXPLODE_CAP;
}

/**
 * The largest total one die can reach, chain included.
 *
 * A chain is at most cap + 1 dice, but only the first cap of them have to show
 * an exploding face to keep it going, so they are bounded by the highest face
 * that actually explodes rather than by the highest face on the die. Reading it
 * as sides * (cap + 1) charges every chain die the top of the die: a d100
 * exploding on 1 at cap 50 reaches 150, and was scored 5,100, which is enough
 * on its own to have supportWidth refuse a row whose real support is 149 wide.
 *
 * A face above `sides` can never come up, so it never explodes and never counts.
 */
function partMaxFace(part: DicePart): number {
  if (!part.explode) return part.sides;
  let top = 0;
  for (const face of part.explode.onFaces) {
    if (Number.isInteger(face) && face >= 1 && face <= part.sides && face > top) {
      top = face;
    }
  }
  if (top === 0) return part.sides;
  return part.sides + explodeCap(part.explode) * top;
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

/**
 * How many distinct totals a summed roll can land on.
 *
 * partComplexity scores keep and explode, which are the two things that make a
 * part expensive per die. A plain sum has neither, so it scored zero however big
 * it was, and nothing stood between the app and a row that takes minutes:
 * 100d100 measured 615ms and 100d1000 over three minutes, both on the main
 * thread, both reported as fine.
 *
 * Convolving parts together costs about the square of the resulting support, so
 * the width is what has to be bounded rather than the dice count.
 */
export function supportWidth(expr: Expression): number {
  // Counting successes is bounded by poolComplexity, which already squares the
  // dice count, and its support is the dice count rather than a sum of faces.
  if (expr.mode === 'pool') return 0;

  const widthOf = (parts: readonly DicePart[], keepAcross?: KeepRule): number => {
    let total = 0;
    let maxFace = 0;
    for (const part of parts) {
      if (!Number.isInteger(part.count) || part.count < 1) continue;
      if (!Number.isInteger(part.sides) || part.sides < 2) continue;
      const face = partMaxFace(part);
      // A keep rule discards dice before they are added, so the row is only as
      // wide as the dice it keeps.
      const kept = part.keep ? Math.min(part.keep.n, part.count) : part.count;
      total += kept * (face - 1);
      maxFace = Math.max(maxFace, face);
    }
    if (keepAcross && Number.isInteger(keepAcross.n) && keepAcross.n >= 1) {
      return Math.min(total, keepAcross.n * (maxFace - 1));
    }
    return total;
  };

  let width = widthOf(expr.parts, expr.keepAcross);
  // A check row lands on its effect's totals, so that is the support drawn.
  if (expr.check !== undefined) {
    width = Math.max(
      width,
      widthOf(expr.check.effect.parts, expr.check.effect.keepAcross),
    );
  }
  return width + 1;
}

/**
 * The work bound on a summed roll, calibrated against measured time: 20d20
 * (width 381) takes 2ms and 20d100 (1,981) takes 34ms, both fine; 100d100
 * (9,901) takes 615ms and is not. Squared, that puts the line between 2.5e7 and
 * 9.8e7, and 5e7 is a width of about 7,000.
 */
export const MAX_SUPPORT_WORK = 5e7;

export function expressionTooComplex(expr: Expression): boolean {
  const width = supportWidth(expr);
  if (width * width > MAX_SUPPORT_WORK) return true;
  return expressionComplexity(expr) > MAX_COMPLEXITY;
}
