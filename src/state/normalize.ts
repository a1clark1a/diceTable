import { isSingleDieCheck } from '../engine/critEffect';
import type { CheckSpec, CritRule, DicePart, Expression } from '../types';

// The persisted-state validator rejects any row that breaks an invariant, and
// one rejected row drops the user's whole saved table on the next load. Rather
// than trusting every mutation site to re-state every invariant, everything an
// expression can pass through (edits, imports, hydration) funnels into this one
// repair step. Normalization repairs what it can; validation stays the last
// line and keeps rejecting only the irreparable.

function stripKeep(part: DicePart): DicePart {
  if (part.keep === undefined) return part;
  const next: DicePart = { ...part };
  delete next.keep;
  return next;
}

// Keep and explode have no honest meaning when counting successes; stripping
// them keeps notation and math in agreement (they are never
// displayed-but-ignored). Reroll survives: pool odds are post-reroll.
function stripPoolIncompatible(part: DicePart): DicePart {
  if (part.keep === undefined && part.explode === undefined) return part;
  const next: DicePart = { ...part };
  delete next.keep;
  delete next.explode;
  return next;
}

// A critical is read off the face a single die shows, so a check roll of more
// than one die has no face left to read, and a face the die cannot show (left
// behind when the die shrinks) would sit active-but-inert with no way to
// deselect it in a picker that only lists real faces.
function normalizeCrit(
  crit: CritRule,
  checkParts: readonly DicePart[],
): CritRule | undefined {
  if (!isSingleDieCheck(checkParts)) return undefined;
  const sides = checkParts[0]?.sides ?? 0;
  const onFaces = crit.onFaces.filter((f) => f >= 1 && f <= sides);
  if (onFaces.length === 0) return undefined;
  if (onFaces.length === crit.onFaces.length) return crit;
  return { ...crit, onFaces };
}

// Keeping across parts replaces the per-part rule rather than stacking with it;
// when both are present the across-parts rule wins, matching the editor, which
// disables the per-part chip while the across-parts rule is on.
function normalizeCheck(spec: CheckSpec, checkParts: readonly DicePart[]): CheckSpec {
  let next = spec;

  const effect = spec.effect;
  if (
    effect.keepAcross !== undefined &&
    effect.parts.some((p) => p.keep !== undefined)
  ) {
    next = { ...next, effect: { ...effect, parts: effect.parts.map(stripKeep) } };
  }

  if (spec.crit !== undefined) {
    const crit = normalizeCrit(spec.crit, checkParts);
    if (crit !== spec.crit) {
      next = next === spec ? { ...spec } : next;
      if (crit) next.crit = crit;
      else delete next.crit;
    }
  }

  return next;
}

/**
 * Repairs an expression so it holds every invariant the validator checks:
 * fields that only one mode reads never linger on another mode's row, a keep
 * across parts never coexists with a per-part keep (at the row or inside a
 * check's effect), and a critical never names a die or face the check cannot
 * show. Returns the input untouched when nothing needs repair.
 */
export function normalizeExpression(expr: Expression): Expression {
  const next: Expression = { ...expr };
  let changed = false;

  if (expr.mode === 'pool') {
    if (expr.parts.some((p) => p.keep !== undefined || p.explode !== undefined)) {
      next.parts = expr.parts.map(stripPoolIncompatible);
      changed = true;
    }
    if (next.keepAcross !== undefined) {
      delete next.keepAcross;
      changed = true;
    }
    if (next.check !== undefined) {
      delete next.check;
      changed = true;
    }
  } else if (expr.mode === 'check') {
    if (next.successThreshold !== undefined) {
      delete next.successThreshold;
      changed = true;
    }
    // A check is not a total, so keeping across parts describes nothing here.
    if (next.keepAcross !== undefined) {
      delete next.keepAcross;
      changed = true;
    }
    if (next.check !== undefined) {
      const check = normalizeCheck(next.check, next.parts);
      if (check !== next.check) {
        next.check = check;
        changed = true;
      }
    }
  } else {
    if (next.successThreshold !== undefined) {
      delete next.successThreshold;
      changed = true;
    }
    if (next.check !== undefined) {
      delete next.check;
      changed = true;
    }
    if (
      next.keepAcross !== undefined &&
      next.parts.some((p) => p.keep !== undefined)
    ) {
      next.parts = next.parts.map(stripKeep);
      changed = true;
    }
  }

  return changed ? next : expr;
}
