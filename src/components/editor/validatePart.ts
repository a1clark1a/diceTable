import type { DicePart } from '../../types';

export interface PartErrors {
  count?: string;
  sides?: string;
  keepN?: string;
  rerollValues?: string;
  explodeFaces?: string;
  explodeDepth?: string;
}

/**
 * Whether a chain started on this die could never stop.
 *
 * Counting the picked faces and comparing that to the die's size answers a
 * different question, and gets both directions wrong. It refuses a die that
 * picks the same face twice or picks faces the die does not have, neither of
 * which explodes any more often. And it passes a d6 that rerolls 1 to 3 always
 * and explodes on 4 to 6, where every face that survives the reroll explodes
 * and the roll has no ending, which the engine answers with a blank row.
 *
 * The question is whether any face the die can still show is one that stops.
 */
function everyFaceExplodes(part: DicePart): boolean {
  if (!part.explode) return false;
  if (!Number.isInteger(part.sides) || part.sides < 2) return false;

  const triggers = new Set(
    part.explode.onFaces.filter(
      (face) => Number.isInteger(face) && face >= 1 && face <= part.sides,
    ),
  );
  if (triggers.size === 0) return false;

  // Rerolling once leaves the face reachable, so only "always" removes it.
  const gone =
    part.reroll && part.reroll.mode === 'always'
      ? new Set(part.reroll.values)
      : new Set<number>();

  for (let face = 1; face <= part.sides; face++) {
    if (!gone.has(face) && !triggers.has(face)) return false;
  }
  return true;
}

export function validatePart(part: DicePart): PartErrors {
  const errs: PartErrors = {};
  if (!Number.isInteger(part.count) || part.count < 1) {
    errs.count = 'Count must be ≥ 1';
  }
  if (!Number.isInteger(part.sides) || part.sides < 2) {
    errs.sides = 'Sides must be ≥ 2';
  }
  if (part.keep) {
    if (!Number.isInteger(part.keep.n) || part.keep.n < 1) {
      errs.keepN = 'Keep ≥ 1';
    } else if (Number.isInteger(part.count) && part.keep.n > part.count) {
      errs.keepN = 'Keep ≤ count';
    }
  }
  if (part.reroll && part.reroll.values.length === 0) {
    errs.rerollValues = 'Pick at least one face';
  }
  if (part.explode) {
    if (part.explode.onFaces.length === 0) {
      errs.explodeFaces = 'Pick at least one face';
    } else if (everyFaceExplodes(part)) {
      errs.explodeFaces = 'Cannot explode on all faces';
    }
    if (!Number.isInteger(part.explode.depthCap) || part.explode.depthCap < 0) {
      errs.explodeDepth = 'Depth ≥ 0';
    }
  }
  return errs;
}
