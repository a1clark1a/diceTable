import { describe, expect, it } from 'vitest';
import { STARTER_PRESETS, STARTER_ROWS } from './starterRolls';
import { validateExpression } from '../state/persistedSchema';
import { expressionDistribution } from '../engine/expression';
import { computeRowStats } from '../state/rowStats';

const EXPECTED_ORDER = [
  'Weapon attack',
  'Two-hander',
  'Mixed dice',
  'Ability score',
  'Save DC check',
  'Check with advantage',
  'Success pool',
  'Keep the best die',
];

// Hand-computed: 4d6kh3 mean is 15869/1296; advantage on 1d20 is
// E[max of two] = 13.825, plus the +5 modifier; 2d6kh1 mean is 161/36;
// the pool is 7 Bernoulli(0.3) trials, so 2.1 successes.
const EXPECTED_STATS: Record<string, { mean: number; min: number; max: number }> = {
  'Weapon attack': { mean: 6.5, min: 3, max: 10 },
  'Two-hander': { mean: 10, min: 5, max: 15 },
  'Mixed dice': { mean: 9.5, min: 3, max: 16 },
  'Ability score': { mean: 15869 / 1296, min: 3, max: 18 },
  'Save DC check': { mean: 15.5, min: 6, max: 25 },
  'Check with advantage': { mean: 18.825, min: 6, max: 25 },
  'Success pool': { mean: 2.1, min: 0, max: 7 },
  'Keep the best die': { mean: 161 / 36, min: 1, max: 6 },
};

describe('STARTER_PRESETS', () => {
  it('contains the 8 handoff presets in handoff order', () => {
    expect(STARTER_PRESETS.map((p) => p.name)).toEqual(EXPECTED_ORDER);
    expect(STARTER_ROWS.map((e) => e.name)).toEqual(EXPECTED_ORDER);
  });

  it('every preset survives the persisted-state expression validator intact', () => {
    for (const expr of STARTER_ROWS) {
      const roundTripped: unknown = JSON.parse(JSON.stringify(expr));
      expect(validateExpression(roundTripped)).toEqual(expr);
    }
  });

  it('uses unique expression and part ids across all presets', () => {
    const ids = STARTER_ROWS.flatMap((e) => [
      e.id,
      ...e.parts.map((part) => part.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only the pool preset carries a successThreshold, counting 8+ on d10s', () => {
    for (const expr of STARTER_ROWS) {
      if (expr.name === 'Success pool') {
        expect(expr.mode).toBe('pool');
        expect(expr.successThreshold).toEqual({
          direction: 'gte',
          value: 8,
        });
      } else {
        expect(expr.mode).toBe('sum');
        expect('successThreshold' in expr).toBe(false);
      }
    }
  });

  it('computes hand-checked mean and range for every preset', () => {
    for (const expr of STARTER_ROWS) {
      const expected = EXPECTED_STATS[expr.name]!;
      const stats = computeRowStats(expressionDistribution(expr));
      expect(stats.hasDist).toBe(true);
      expect(stats.mean).toBeCloseTo(expected.mean, 12);
      expect(stats.min).toBe(expected.min);
      expect(stats.max).toBe(expected.max);
    }
  });
});
