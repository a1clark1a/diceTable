import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPartPatch, defaultPart, newId } from './defaultPart';
import { normalizeExpression } from './normalize';
import { validateExpression } from './persistedSchema';
import type { DicePart, Expression } from '../types';

describe('defaultPart', () => {
  it('returns a single d20', () => {
    expect(defaultPart()).toMatchObject({ count: 1, sides: 20 });
  });

  it('prefixes the id with part-', () => {
    expect(defaultPart().id).toMatch(/^part-/);
  });

  it('gives two calls distinct ids', () => {
    expect(defaultPart().id).not.toBe(defaultPart().id);
  });

  // A stray optional key set to undefined would survive a spread into state
  // but fail the strict validator on the next reload.
  it('carries no optional rule keys', () => {
    expect(Object.keys(defaultPart()).sort()).toEqual(['count', 'id', 'sides']);
  });

  it('builds a row that passes the validator after a JSON round trip', () => {
    const row: Expression = {
      id: 'e',
      name: 'n',
      parts: [defaultPart()],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'sum',
    };
    const roundTripped: unknown = JSON.parse(JSON.stringify(row));
    expect(validateExpression(roundTripped)).not.toBeNull();
  });

  it('builds a row that normalizeExpression leaves untouched', () => {
    const row: Expression = {
      id: 'e',
      name: 'n',
      parts: [defaultPart()],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'sum',
    };
    expect(normalizeExpression(row)).toBe(row);
  });
});

describe('newId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes the id with the given prefix', () => {
    expect(newId('expr')).toMatch(/^expr-/);
  });

  // The shape a browser exposes on a plain http host: crypto exists, but
  // randomUUID does not.
  it('falls back to a prefixed random id when crypto has no randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: () => undefined });
    const a = newId('part');
    const b = newId('part');
    expect(a).toMatch(/^part-[0-9a-z]*-[0-9a-z]+$/);
    expect(b).toMatch(/^part-[0-9a-z]*-[0-9a-z]+$/);
    expect(a).not.toBe(b);
  });

  it('falls back to a prefixed random id when crypto is missing entirely', () => {
    vi.stubGlobal('crypto', undefined);
    const a = newId('part');
    const b = newId('part');
    expect(a).toMatch(/^part-[0-9a-z]*-[0-9a-z]+$/);
    expect(b).toMatch(/^part-[0-9a-z]*-[0-9a-z]+$/);
    expect(a).not.toBe(b);
  });

  // prefix, random slice, timestamp: three segments, where a UUID would add
  // four more.
  it('builds the fallback id from a random slice and a timestamp, not a UUID', () => {
    vi.stubGlobal('crypto', undefined);
    expect(newId('part').split('-')).toHaveLength(3);
  });
});

describe('applyPartPatch', () => {
  function fullPart(): DicePart {
    return {
      id: 'p',
      count: 2,
      sides: 6,
      keep: { type: 'highest', n: 1 },
      reroll: { values: [1], mode: 'once' },
      explode: { onFaces: [6], depthCap: 2 },
    };
  }

  it('sets count and leaves every rule alone', () => {
    const result = applyPartPatch(fullPart(), { count: 3 });
    expect(result.count).toBe(3);
    expect(result.sides).toBe(6);
    expect(result.keep).toEqual({ type: 'highest', n: 1 });
    expect(result.reroll).toEqual({ values: [1], mode: 'once' });
    expect(result.explode).toEqual({ onFaces: [6], depthCap: 2 });
  });

  it('sets sides and leaves keep alone', () => {
    const result = applyPartPatch(fullPart(), { sides: 8 });
    expect(result.sides).toBe(8);
    expect(result.keep).toEqual({ type: 'highest', n: 1 });
  });

  it('removes the keep key when the patch passes undefined', () => {
    const result = applyPartPatch(fullPart(), { keep: undefined });
    expect('keep' in result).toBe(false);
    expect(result.reroll).toEqual({ values: [1], mode: 'once' });
    expect(result.explode).toEqual({ onFaces: [6], depthCap: 2 });
  });

  it('removes the reroll key when the patch passes undefined', () => {
    const result = applyPartPatch(fullPart(), { reroll: undefined });
    expect('reroll' in result).toBe(false);
    expect(result.keep).toEqual({ type: 'highest', n: 1 });
  });

  it('removes the explode key when the patch passes undefined', () => {
    const result = applyPartPatch(fullPart(), { explode: undefined });
    expect('explode' in result).toBe(false);
    expect(result.keep).toEqual({ type: 'highest', n: 1 });
  });

  it('replaces a rule when the patch carries one', () => {
    const result = applyPartPatch(fullPart(), {
      explode: { onFaces: [5, 6], depthCap: 1 },
    });
    expect(result.explode).toEqual({ onFaces: [5, 6], depthCap: 1 });
  });

  it('leaves unmentioned rules alone when a patch is empty', () => {
    const result = applyPartPatch(fullPart(), {});
    expect(result).toEqual(fullPart());
  });

  // The row cache in useDistributions is keyed by object identity, so an
  // in-place edit would serve stale stats.
  it('never mutates the input part and always returns a new object', () => {
    const part = fullPart();
    const snapshot = structuredClone(part);
    const results = [
      applyPartPatch(part, { count: 3 }),
      applyPartPatch(part, { keep: undefined }),
      applyPartPatch(part, { sides: 8 }),
      applyPartPatch(part, { reroll: undefined }),
      applyPartPatch(part, { explode: undefined }),
      applyPartPatch(part, { explode: { onFaces: [5, 6], depthCap: 1 } }),
    ];
    expect(part).toEqual(snapshot);
    for (const result of results) expect(result).not.toBe(part);
  });
});
