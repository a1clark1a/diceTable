import type {
  CheckEffect,
  CheckSpec,
  Distribution,
  EffectScale,
  Expression,
} from '../types';
import { critApplies, critEffectParts, isSingleDieCheck } from './critEffect';
import { emptyDistribution, halveFloor, shift } from './distribution';
import { meetsThreshold, singleDieDistribution } from './parts';
import { applyRollMode, sumPartsDistribution } from './roll';

export interface CheckOutcomeChances {
  /** Successes that are not criticals. `success + crit + failure` is 1. */
  success: number;
  crit: number;
  failure: number;
}

const NO_CHANCES: CheckOutcomeChances = { success: 0, crit: 0, failure: 0 };

// Summing float probabilities leaves residues around 1e-16; anything under this
// is that noise, not a real chance.
const FLOAT_EPS = 1e-12;

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * How often the check crits, succeeds without critting, and fails. The three are
 * disjoint, so a "succeeds" percentage for the UI is `success + crit`.
 */
export function checkOutcomeChances(expr: Expression): CheckOutcomeChances {
  const spec = expr.check;
  if (spec === undefined || expr.parts.length === 0) return NO_CHANCES;

  const modifier = finite(expr.flatModifier);

  if (isSingleDieCheck(expr.parts)) {
    const part = expr.parts[0]!;
    const critFaces = critApplies(spec, expr.parts)
      ? new Set(spec.crit?.onFaces)
      : null;

    // The check die only classifies the outcome, and a crit face is already at
    // least a success no matter what its exploded total would be, so exploding
    // it cannot change the classification. applyExplode moves all of a face's
    // mass onto higher totals, so a face that both crits and explodes would
    // never crit; stripping crit faces from the explode rule keeps their
    // natural-face mass, which is exactly "crit on the natural face". Non-crit
    // explode faces keep exploding: their totals decide against the threshold.
    const die =
      critFaces !== null && part.explode !== undefined
        ? {
            ...part,
            explode: {
              ...part.explode,
              onFaces: part.explode.onFaces.filter((f) => !critFaces.has(f)),
            },
          }
        : part;

    let faces = singleDieDistribution(die);
    if (expr.rollMode !== 'normal') faces = applyRollMode(faces, expr.rollMode);
    if (faces.size === 0) return NO_CHANCES;

    let success = 0;
    let critChance = 0;
    let failure = 0;
    for (const [face, p] of faces) {
      if (critFaces?.has(face)) critChance += p;
      else if (meetsThreshold(face + modifier, spec.threshold)) success += p;
      else failure += p;
    }
    return { success, crit: critChance, failure };
  }

  const dice = sumPartsDistribution(expr.parts);
  if (dice.size === 0) return NO_CHANCES;
  let total = shift(dice, modifier);
  if (expr.rollMode !== 'normal') total = applyRollMode(total, expr.rollMode);

  let success = 0;
  for (const [value, p] of total) {
    if (meetsThreshold(value, spec.threshold)) success += p;
  }
  // When every total succeeds, IEEE summation can leave 1 - success at ~1e-16
  // instead of 0, and that residue would put a phantom point mass on 0
  // downstream. Snap it.
  let failure = 1 - success;
  if (failure < FLOAT_EPS) failure = 0;
  return { success, crit: 0, failure };
}

function effectDistribution(effect: CheckEffect): Distribution {
  const dice = sumPartsDistribution(effect.parts, effect.keepAcross);
  if (dice.size === 0) return emptyDistribution();
  return shift(dice, finite(effect.flatModifier));
}

function maxKey(dist: Distribution): number {
  let max = 0;
  for (const k of dist.keys()) if (k > max) max = k;
  return max;
}

function critDistribution(spec: CheckSpec): Distribution {
  const crit = spec.crit;
  if (crit === undefined) return effectDistribution(spec.effect);

  const dice = sumPartsDistribution(critEffectParts(spec), spec.effect.keepAcross);
  if (dice.size === 0) return emptyDistribution();

  let bonus = finite(spec.effect.flatModifier);
  if (crit.effect === 'maxPlusRoll') bonus += maxKey(dice);
  return shift(dice, bonus);
}

function scaleDistribution(dist: Distribution, scale: EffectScale): Distribution {
  if (scale === 'none') return new Map([[0, 1]]);
  if (scale === 'half') return halveFloor(dist);
  // Consumers only read the result, so 'full' can hand back the original.
  return dist;
}

/**
 * A check row: roll against a threshold, then apply an effect scaled by how it
 * went. One weighted mix of the outcome distributions, so the row still hands
 * every view downstream a single distribution.
 */
export function checkDistribution(expr: Expression): Distribution {
  const spec = expr.check;
  if (spec === undefined) return emptyDistribution();

  const chances = checkOutcomeChances(expr);
  const totalChance = chances.success + chances.crit + chances.failure;
  if (totalChance <= 0) return emptyDistribution();

  const effect = effectDistribution(spec.effect);
  if (effect.size === 0) return emptyDistribution();

  const result = new Map<number, number>();
  const mixIn = (dist: Distribution, weight: number): void => {
    if (weight <= 0) return;
    for (const [k, p] of dist) {
      result.set(k, (result.get(k) ?? 0) + p * weight);
    }
  };

  mixIn(scaleDistribution(effect, spec.onFailure), chances.failure);
  mixIn(scaleDistribution(effect, spec.onSuccess), chances.success);

  if (chances.crit > 0) {
    // A 'none' success scale collapses whatever a crit rolls to a point mass at
    // 0, so the crit convolution, the largest in the row, is never needed.
    if (spec.onSuccess === 'none') {
      mixIn(new Map([[0, 1]]), chances.crit);
    } else {
      const onCrit = critDistribution(spec);
      if (onCrit.size === 0) return emptyDistribution();
      mixIn(scaleDistribution(onCrit, spec.onSuccess), chances.crit);
    }
  }

  return result;
}
