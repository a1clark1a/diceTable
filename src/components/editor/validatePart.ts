import type { DicePart } from '../../types';

export interface PartErrors {
  count?: string;
  sides?: string;
  keepN?: string;
  rerollValues?: string;
  explodeFaces?: string;
  explodeDepth?: string;
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
    } else if (
      Number.isInteger(part.sides) &&
      part.explode.onFaces.length >= part.sides
    ) {
      errs.explodeFaces = 'Cannot explode on all faces';
    }
    if (!Number.isInteger(part.explode.depthCap) || part.explode.depthCap < 0) {
      errs.explodeDepth = 'Depth ≥ 0';
    }
  }
  return errs;
}
