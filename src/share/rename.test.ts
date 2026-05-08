import { describe, expect, it } from 'vitest';
import type { Expression } from '../types';
import { renameCollisions } from './rename';

function expr(name: string, id = `expr-${name}`): Expression {
  return {
    id,
    name,
    parts: [{ id: `part-${id}`, count: 1, sides: 20 }],
    flatModifier: 0,
    rollMode: 'normal',
  };
}

describe('renameCollisions', () => {
  it('returns incoming unchanged when no names collide', () => {
    const existing = [expr('Longbow'), expr('Shortsword')];
    const incoming = [expr('Greataxe'), expr('Dagger')];
    const result = renameCollisions(existing, incoming);
    expect(result.map((e) => e.name)).toEqual(['Greataxe', 'Dagger']);
  });

  it('appends (2) when a name collides once', () => {
    const existing = [expr('Longbow')];
    const incoming = [expr('Longbow', 'expr-import-1')];
    const result = renameCollisions(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Longbow (2)');
    expect(result[0]!.id).toBe('expr-import-1');
  });

  it('skips to (3) when (2) is already taken in existing', () => {
    const existing = [expr('Longbow'), expr('Longbow (2)')];
    const incoming = [expr('Longbow', 'expr-import-1')];
    const result = renameCollisions(existing, incoming);
    expect(result[0]!.name).toBe('Longbow (3)');
  });

  it('bumps the second of two same-named incoming rows', () => {
    const existing: Expression[] = [];
    const incoming = [expr('Longbow', 'a'), expr('Longbow', 'b')];
    const result = renameCollisions(existing, incoming);
    expect(result.map((e) => e.name)).toEqual(['Longbow', 'Longbow (2)']);
  });

  it('handles three same-named incoming rows', () => {
    const existing: Expression[] = [];
    const incoming = [
      expr('Longbow', 'a'),
      expr('Longbow', 'b'),
      expr('Longbow', 'c'),
    ];
    const result = renameCollisions(existing, incoming);
    expect(result.map((e) => e.name)).toEqual([
      'Longbow',
      'Longbow (2)',
      'Longbow (3)',
    ]);
  });

  it('treats names case-sensitively', () => {
    const existing = [expr('Longbow')];
    const incoming = [expr('longbow')];
    const result = renameCollisions(existing, incoming);
    expect(result[0]!.name).toBe('longbow');
  });

  it('trims names before comparison', () => {
    const existing = [expr('Longbow')];
    const incoming = [expr('  Longbow  ')];
    const result = renameCollisions(existing, incoming);
    expect(result[0]!.name).toBe('Longbow (2)');
  });

  it('preserves all non-name fields on the renamed row', () => {
    const existing = [expr('Longbow')];
    const incoming = [
      {
        ...expr('Longbow', 'expr-import'),
        flatModifier: 7,
        rollMode: 'advantage' as const,
      },
    ];
    const result = renameCollisions(existing, incoming);
    expect(result[0]!.name).toBe('Longbow (2)');
    expect(result[0]!.flatModifier).toBe(7);
    expect(result[0]!.rollMode).toBe('advantage');
    expect(result[0]!.id).toBe('expr-import');
  });

  it('is idempotent on a no-op call', () => {
    const existing = [expr('Longbow')];
    const incoming = [expr('Greataxe')];
    const first = renameCollisions(existing, incoming);
    const second = renameCollisions(existing, first);
    expect(second).toEqual(first);
  });

  it('is idempotent after a rename has happened', () => {
    const existing = [expr('Longbow')];
    const first = renameCollisions(existing, [expr('Longbow', 'i1')]);
    const second = renameCollisions([...existing, ...first], []);
    expect(second).toEqual([]);
  });

  it('handles empty incoming', () => {
    expect(renameCollisions([expr('Longbow')], [])).toEqual([]);
  });

  it('handles empty existing', () => {
    const incoming = [expr('Longbow'), expr('Greataxe')];
    expect(renameCollisions([], incoming)).toEqual(incoming);
  });
});
