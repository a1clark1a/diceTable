import { describe, expect, it } from 'vitest';
import { STARTER_PRESETS } from './starterRolls';
import { validateExpression } from '../state/persistedSchema';

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
    expect(STARTER_PRESETS.map((p) => p.expr.name)).toEqual(EXPECTED_ORDER);
  });

  it('every preset survives the persisted-state expression validator intact', () => {
    for (const preset of STARTER_PRESETS) {
      const roundTripped: unknown = JSON.parse(JSON.stringify(preset.expr));
      expect(validateExpression(roundTripped)).toEqual(preset.expr);
    }
  });

  it('uses unique expression and part ids across all presets', () => {
    const ids = STARTER_PRESETS.flatMap((p) => [
      p.expr.id,
      ...p.expr.parts.map((part) => part.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only the pool preset carries a successThreshold, counting 8+ on d10s', () => {
    for (const preset of STARTER_PRESETS) {
      if (preset.expr.name === 'Success pool') {
        expect(preset.expr.mode).toBe('pool');
        expect(preset.expr.successThreshold).toEqual({
          direction: 'gte',
          value: 8,
        });
      } else {
        expect(preset.expr.mode).toBe('sum');
        expect('successThreshold' in preset.expr).toBe(false);
      }
    }
  });

  it('computes hand-checked mean and range for every preset', () => {
    for (const preset of STARTER_PRESETS) {
      const expected = EXPECTED_STATS[preset.expr.name]!;
      expect(preset.stats.hasDist).toBe(true);
      expect(preset.stats.mean).toBeCloseTo(expected.mean, 12);
      expect(preset.stats.min).toBe(expected.min);
      expect(preset.stats.max).toBe(expected.max);
    }
  });
});
