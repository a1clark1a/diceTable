import { describe, expect, it } from 'vitest';
import type { DicePart, Expression } from '../types';
import {
  expressionComplexity,
  expressionTooComplex,
  MAX_COMPLEXITY,
  partComplexity,
  partTooComplex,
} from './complexity';
import { partDistribution } from './parts';
import { expressionDistribution } from './expression';

const part = (overrides: Partial<DicePart>): DicePart => ({
  id: 'p',
  count: 1,
  sides: 6,
  ...overrides,
});

const expr = (overrides: Partial<Expression>): Expression => ({
  id: 'e',
  name: 'r',
  parts: [part({})],
  flatModifier: 0,
  rollMode: 'normal',
  ...overrides,
});

describe('partComplexity — keep multinomial leaves', () => {
  it('plain dice (no keep, no explode) cost is zero', () => {
    expect(partComplexity(part({ count: 4, sides: 6 }))).toBe(0);
    expect(partComplexity(part({ count: 100, sides: 100 }))).toBe(0);
  });

  it('4d6kh3 is well under the cap (126 leaves)', () => {
    const c = partComplexity(
      part({ count: 4, sides: 6, keep: { type: 'highest', n: 3 } }),
    );
    expect(c).toBe(126);
    expect(partTooComplex(part({ count: 4, sides: 6, keep: { type: 'highest', n: 3 } }))).toBe(false);
  });

  it('8d6kh4 is under the cap', () => {
    const c = partComplexity(
      part({ count: 8, sides: 6, keep: { type: 'highest', n: 4 } }),
    );
    expect(c).toBeLessThan(MAX_COMPLEXITY);
    expect(partTooComplex(part({ count: 8, sides: 6, keep: { type: 'highest', n: 4 } }))).toBe(false);
  });

  it('20d20kh3 exceeds the cap', () => {
    expect(
      partTooComplex(part({ count: 20, sides: 20, keep: { type: 'highest', n: 3 } })),
    ).toBe(true);
  });

  it('100d100kh50 exceeds the cap', () => {
    expect(
      partTooComplex(part({ count: 100, sides: 100, keep: { type: 'highest', n: 50 } })),
    ).toBe(true);
  });
});

describe('partComplexity — explode', () => {
  it('exploding 1d6 with cap 10 has small cost', () => {
    const c = partComplexity(
      part({ count: 1, sides: 6, explode: { onFaces: [6], depthCap: 10 } }),
    );
    expect(c).toBe(60);
  });

  it('exploding huge sides with deep cap stays bounded by the formula', () => {
    const c = partComplexity(
      part({ count: 1, sides: 1000, explode: { onFaces: [1000], depthCap: 10 } }),
    );
    expect(c).toBe(10000);
  });
});

describe('partComplexity — invalid input', () => {
  it('non-integer or below-min count returns zero', () => {
    expect(partComplexity(part({ count: 0 }))).toBe(0);
    expect(partComplexity(part({ count: -3 }))).toBe(0);
    expect(partComplexity(part({ count: 1.5 }))).toBe(0);
  });

  it('non-integer or below-min sides returns zero', () => {
    expect(partComplexity(part({ sides: 1 }))).toBe(0);
    expect(partComplexity(part({ sides: 6.5 }))).toBe(0);
  });
});

describe('expressionComplexity', () => {
  it('sums part complexities', () => {
    const e = expr({
      parts: [
        part({ id: 'a', count: 4, sides: 6, keep: { type: 'highest', n: 3 } }),
        part({ id: 'b', count: 4, sides: 6, keep: { type: 'highest', n: 3 } }),
      ],
    });
    expect(expressionComplexity(e)).toBe(252);
  });

  it('one runaway part dooms the expression', () => {
    const e = expr({
      parts: [
        part({ id: 'a', count: 1, sides: 6 }),
        part({ id: 'b', count: 20, sides: 20, keep: { type: 'highest', n: 3 } }),
      ],
    });
    expect(expressionTooComplex(e)).toBe(true);
  });

  it('all-plain expression is not too complex', () => {
    const e = expr({
      parts: [
        part({ id: 'a', count: 4, sides: 6 }),
        part({ id: 'b', count: 2, sides: 8 }),
      ],
    });
    expect(expressionTooComplex(e)).toBe(false);
  });
});

describe('engine guard — early return on too-complex inputs', () => {
  it('partDistribution(20d20kh3) returns empty within 50 ms', () => {
    const p = part({ count: 20, sides: 20, keep: { type: 'highest', n: 3 } });
    const t0 = performance.now();
    const d = partDistribution(p);
    const elapsed = performance.now() - t0;
    expect(d.size).toBe(0);
    expect(elapsed).toBeLessThan(50);
  });

  it('expressionDistribution with a runaway part returns empty within 50 ms', () => {
    const e = expr({
      parts: [
        part({ id: 'a', count: 1, sides: 6 }),
        part({ id: 'b', count: 20, sides: 20, keep: { type: 'highest', n: 3 } }),
      ],
    });
    const t0 = performance.now();
    const d = expressionDistribution(e);
    const elapsed = performance.now() - t0;
    expect(d.size).toBe(0);
    expect(elapsed).toBeLessThan(50);
  });

  it('4d6kh3 still produces a distribution', () => {
    const d = partDistribution(
      part({ count: 4, sides: 6, keep: { type: 'highest', n: 3 } }),
    );
    expect(d.size).toBeGreaterThan(0);
  });
});
