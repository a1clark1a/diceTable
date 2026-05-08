import type { DicePart } from '../types';

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
