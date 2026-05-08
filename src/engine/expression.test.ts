import { describe, expect, it } from 'vitest';
import type { Expression } from '../types';
import { totalMass } from './distribution';
import { applyRollMode, expressionDistribution } from './expression';
import { partDistribution } from './parts';
import { mean } from './stats';

const expr = (overrides: Partial<Expression>): Expression => ({
  id: 'e',
  name: 't',
  parts: [{ id: 'p', count: 1, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  ...overrides,
});

describe('applyRollMode', () => {
  it('advantage on 1d20 produces mean 13.825', () => {
    const d20 = partDistribution({ id: 'p', count: 1, sides: 20 });
    const adv = applyRollMode(d20, 'advantage');
    expect(mean(adv)).toBeCloseTo(13.825, 10);
    expect(totalMass(adv)).toBeCloseTo(1, 12);
  });

  it('disadvantage on 1d20 produces mean 7.175 (symmetric to advantage)', () => {
    const d20 = partDistribution({ id: 'p', count: 1, sides: 20 });
    const dis = applyRollMode(d20, 'disadvantage');
    expect(mean(dis)).toBeCloseTo(7.175, 10);
    expect(totalMass(dis)).toBeCloseTo(1, 12);
  });

  it('advantage PMF on 1d20: pmf(k) = (2k-1)/400', () => {
    const d20 = partDistribution({ id: 'p', count: 1, sides: 20 });
    const adv = applyRollMode(d20, 'advantage');
    for (let k = 1; k <= 20; k++) {
      expect(adv.get(k)).toBeCloseTo((2 * k - 1) / 400, 12);
    }
  });

  it('normal mode is a no-op', () => {
    const d6 = partDistribution({ id: 'p', count: 1, sides: 6 });
    const same = applyRollMode(d6, 'normal');
    for (const [k, p] of d6) expect(same.get(k)).toBeCloseTo(p, 12);
  });
});

describe('expressionDistribution', () => {
  it('1d6 + 2 shifts mean to 5.5', () => {
    const d = expressionDistribution(expr({ flatModifier: 2 }));
    expect(mean(d)).toBeCloseTo(5.5, 10);
    expect(d.get(3)).toBeCloseTo(1 / 6, 12);
    expect(d.get(8)).toBeCloseTo(1 / 6, 12);
  });

  it('multi-part expression sums via convolution: 1d6 + 1d4 mean = 6', () => {
    const d = expressionDistribution(expr({
      parts: [
        { id: 'a', count: 1, sides: 6 },
        { id: 'b', count: 1, sides: 4 },
      ],
    }));
    expect(mean(d)).toBeCloseTo(3.5 + 2.5, 10);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  it('4d6kh3 + 2 advantage = base mean shifted, then CDF-squared', () => {
    const d = expressionDistribution(expr({
      parts: [{ id: 'p', count: 4, sides: 6, keep: { type: 'highest', n: 3 } }],
      flatModifier: 2,
      rollMode: 'advantage',
    }));
    expect(totalMass(d)).toBeCloseTo(1, 9);
    // Advantage on a single roll of 4d6kh3 + 2 should beat the plain mean 12.2446 + 2.
    expect(mean(d)).toBeGreaterThan(15869 / 1296 + 2);
  });

  it('empty parts returns empty distribution', () => {
    expect(expressionDistribution(expr({ parts: [] })).size).toBe(0);
  });

  it('an invalid part poisons the whole expression', () => {
    expect(expressionDistribution(expr({
      parts: [
        { id: 'a', count: 1, sides: 6 },
        { id: 'b', count: 0, sides: 6 },
      ],
    })).size).toBe(0);
  });
});
