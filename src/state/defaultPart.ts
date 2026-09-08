import type { DicePart } from '../types';
import type { PartPatch } from './useApp';

export function newId(prefix: string): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return `${prefix}-${g.crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function defaultPart(): DicePart {
  return { id: newId('part'), count: 1, sides: 20 };
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
