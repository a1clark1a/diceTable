import type { CheckSpec, DicePart } from '../types';

/**
 * Whether the check rolls exactly one die. A crit is read off the face the die
 * shows, not off the total, because "shows a 20" is the thing every system
 * states and because the face distribution is where advantage and rerolls
 * already live exactly. One die is what makes that statement meaningful, so a
 * multi-die check has no face to read and no critical to classify.
 */
export function isSingleDieCheck(parts: readonly DicePart[]): boolean {
  const first = parts[0];
  return parts.length === 1 && first !== undefined && first.count === 1;
}

/**
 * Whether a critical can actually happen on this check. The math and the cost
 * guard both ask here, so the guard can never charge for a roll the math will
 * never make.
 */
export function critApplies(
  spec: CheckSpec,
  checkParts: readonly DicePart[],
): boolean {
  const crit = spec.crit;
  if (crit === undefined || crit.onFaces.length === 0) return false;
  return isSingleDieCheck(checkParts);
}

/**
 * The effect dice as a critical rolls them. Shared by the math and the cost
 * guard so the two can never disagree about how big a crit is. `maxPlusRoll`
 * leaves the dice alone: it adds their maximum as a flat bonus instead.
 */
export function critEffectParts(spec: CheckSpec): DicePart[] {
  const parts = spec.effect.parts;
  const crit = spec.crit;
  if (crit === undefined || parts.length === 0) return [...parts];

  if (crit.effect === 'doubleDice') {
    return parts.map((part) => ({ ...part, count: part.count * 2 }));
  }

  if (crit.effect === 'extraDie') {
    return parts.map((part, i) => (i === 0 ? { ...part, count: part.count + 1 } : part));
  }

  return [...parts];
}
