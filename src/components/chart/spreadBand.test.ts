import { describe, expect, it } from 'vitest';
import { uniformDistribution } from '../../engine/distribution';
import { expressionDistribution } from '../../engine/expression';
import { partDistribution } from '../../engine/parts';
import type { Expression } from '../../types';
import { spreadBand } from './spreadBand';

describe('spreadBand', () => {
  it('draws 4 to 10 on 2d6', () => {
    expect(spreadBand(partDistribution({ id: 'p', count: 2, sides: 6 }))).toEqual([4, 10]);
  });

  it('draws nothing on a flat 1d20, which has no middle where most land', () => {
    expect(spreadBand(uniformDistribution(20))).toBeNull();
  });

  it('draws nothing on a flat die shifted by a modifier', () => {
    const plusThree = new Map([...uniformDistribution(12)].map(([k, p]) => [k + 3, p]));
    expect(spreadBand(plusThree)).toBeNull();
  });

  // The middle 80% of a d8 already reaches both ends, so a band would shade
  // the whole curve and say nothing.
  it('draws nothing on a flat 1d8, where the band would cover every result', () => {
    expect(spreadBand(uniformDistribution(8))).toBeNull();
  });

  it('draws nothing on an empty distribution', () => {
    expect(spreadBand(new Map<number, number>())).toBeNull();
  });

  it('draws nothing on a single-value distribution', () => {
    expect(spreadBand(new Map([[5, 1]]))).toBeNull();
  });

  // Five d6 succeeding on 5 or 6: no successes 32/243 (past 10%), up to three
  // 232/243 (past 90%), and the pool can reach five.
  it('sits on the successes scale for a pool row', () => {
    const pool: Expression = {
      id: 'pool',
      name: 'Pool',
      parts: [{ id: 'p', count: 5, sides: 6 }],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 5 },
    };
    expect(spreadBand(expressionDistribution(pool))).toEqual([0, 3]);
  });

  // 1d20 needing 15 misses 70% of the time and lands on 0; a hit rolls 1d8+4
  // (5 to 12, 3.75% each), so the running total first passes 90% at 10.
  it('starts at 0 on a check row that misses often', () => {
    const check: Expression = {
      id: 'check',
      name: 'Check',
      parts: [{ id: 'c', count: 1, sides: 20 }],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'check',
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [{ id: 'e', count: 1, sides: 8 }], flatModifier: 4 },
        onSuccess: 'full',
        onFailure: 'none',
      },
    };
    expect(spreadBand(expressionDistribution(check))).toEqual([0, 10]);
  });
});
