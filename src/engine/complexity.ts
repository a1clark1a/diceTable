import type { DicePart, Expression, KeepRule } from '../types';
import { critApplies, critEffectParts } from './critEffect';

const DEFAULT_EXPLODE_CAP = 10;

export const MAX_COMPLEXITY = 1e5;

export const COMPLEXITY_OVERFLOW = Number.POSITIVE_INFINITY;

export function partComplexity(part: DicePart): number {
  if (!Number.isInteger(part.count) || part.count < 1) return 0;
  if (!Number.isInteger(part.sides) || part.sides < 2) return 0;

  let cost = 0;

  if (part.explode) {
    cost += part.sides * explodeCap(part.explode);
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

/**
 * What the keep walk costs, in its own units.
 *
 * The walk takes one level per face value, carries one accumulator per (per-part
 * counted vector, running sum), and per level touches each occupied state once
 * and sweeps the running-sum axis. So the work is levels times states times the
 * width of that axis, and the axis is as wide as the kept sum can reach.
 *
 * Reading it as stateCount squared prices a level that can move any state to any
 * other. The transition rows are sharply peaked and the walk returns on a zero
 * weight, so it does not: squaring over-charges a many-dice row by three orders
 * of magnitude, enough to refuse 50d4 keeping 25, which takes half a
 * millisecond.
 *
 * Every per-part keep runs this same walk, so this scores both.
 */
export function keepWork(parts: readonly DicePart[], rule: KeepRule): number {
  if (!Number.isInteger(rule.n) || rule.n < 1) return 0;
  // One die has a closed form, and supportWidth already bounds what it costs.
  if (rule.n === 1) return 0;

  let totalDice = 0;
  let stateCount = 1;
  let maxFace = 0;
  for (const part of parts) {
    if (!Number.isInteger(part.count) || part.count < 1) return 0;
    if (!Number.isInteger(part.sides) || part.sides < 2) return 0;
    totalDice += part.count;
    stateCount *= part.count + 1;
    maxFace = Math.max(maxFace, partMaxFace(part));
  }
  // Keeping every die is a plain sum that the walk short-circuits before it
  // builds any state, so a big keep-all roll is not charged for work it skips.
  //
  // This has to be settled before the state count is judged, not during it.
  // However many states there would have been, none of them is built, and
  // refusing on a count of states nobody counts turns away a roll that
  // convolves in a tenth of a second.
  if (rule.n >= totalDice) return 0;
  if (stateCount > MAX_KEEP_WORK) return COMPLEXITY_OVERFLOW;

  const work = maxFace * stateCount * (rule.n * maxFace + totalDice) * parts.length;
  return Number.isFinite(work) ? work : COMPLEXITY_OVERFLOW;
}

/**
 * Calibrated on compatibility rather than on a time budget, because the two
 * disagree and compatibility is the tighter of them. Every plain keep row the
 * previous release computed has to keep computing: sweeping all 2,190 of them
 * puts the ceiling at 999d2 keeping 998, which costs 5.99e6 units and 34ms, so
 * the cap cannot go below 6e6. This is that with room to spare, and it admits
 * nothing slower than about a third of a second.
 */
export const MAX_KEEP_WORK = 7.5e6;

/**
 * Every keep walk a row pays for. A check row rolls its effect and, if it can
 * crit, a bigger version of it, and each of those can carry its own rules.
 */
function expressionKeepWork(expr: Expression): number {
  const partsKeep = (parts: readonly DicePart[], across: KeepRule | undefined): number => {
    let total = 0;
    for (const part of parts) {
      if (part.keep) total += keepWork([part], part.keep);
    }
    if (across) total += keepWork(parts, across);
    return total;
  };

  // A pool row counts successes one die at a time and never keeps anything.
  if (expr.mode === 'pool') return 0;

  let total = partsKeep(expr.parts, expr.keepAcross);
  // Only a check row rolls its effect. A sum row that still carries a spec from
  // before the mode changed does not, so it must not be charged for one.
  const spec = expr.mode === 'check' ? expr.check : undefined;
  if (spec !== undefined) {
    total += partsKeep(spec.effect.parts, spec.effect.keepAcross);
    if (spec.onSuccess !== 'none' && critApplies(spec, expr.parts)) {
      total += partsKeep(critEffectParts(spec), spec.effect.keepAcross);
    }
  }
  return total;
}

function partsComplexity(parts: readonly DicePart[]): number {
  let total = 0;
  for (const part of parts) {
    const c = partComplexity(part);
    if (c === COMPLEXITY_OVERFLOW) return COMPLEXITY_OVERFLOW;
    total += c;
    if (total > MAX_COMPLEXITY) return total;
  }
  return total;
}

// A check row pays for three rolls, not one: the check itself, the effect, and
// the bigger effect a critical rolls. Scoring only the check dice would let an
// unbounded effect through the guard.
export function checkComplexity(expr: Expression): number {
  const spec = expr.check;
  const trigger = partsComplexity(expr.parts);
  if (spec === undefined || trigger === COMPLEXITY_OVERFLOW) return trigger;

  const effect = partsComplexity(spec.effect.parts);
  if (effect === COMPLEXITY_OVERFLOW) return COMPLEXITY_OVERFLOW;
  let total = trigger + effect;
  if (total > MAX_COMPLEXITY) return total;

  // A 'none' success scale means the crit roll is skipped, so it costs nothing.
  if (spec.onSuccess !== 'none' && critApplies(spec, expr.parts)) {
    const onCrit = partsComplexity(critEffectParts(spec));
    if (onCrit === COMPLEXITY_OVERFLOW) return COMPLEXITY_OVERFLOW;
    total += onCrit;
  }

  return total;
}

export function expressionComplexity(expr: Expression): number {
  if (!Array.isArray(expr.parts) || expr.parts.length === 0) return 0;
  if (expr.mode === 'pool') return poolComplexity(expr);
  if (expr.mode === 'check') return checkComplexity(expr);

  return partsComplexity(expr.parts);
}

export function partTooComplex(part: DicePart): boolean {
  if (partComplexity(part) > MAX_COMPLEXITY) return true;
  return part.keep !== undefined && keepWork([part], part.keep) > MAX_KEEP_WORK;
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
  const spec = expr.check;
  if (spec !== undefined) {
    width = Math.max(width, widthOf(spec.effect.parts, spec.effect.keepAcross));
    // A critical rolls a bigger effect than an ordinary success, and the row is
    // as wide as the widest thing it can land on. Doubling the dice doubles the
    // width, and scoring only the ordinary effect halves the estimate of the
    // heaviest roll in the row.
    if (spec.onSuccess !== 'none' && critApplies(spec, expr.parts)) {
      width = Math.max(width, widthOf(critEffectParts(spec), spec.effect.keepAcross));
    }
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
  if (expressionKeepWork(expr) > MAX_KEEP_WORK) return true;
  return expressionComplexity(expr) > MAX_COMPLEXITY;
}
