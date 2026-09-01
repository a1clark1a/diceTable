import { describe, expect, it } from 'vitest';
import type { DicePart, Expression } from '../types';
import {
  expressionNotation,
  modifierNotation,
  partNotation,
  partsNotation,
} from './notation';

function part(
  count: number,
  sides: number,
  extra: Omit<DicePart, 'id' | 'count' | 'sides'> = {},
): DicePart {
  return { id: `p-${count}d${sides}`, count, sides, ...extra };
}

function expr(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'expr-1',
    name: 'Roll',
    parts: [part(2, 6)],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

describe('partNotation', () => {
  it('renders a plain part as count-d-sides', () => {
    expect(partNotation(part(2, 6))).toBe('2d6');
  });

  it('renders a zero-count part rather than dropping it', () => {
    expect(partNotation(part(0, 6))).toBe('0d6');
  });

  it('appends kh for a keep-highest rule', () => {
    expect(partNotation(part(4, 6, { keep: { type: 'highest', n: 3 } }))).toBe('4d6kh3');
  });

  it('appends kl for a keep-lowest rule', () => {
    expect(partNotation(part(2, 20, { keep: { type: 'lowest', n: 1 } }))).toBe('2d20kl1');
  });

  it('lists the rerolled faces in ascending order', () => {
    const p = part(4, 6, { reroll: { values: [3, 1, 2], mode: 'once' } });
    expect(partNotation(p)).toBe('4d6 reroll 1,2,3s once');
  });

  it('names the reroll mode when it repeats', () => {
    const p = part(2, 6, { reroll: { values: [1], mode: 'always' } });
    expect(partNotation(p)).toBe('2d6 reroll 1s always');
  });

  it('leaves the reroll out when no faces are listed', () => {
    const p = part(2, 6, { reroll: { values: [], mode: 'once' } });
    expect(partNotation(p)).toBe('2d6');
  });

  it('names the exploding faces', () => {
    const p = part(1, 6, { explode: { onFaces: [6], depthCap: 10 } });
    expect(partNotation(p)).toBe('1d6 explode 6');
  });

  it('leaves the depth cap out at the default depth of ten', () => {
    const p = part(1, 6, { explode: { onFaces: [5, 6], depthCap: 10 } });
    expect(partNotation(p)).toBe('1d6 explode 5,6');
  });

  it('spells out a depth cap other than ten', () => {
    const p = part(1, 6, { explode: { onFaces: [6], depthCap: 3 } });
    expect(partNotation(p)).toBe('1d6 explode 6(cap 3)');
  });

  it('spells out a depth cap of zero', () => {
    const p = part(1, 6, { explode: { onFaces: [6], depthCap: 0 } });
    expect(partNotation(p)).toBe('1d6 explode 6(cap 0)');
  });

  it('leaves the explode out when no faces are listed', () => {
    const p = part(2, 6, { explode: { onFaces: [], depthCap: 3 } });
    expect(partNotation(p)).toBe('2d6');
  });

  it('sorts the rerolled faces without reordering the rule it was handed', () => {
    const values = [3, 1, 2];
    partNotation(part(4, 6, { reroll: { values, mode: 'once' } }));
    expect(values).toEqual([3, 1, 2]);
  });

  it('sorts the exploding faces without reordering the rule it was handed', () => {
    const onFaces = [6, 5];
    partNotation(part(1, 6, { explode: { onFaces, depthCap: 10 } }));
    expect(onFaces).toEqual([6, 5]);
  });

  it('renders keep, reroll and explode together in that order', () => {
    const p = part(4, 6, {
      keep: { type: 'highest', n: 3 },
      reroll: { values: [1], mode: 'once' },
      explode: { onFaces: [6], depthCap: 2 },
    });
    expect(partNotation(p)).toBe('4d6kh3 reroll 1s once explode 6(cap 2)');
  });
});

describe('partsNotation', () => {
  it('joins several parts with a plus', () => {
    expect(partsNotation([part(2, 6), part(1, 4)], '(no parts)')).toBe('2d6 + 1d4');
  });

  it('renders a single part on its own', () => {
    expect(partsNotation([part(1, 20)], '(no parts)')).toBe('1d20');
  });

  it('returns the fallback for an empty part list', () => {
    expect(partsNotation([], '(no parts)')).toBe('(no parts)');
  });

  it('returns whichever fallback string it was given', () => {
    expect(partsNotation([], '(no effect)')).toBe('(no effect)');
  });
});

describe('modifierNotation', () => {
  it('writes a positive modifier with a plus', () => {
    expect(modifierNotation(3)).toBe(' + 3');
  });

  it('writes a negative modifier with a minus sign and no sign on the number', () => {
    expect(modifierNotation(-2)).toBe(' − 2');
  });

  it('writes nothing for a zero modifier', () => {
    expect(modifierNotation(0)).toBe('');
  });

  it('writes nothing for negative zero', () => {
    expect(modifierNotation(-0)).toBe('');
  });

  it('writes nothing for NaN', () => {
    expect(modifierNotation(Number.NaN)).toBe('');
  });
});

describe('expressionNotation for sum rows', () => {
  it('adds a positive modifier to the dice', () => {
    expect(expressionNotation(expr({ flatModifier: 3 }))).toBe('2d6 + 3');
  });

  it('subtracts a negative modifier from the dice', () => {
    expect(expressionNotation(expr({ flatModifier: -2 }))).toBe('2d6 − 2');
  });

  it('leaves a zero modifier off entirely', () => {
    expect(expressionNotation(expr({ flatModifier: 0 }))).toBe('2d6');
  });

  it('joins several parts with a plus before the modifier', () => {
    const e = expr({ parts: [part(1, 8), part(2, 4)], flatModifier: 1 });
    expect(expressionNotation(e)).toBe('1d8 + 2d4 + 1');
  });

  it('carries the keep and reroll tokens through from the parts', () => {
    const e = expr({
      parts: [part(4, 6, { keep: { type: 'highest', n: 3 } })],
      flatModifier: 0,
    });
    expect(expressionNotation(e)).toBe('4d6kh3');
  });

  it('falls back to (no parts) when the row has no dice', () => {
    expect(expressionNotation(expr({ parts: [] }))).toBe('(no parts)');
  });

  it('still shows the modifier on a row with no dice', () => {
    expect(expressionNotation(expr({ parts: [], flatModifier: 2 }))).toBe('(no parts) + 2');
  });

  it('marks an advantage row with adv', () => {
    expect(expressionNotation(expr({ rollMode: 'advantage' }))).toBe('2d6 adv');
  });

  it('marks a disadvantage row with dis', () => {
    expect(expressionNotation(expr({ rollMode: 'disadvantage' }))).toBe('2d6 dis');
  });

  it('puts the roll mode after the modifier', () => {
    const e = expr({ flatModifier: 4, rollMode: 'advantage' });
    expect(expressionNotation(e)).toBe('2d6 + 4 adv');
  });

  it('names a keep-across-the-row rule at the end', () => {
    const e = expr({
      parts: [part(1, 8), part(1, 6)],
      keepAcross: { type: 'highest', n: 1 },
    });
    expect(expressionNotation(e)).toBe('1d8 + 1d6 · keep highest 1');
  });

  it('names a keep-lowest-across-the-row rule', () => {
    const e = expr({
      parts: [part(1, 8), part(1, 6)],
      keepAcross: { type: 'lowest', n: 2 },
    });
    expect(expressionNotation(e)).toBe('1d8 + 1d6 · keep lowest 2');
  });

  it('puts keep-across after the roll mode', () => {
    const e = expr({
      parts: [part(1, 8), part(1, 6)],
      rollMode: 'disadvantage',
      keepAcross: { type: 'highest', n: 1 },
    });
    expect(expressionNotation(e)).toBe('1d8 + 1d6 dis · keep highest 1');
  });
});

describe('expressionNotation for pool rows', () => {
  const pool = (overrides: Partial<Expression> = {}): Expression =>
    expr({
      mode: 'pool',
      parts: [part(8, 6)],
      successThreshold: { direction: 'gte', value: 5 },
      ...overrides,
    });

  it('counts successes at or above the threshold', () => {
    expect(expressionNotation(pool())).toBe('8d6 · count ≥5');
  });

  it('counts successes at or below the threshold', () => {
    const e = pool({ successThreshold: { direction: 'lte', value: 2 } });
    expect(expressionNotation(e)).toBe('8d6 · count ≤2');
  });

  it('shows only the dice when no threshold is set yet', () => {
    const e = expr({ mode: 'pool', parts: [part(8, 6)] });
    expect(expressionNotation(e)).toBe('8d6');
  });

  it('falls back to (no parts) when the pool has no dice', () => {
    expect(expressionNotation(pool({ parts: [] }))).toBe('(no parts) · count ≥5');
  });

  it('names added automatic successes', () => {
    expect(expressionNotation(pool({ flatModifier: 2 }))).toBe('8d6 · count ≥5 · +2 auto');
  });

  it('names removed automatic successes without a doubled sign', () => {
    expect(expressionNotation(pool({ flatModifier: -1 }))).toBe('8d6 · count ≥5 · −1 auto');
  });

  it('leaves the automatic successes out when the modifier is zero', () => {
    expect(expressionNotation(pool({ flatModifier: 0 }))).toBe('8d6 · count ≥5');
  });

  it('joins several dice groups in the pool', () => {
    const e = pool({ parts: [part(8, 6), part(2, 10)] });
    expect(expressionNotation(e)).toBe('8d6 + 2d10 · count ≥5');
  });

  it('leaves the roll mode and keep-across off, the way the pool math does', () => {
    const e = pool({
      rollMode: 'advantage',
      keepAcross: { type: 'highest', n: 1 },
    });
    expect(expressionNotation(e)).toBe('8d6 · count ≥5');
  });
});

describe('expressionNotation for check rows', () => {
  const check = (overrides: Partial<Expression> = {}): Expression =>
    expr({
      mode: 'check',
      parts: [part(1, 20)],
      flatModifier: 7,
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [part(1, 8)], flatModifier: 4 },
        onSuccess: 'full',
        onFailure: 'none',
      },
      ...overrides,
    });

  it('points the check roll at its effect with an at-least arrow', () => {
    expect(expressionNotation(check())).toBe('1d20 + 7 ≥15 → 1d8 + 4');
  });

  it('points the check roll at its effect with an at-most arrow', () => {
    const e = check({
      check: {
        threshold: { direction: 'lte', value: 9 },
        effect: { parts: [part(1, 8)], flatModifier: 0 },
        onSuccess: 'full',
        onFailure: 'none',
      },
      flatModifier: 0,
    });
    expect(expressionNotation(e)).toBe('1d20 ≤9 → 1d8');
  });

  it('falls back to (no effect) when the effect has no dice', () => {
    const e = check({
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [], flatModifier: 0 },
        onSuccess: 'full',
        onFailure: 'none',
      },
      flatModifier: 0,
    });
    expect(expressionNotation(e)).toBe('1d20 ≥15 → (no effect)');
  });

  it('puts the roll mode on the check roll, before the arrow', () => {
    expect(expressionNotation(check({ rollMode: 'advantage' }))).toBe(
      '1d20 + 7 adv ≥15 → 1d8 + 4',
    );
  });

  it('says nothing about the default full-on-success, nothing-on-failure scales', () => {
    const rendered = expressionNotation(check());
    expect(rendered).toBe('1d20 + 7 ≥15 → 1d8 + 4');
    expect(rendered).not.toContain('on a success');
    expect(rendered).not.toContain('on a failure');
  });

  it('names a half effect on a success', () => {
    const e = check({
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [part(1, 8)], flatModifier: 4 },
        onSuccess: 'half',
        onFailure: 'none',
      },
    });
    expect(expressionNotation(e)).toBe('1d20 + 7 ≥15 → 1d8 + 4 · half on a success');
  });

  it('names nothing on a success', () => {
    const e = check({
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [part(1, 8)], flatModifier: 4 },
        onSuccess: 'none',
        onFailure: 'none',
      },
    });
    expect(expressionNotation(e)).toBe('1d20 + 7 ≥15 → 1d8 + 4 · nothing on a success');
  });

  it('names a half effect on a failure', () => {
    const e = check({
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [part(1, 8)], flatModifier: 4 },
        onSuccess: 'full',
        onFailure: 'half',
      },
    });
    expect(expressionNotation(e)).toBe('1d20 + 7 ≥15 → 1d8 + 4 · half on a failure');
  });

  it('names both scales when neither is the default', () => {
    const e = check({
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [part(1, 8)], flatModifier: 4 },
        onSuccess: 'half',
        onFailure: 'full',
      },
    });
    expect(expressionNotation(e)).toBe(
      '1d20 + 7 ≥15 → 1d8 + 4 · half on a success · full on a failure',
    );
  });

  it('names a crit that doubles the dice', () => {
    const e = check({
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [part(1, 8)], flatModifier: 4 },
        onSuccess: 'full',
        onFailure: 'none',
        crit: { onFaces: [20], effect: 'doubleDice' },
      },
    });
    expect(expressionNotation(e)).toBe('1d20 + 7 ≥15 → 1d8 + 4 · crit 20 ×dice');
  });

  it('names a crit that adds a die and sorts its faces', () => {
    const e = check({
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [part(1, 8)], flatModifier: 0 },
        onSuccess: 'full',
        onFailure: 'none',
        crit: { onFaces: [20, 19], effect: 'extraDie' },
      },
      flatModifier: 0,
    });
    expect(expressionNotation(e)).toBe('1d20 ≥15 → 1d8 · crit 19,20 +1 die');
  });

  it('names a crit that takes the maximum plus a roll', () => {
    const e = check({
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [part(1, 8)], flatModifier: 0 },
        onSuccess: 'full',
        onFailure: 'none',
        crit: { onFaces: [20], effect: 'maxPlusRoll' },
      },
      flatModifier: 0,
    });
    expect(expressionNotation(e)).toBe('1d20 ≥15 → 1d8 · crit 20 max+roll');
  });

  it('names a keep-across rule on the effect, before the scales', () => {
    const e = check({
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: {
          parts: [part(1, 8), part(1, 6)],
          flatModifier: 2,
          keepAcross: { type: 'highest', n: 1 },
        },
        onSuccess: 'half',
        onFailure: 'none',
      },
      flatModifier: 0,
    });
    expect(expressionNotation(e)).toBe(
      '1d20 ≥15 → 1d8 + 1d6 + 2 · keep highest 1 · half on a success',
    );
  });

  it('orders the effect, its scales and the crit in one sentence', () => {
    const e = check({
      check: {
        threshold: { direction: 'lte', value: 4 },
        effect: {
          parts: [part(2, 6)],
          flatModifier: -1,
          keepAcross: { type: 'lowest', n: 1 },
        },
        onSuccess: 'half',
        onFailure: 'full',
        crit: { onFaces: [1], effect: 'doubleDice' },
      },
      flatModifier: -3,
    });
    expect(expressionNotation(e)).toBe(
      '1d20 − 3 ≤4 → 2d6 − 1 · keep lowest 1 · half on a success · full on a failure · crit 1 ×dice',
    );
  });

  it('leaves a keep-across on the check roll off, the way the check math does', () => {
    const e = check({ keepAcross: { type: 'highest', n: 1 } });
    expect(expressionNotation(e)).toBe('1d20 + 7 ≥15 → 1d8 + 4');
  });

  it('sorts the crit faces without reordering the rule it was handed', () => {
    const onFaces = [20, 19];
    const e = check({
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [part(1, 8)], flatModifier: 4 },
        onSuccess: 'full',
        onFailure: 'none',
        crit: { onFaces, effect: 'extraDie' },
      },
    });
    expect(expressionNotation(e)).toBe('1d20 + 7 ≥15 → 1d8 + 4 · crit 19,20 +1 die');
    expect(onFaces).toEqual([20, 19]);
  });

  it('reads as a plain sum row when the check spec is missing', () => {
    const e = expr({ mode: 'check', flatModifier: 1 });
    expect(expressionNotation(e)).toBe('2d6 + 1');
  });
});
