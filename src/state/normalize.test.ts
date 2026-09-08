import { describe, expect, it } from 'vitest';
import { normalizeExpression } from './normalize';
import { validateExpression } from './persistedSchema';
import type { CheckSpec, Expression } from '../types';

function checkSpec(overrides: Partial<CheckSpec> = {}): CheckSpec {
  return {
    threshold: { direction: 'gte', value: 10 },
    effect: { parts: [{ id: 'fx', count: 1, sides: 6 }], flatModifier: 0 },
    onSuccess: 'full',
    onFailure: 'none',
    ...overrides,
  };
}

function checkRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e0',
    name: 'Check row',
    parts: [{ id: 'p0', count: 1, sides: 20 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'check',
    check: checkSpec(),
    ...overrides,
  };
}

function sumRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e0',
    name: 'Sum row',
    parts: [{ id: 'p0', count: 1, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

describe('normalizeExpression critical face clamping', () => {
  it('drops crit faces the shrunken check die can no longer show', () => {
    const row = checkRow({
      parts: [{ id: 'p0', count: 1, sides: 6 }],
      check: checkSpec({ crit: { onFaces: [5, 20], effect: 'doubleDice' } }),
    });
    expect(normalizeExpression(row).check?.crit).toEqual({
      onFaces: [5],
      effect: 'doubleDice',
    });
  });

  it('drops the whole critical when no face survives the clamp', () => {
    const row = checkRow({
      parts: [{ id: 'p0', count: 1, sides: 6 }],
      check: checkSpec({ crit: { onFaces: [19, 20], effect: 'doubleDice' } }),
    });
    expect(normalizeExpression(row).check?.crit).toBeUndefined();
  });

  it('keeps a critical whose faces the die can all show', () => {
    const row = checkRow({
      check: checkSpec({ crit: { onFaces: [19, 20], effect: 'extraDie' } }),
    });
    expect(normalizeExpression(row)).toBe(row);
  });

  it('drops the critical when the check rolls more than one die', () => {
    const row = checkRow({
      parts: [{ id: 'p0', count: 2, sides: 20 }],
      check: checkSpec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
    });
    expect(normalizeExpression(row).check?.crit).toBeUndefined();
  });

  it('drops the critical when the check has more than one part', () => {
    const row = checkRow({
      parts: [
        { id: 'p0', count: 1, sides: 20 },
        { id: 'p1', count: 1, sides: 4 },
      ],
      check: checkSpec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
    });
    expect(normalizeExpression(row).check?.crit).toBeUndefined();
  });

  it('leaves the rest of the spec intact when the critical goes', () => {
    const row = checkRow({
      parts: [{ id: 'p0', count: 1, sides: 6 }],
      check: checkSpec({
        onFailure: 'half',
        crit: { onFaces: [20], effect: 'doubleDice' },
      }),
    });
    const repaired = normalizeExpression(row);
    expect(repaired.check?.threshold).toEqual({ direction: 'gte', value: 10 });
    expect(repaired.check?.onFailure).toBe('half');
    expect(repaired.check?.effect).toEqual(row.check?.effect);
  });
});

describe('normalizeExpression keep exclusivity', () => {
  it('strips per-part keeps when the row keeps across parts', () => {
    const row = sumRow({
      parts: [
        { id: 'p0', count: 2, sides: 6, keep: { type: 'highest', n: 1 } },
        { id: 'p1', count: 1, sides: 8 },
      ],
      keepAcross: { type: 'highest', n: 2 },
    });
    const repaired = normalizeExpression(row);
    expect(repaired.keepAcross).toEqual({ type: 'highest', n: 2 });
    expect(repaired.parts[0]?.keep).toBeUndefined();
  });

  it('strips effect-part keeps when the effect keeps across parts', () => {
    const row = checkRow({
      check: checkSpec({
        effect: {
          parts: [
            { id: 'fx0', count: 2, sides: 6, keep: { type: 'lowest', n: 1 } },
            { id: 'fx1', count: 1, sides: 8 },
          ],
          flatModifier: 0,
          keepAcross: { type: 'highest', n: 2 },
        },
      }),
    });
    const repaired = normalizeExpression(row);
    expect(repaired.check?.effect.keepAcross).toEqual({ type: 'highest', n: 2 });
    expect(repaired.check?.effect.parts[0]?.keep).toBeUndefined();
    expect(repaired.check?.effect.parts[1]).toBe(row.check?.effect.parts[1]);
  });
});

describe('normalizeExpression mode-field cleanup', () => {
  it('strips keep, explode, keepAcross and check from a pool row but keeps reroll', () => {
    const row = sumRow({
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 4 },
      parts: [
        {
          id: 'p0',
          count: 4,
          sides: 6,
          keep: { type: 'highest', n: 3 },
          explode: { onFaces: [6], depthCap: 10 },
          reroll: { values: [1], mode: 'once' },
        },
      ],
      keepAcross: { type: 'highest', n: 2 },
      check: checkSpec(),
    });
    const repaired = normalizeExpression(row);
    expect(repaired.parts[0]?.keep).toBeUndefined();
    expect(repaired.parts[0]?.explode).toBeUndefined();
    expect(repaired.parts[0]?.reroll).toEqual({ values: [1], mode: 'once' });
    expect(repaired.keepAcross).toBeUndefined();
    expect(repaired.check).toBeUndefined();
    expect(repaired.successThreshold).toEqual({ direction: 'gte', value: 4 });
  });

  it('strips successThreshold and keepAcross from a check row', () => {
    const row = checkRow({
      successThreshold: { direction: 'gte', value: 4 },
      keepAcross: { type: 'highest', n: 1 },
    });
    const repaired = normalizeExpression(row);
    expect(repaired.successThreshold).toBeUndefined();
    expect(repaired.keepAcross).toBeUndefined();
    expect(repaired.check).toBeDefined();
  });

  it('strips successThreshold and check from a sum row', () => {
    const row = sumRow({
      successThreshold: { direction: 'gte', value: 4 },
      check: checkSpec(),
    });
    const repaired = normalizeExpression(row);
    expect(repaired.successThreshold).toBeUndefined();
    expect(repaired.check).toBeUndefined();
  });
});

describe('normalizeExpression contract', () => {
  it('returns the same object when nothing needs repair', () => {
    const clean = sumRow();
    expect(normalizeExpression(clean)).toBe(clean);
  });

  it('does not mutate the input when it repairs', () => {
    const row = checkRow({
      parts: [{ id: 'p0', count: 1, sides: 6 }],
      check: checkSpec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
    });
    normalizeExpression(row);
    expect(row.check?.crit).toEqual({ onFaces: [20], effect: 'doubleDice' });
  });

  // The whole point of the repair step: a normalized row must never be the row
  // that makes the validator drop the user's saved table.
  it('every repaired shape survives the validator', () => {
    const broken: Expression[] = [
      checkRow({
        parts: [{ id: 'p0', count: 1, sides: 6 }],
        check: checkSpec({ crit: { onFaces: [19, 20], effect: 'doubleDice' } }),
      }),
      checkRow({
        parts: [{ id: 'p0', count: 2, sides: 20 }],
        check: checkSpec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
      }),
      sumRow({
        parts: [{ id: 'p0', count: 2, sides: 6, keep: { type: 'highest', n: 1 } }],
        keepAcross: { type: 'highest', n: 1 },
      }),
      sumRow({ check: checkSpec() }),
      sumRow({ successThreshold: { direction: 'gte', value: 4 } }),
    ];
    for (const row of broken) {
      const repaired = normalizeExpression(row);
      expect(
        validateExpression(JSON.parse(JSON.stringify(repaired)) as unknown),
      ).not.toBeNull();
    }
  });
});
