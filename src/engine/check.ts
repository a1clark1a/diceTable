import type {
  CheckEffect,
  CheckSpec,
  Distribution,
  EffectScale,
  Expression,
} from '../types';
import { critApplies, critEffectParts, isSingleDieCheck } from './critEffect';
import {
  emptyDistribution,
  halveFloor,
  shift,
  uniformDistribution,
} from './distribution';
import { applyReroll, explodeFrom, meetsThreshold } from './parts';
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
    if (!Number.isInteger(part.sides) || part.sides < 2) return NO_CHANCES;
    const critFaces = critApplies(spec, expr.parts)
      ? new Set(spec.crit?.onFaces)
      : null;

    // A crit is read off the face the die shows, so classification has to
    // happen before explosion folds faces into chain totals: a face that both
    // crits and explodes would otherwise never crit (all its mass moves onto
    // higher totals), and a chain from a non-crit face whose total lands on a
    // crit face's number would crit without the die ever showing that face.
    // Split on the natural face after rerolls, then explode only the plain
    // side; totals decide against the threshold, the split decides what crit.
    let natural = uniformDistribution(part.sides);
    if (part.reroll) natural = applyReroll(natural, part.reroll);
    if (natural.size === 0) return NO_CHANCES;

    const critSide = new Map<number, number>();
    let plainSide: Distribution = natural;
    if (critFaces !== null) {
      plainSide = new Map<number, number>();
      for (const [face, p] of natural) {
        if (critFaces.has(face)) critSide.set(face, p);
        else plainSide.set(face, p);
      }
    }
    if (part.explode && plainSide.size > 0) {
      // Chain dice are full draws: one can land on a crit face's number (a
      // plain value there, since only the first die crits) and one landing on
      // an exploding face keeps chaining, crit face or not.
      plainSide = explodeFrom(plainSide, natural, part.explode);
      if (plainSide.size === 0) return NO_CHANCES;
    }

    let critWeight = (_t: number, mass: number): number => mass;
    let plainWeight = critWeight;
    if (expr.rollMode !== 'normal') {
      // Advantage and disadvantage over two independent draws, computed with
      // order statistics on the merged total distribution. A tie in totals
      // between a crit and a plain result goes to the crit under advantage (a
      // player keeps the die showing the crit face) and to the plain result
      // under disadvantage (the rule forces the worse of the two).
      const combined = new Map<number, number>();
      for (const [t, p] of critSide) combined.set(t, (combined.get(t) ?? 0) + p);
      for (const [t, p] of plainSide) combined.set(t, (combined.get(t) ?? 0) + p);
      const below = new Map<number, number>();
      let cum = 0;
      for (const t of [...combined.keys()].sort((a, b) => a - b)) {
        below.set(t, cum);
        cum += combined.get(t)!;
      }
      if (expr.rollMode === 'advantage') {
        critWeight = (t, mass) =>
          mass * (2 * (below.get(t)! + combined.get(t)!) - mass);
        plainWeight = (t, mass) => mass * (2 * below.get(t)! + mass);
      } else {
        const above = (t: number): number =>
          Math.max(0, 1 - below.get(t)! - combined.get(t)!);
        critWeight = (t, mass) => mass * (2 * above(t) + mass);
        plainWeight = (t, mass) => {
          const critTie = combined.get(t)! - mass;
          return mass * (2 * (above(t) + critTie) + mass);
        };
      }
    }

    let success = 0;
    let critChance = 0;
    let failure = 0;
    for (const [t, p] of critSide) critChance += critWeight(t, p);
    for (const [t, p] of plainSide) {
      const w = plainWeight(t, p);
      if (meetsThreshold(t + modifier, spec.threshold)) success += w;
      else failure += w;
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
