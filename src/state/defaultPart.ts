import type { DicePart } from '../types';
import type { PartPatch } from './useApp';

export function newId(prefix: string): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return `${prefix}-${g.crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

/** The dice the editor offers as chips, and the dice a die-size sweep offers to try. */
export const STANDARD_DICE: readonly number[] = [4, 6, 8, 10, 12, 20, 100];

export function defaultPart(): DicePart {
  return { id: newId('part'), count: 1, sides: 20 };
}

function clampFacesToSides(faces: number[], sides: number): number[] {
  const limit = Number.isInteger(sides) && sides >= 2 ? sides : 0;
  return faces.filter((f) => f >= 1 && f <= limit);
}

/**
 * The patch for giving a part a new die size. Reroll and explode faces the new
 * die cannot show are dropped with it, since a picker that only lists real
 * faces could never deselect them. The editor and the sweep both resize
 * through here so a d4 variant of an exploding d6 matches what the editor
 * leaves behind when the same die is shrunk by hand.
 */
export function sidesPatch(part: DicePart, sides: number): PartPatch {
  const patch: PartPatch = { sides };
  if (part.reroll) {
    patch.reroll = { ...part.reroll, values: clampFacesToSides(part.reroll.values, sides) };
  }
  if (part.explode) {
    patch.explode = {
      ...part.explode,
      onFaces: clampFacesToSides(part.explode.onFaces, sides),
    };
  }
  return patch;
}

export function applyPartPatch(part: DicePart, patch: PartPatch): DicePart {
  const next: DicePart = { ...part };
  if (patch.count !== undefined) next.count = patch.count;
  if (patch.sides !== undefined) next.sides = patch.sides;
  if ('keep' in patch) {
    if (patch.keep) next.keep = patch.keep;
    else delete next.keep;
  }
  if ('reroll' in patch) {
    if (patch.reroll) next.reroll = patch.reroll;
    else delete next.reroll;
  }
  if ('explode' in patch) {
    if (patch.explode) next.explode = patch.explode;
    else delete next.explode;
  }
  return next;
}
