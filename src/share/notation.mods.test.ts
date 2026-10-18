import { describe, expect, it } from 'vitest';
import type { DicePart, Expression, ModStep } from '../types';
import {
  chainLayout,
  expressionNotation,
  modsCompact,
  modStepAria,
  poolStepText,
  sumChainNotation,
} from './notation';

function part(
  count: number,
  sides: number,
  extra: Omit<DicePart, 'id' | 'count' | 'sides'> = {},
): DicePart {
  return { id: `p-${count}d${sides}`, count, sides, ...extra };
}

function sumRow(mods: ModStep[] | undefined, overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'expr-1',
    name: 'Roll',
    parts: [part(2, 6)],
    flatModifier: 0,
    ...(mods === undefined ? {} : { mods }),
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function poolRow(mods: ModStep[] | undefined): Expression {
  return {
    id: 'expr-pool',
    name: 'Pool',
    parts: [part(7, 10)],
    flatModifier: 0,
    ...(mods === undefined ? {} : { mods }),
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 8 },
  };
}

const add = (value: number): ModStep => ({ op: 'add', value });
const sub = (value: number): ModStep => ({ op: 'sub', value });
const mul = (value: number): ModStep => ({ op: 'mul', value });
const div = (value: number): ModStep => ({ op: 'div', value });

describe('expressionNotation for a sum row with a chain', () => {
  it('reads a lone add the way the modifier always read', () => {
    expect(expressionNotation(sumRow([add(3)]))).toBe('2d6 + 3');
  });

  it('reads a lone subtract the way a negative modifier always read', () => {
    expect(expressionNotation(sumRow([sub(2)]))).toBe('2d6 − 2');
  });

  it('reads a row with no chain as its dice alone', () => {
    expect(expressionNotation(sumRow(undefined))).toBe('2d6');
  });

  it('brackets the added total before a multiply', () => {
    expect(expressionNotation(sumRow([add(3), mul(2)]))).toBe('(2d6 + 3) × 2');
  });

  it('brackets the subtracted total before a multiply', () => {
    expect(expressionNotation(sumRow([sub(1), mul(2)]))).toBe('(2d6 − 1) × 2');
  });

  it('brackets the added total before a divide', () => {
    expect(expressionNotation(sumRow([add(3), div(2)]))).toBe('(2d6 + 3) ÷ 2');
  });

  it('needs no brackets when the multiply comes first', () => {
    expect(expressionNotation(sumRow([mul(2), add(3)]))).toBe('2d6 × 2 + 3');
  });

  it('needs no brackets between a multiply and a divide', () => {
    expect(expressionNotation(sumRow([mul(2), div(3)]))).toBe('2d6 × 2 ÷ 3');
  });

  it('reads a lone multiply on one die group without brackets', () => {
    expect(expressionNotation(sumRow([mul(2)]))).toBe('2d6 × 2');
  });

  it('reads a lone divide on one die group without brackets', () => {
    expect(expressionNotation(sumRow([div(2)]))).toBe('2d6 ÷ 2');
  });

  it('brackets two die groups before a multiply', () => {
    const row = sumRow([mul(2)], { parts: [part(2, 6), part(1, 4)] });
    expect(expressionNotation(row)).toBe('(2d6 + 1d4) × 2');
  });

  it('nests a second bracket when an add sits between two scaling steps', () => {
    const row = sumRow([mul(2), add(3), div(2)], { parts: [part(2, 6), part(1, 4)] });
    expect(expressionNotation(row)).toBe('((2d6 + 1d4) × 2 + 3) ÷ 2');
  });

  it('brackets an exploding die before a multiply', () => {
    const row = sumRow([mul(2)], { parts: [part(1, 6, { explode: { onFaces: [6], depthCap: 10 } })] });
    expect(expressionNotation(row)).toBe('(1d6 explode 6) × 2');
  });

  it('brackets a rerolling die before a multiply', () => {
    const row = sumRow([mul(2)], { parts: [part(2, 6, { reroll: { values: [1], mode: 'once' } })] });
    expect(expressionNotation(row)).toBe('(2d6 reroll 1s once) × 2');
  });

  it('needs no brackets around a keep rule, which has no space in it', () => {
    const row = sumRow([mul(2)], { parts: [part(4, 6, { keep: { type: 'highest', n: 3 } })] });
    expect(expressionNotation(row)).toBe('4d6kh3 × 2');
  });

  it('puts advantage after the whole chain', () => {
    expect(expressionNotation(sumRow([add(3), mul(2)], { rollMode: 'advantage' }))).toBe(
      '(2d6 + 3) × 2 adv',
    );
  });

  it('puts disadvantage after the whole chain', () => {
    expect(expressionNotation(sumRow([mul(2), add(3)], { rollMode: 'disadvantage' }))).toBe(
      '2d6 × 2 + 3 dis',
    );
  });

  it('puts keep-across after the chain', () => {
    const row = sumRow([add(1), mul(2)], {
      parts: [part(1, 8), part(1, 6)],
      keepAcross: { type: 'highest', n: 1 },
    });
    expect(expressionNotation(row)).toBe('(1d8 + 1d6 + 1) × 2 · keep highest 1');
  });

  it('puts keep-across after the chain and the roll mode', () => {
    const row = sumRow([mul(2)], {
      parts: [part(1, 8), part(1, 6)],
      rollMode: 'advantage',
      keepAcross: { type: 'highest', n: 1 },
    });
    expect(expressionNotation(row)).toBe('(1d8 + 1d6) × 2 adv · keep highest 1');
  });
});

describe('expressionNotation for a pool row with a chain', () => {
  it('names added successes as automatic, then a multiply as its own segment', () => {
    expect(expressionNotation(poolRow([add(2), mul(2)]))).toBe('7d10 · count ≥8 · +2 auto · × 2');
  });

  it('never calls a multiply automatic successes', () => {
    expect(expressionNotation(poolRow([mul(2)]))).toBe('7d10 · count ≥8 · × 2');
  });

  it('gives a divide its own segment', () => {
    expect(expressionNotation(poolRow([sub(1), div(2)]))).toBe('7d10 · count ≥8 · −1 auto · ÷ 2');
  });

  it('keeps the steps in the order they apply', () => {
    expect(expressionNotation(poolRow([mul(2), add(1)]))).toBe('7d10 · count ≥8 · × 2 · +1 auto');
  });

  it('never brackets a pool, whose segments already read in order', () => {
    expect(expressionNotation(poolRow([add(2), mul(2)]))).not.toContain('(');
  });
});

describe('expressionNotation for a check row', () => {
  const checkRow = (overrides: Partial<Expression> = {}): Expression => ({
    id: 'expr-check',
    name: 'Save',
    parts: [part(1, 20)],
    flatModifier: 5,
    rollMode: 'normal',
    mode: 'check',
    check: {
      threshold: { direction: 'gte', value: 15 },
      effect: { parts: [part(1, 8)], flatModifier: 0 },
      onSuccess: 'full',
      onFailure: 'none',
    },
    ...overrides,
  });

  it('still adds flatModifier to the check roll', () => {
    expect(expressionNotation(checkRow())).toBe('1d20 + 5 ≥15 → 1d8');
  });

  it('shows no chain left on a check row, the way the check math ignores it', () => {
    expect(expressionNotation(checkRow({ mods: [mul(2)] }))).toBe('1d20 + 5 ≥15 → 1d8');
  });
});

describe('sumChainNotation', () => {
  it('returns the dice alone when there is no chain', () => {
    expect(sumChainNotation('2d6', undefined)).toBe('2d6');
  });

  it('returns the dice alone for an empty chain', () => {
    expect(sumChainNotation('2d6', [])).toBe('2d6');
  });
});

describe('poolStepText', () => {
  it('names an add as automatic successes', () => {
    expect(poolStepText(add(2))).toBe('+2 auto');
  });

  it('names a subtract as automatic successes with one minus sign', () => {
    expect(poolStepText(sub(1))).toBe('−1 auto');
  });

  it('writes a multiply as a symbol and a number', () => {
    expect(poolStepText(mul(2))).toBe('× 2');
  });

  it('writes a divide as a symbol and a number', () => {
    expect(poolStepText(div(3))).toBe('÷ 3');
  });
});

describe('modsCompact', () => {
  it('writes each step with its symbol against its number, spaced apart', () => {
    expect(modsCompact([add(3), mul(2), div(3)])).toBe('+3 ×2 ÷3');
  });

  it('writes a subtract with a minus sign, not a hyphen', () => {
    expect(modsCompact([sub(2)])).toBe('−2');
  });

  it('writes nothing for an empty chain', () => {
    expect(modsCompact([])).toBe('');
  });
});

describe('modStepAria', () => {
  it('says plus for an add on a sum row', () => {
    expect(modStepAria(add(3), false)).toBe('plus 3');
  });

  it('says automatic successes for an add on a pool row', () => {
    expect(modStepAria(add(3), true)).toBe('plus 3 automatic successes');
  });

  it('says minus for a subtract on a sum row', () => {
    expect(modStepAria(sub(2), false)).toBe('minus 2');
  });

  it('says automatic successes for a subtract on a pool row', () => {
    expect(modStepAria(sub(2), true)).toBe('minus 2 automatic successes');
  });

  it('says times for a multiply on a sum row', () => {
    expect(modStepAria(mul(2), false)).toBe('times 2');
  });

  it('says only times for a multiply on a pool row, never successes', () => {
    expect(modStepAria(mul(2), true)).toBe('times 2');
  });

  it('says the divide rounds down on a sum row', () => {
    expect(modStepAria(div(3), false)).toBe('divided by 3, rounded down');
  });

  it('says the divide rounds down on a pool row', () => {
    expect(modStepAria(div(3), true)).toBe('divided by 3, rounded down');
  });
});

describe('chainLayout', () => {
  it('opens no brackets for an empty chain', () => {
    expect(chainLayout('2d6', [])).toEqual({ opens: 0, steps: [] });
  });

  it('opens one bracket and closes it before a multiply that follows an add', () => {
    const layout = chainLayout('2d6', [add(3), mul(2)]);
    expect(layout.opens).toBe(1);
    expect(layout.steps.map((s) => s.closeBefore)).toEqual([false, true]);
  });

  it('opens none when the multiply comes before the add', () => {
    const layout = chainLayout('2d6', [mul(2), add(3)]);
    expect(layout.opens).toBe(0);
    expect(layout.steps.map((s) => s.closeBefore)).toEqual([false, false]);
  });

  it('counts a body with a space in it as already added', () => {
    expect(chainLayout('2d6 + 1d4', [mul(2)]).opens).toBe(1);
  });

  it('opens one bracket per scaling step that follows something added', () => {
    const layout = chainLayout('2d6 + 1d4', [mul(2), add(3), div(2)]);
    expect(layout.opens).toBe(2);
    expect(layout.steps.map((s) => s.closeBefore)).toEqual([true, false, true]);
  });

  it('opens only one bracket for two scaling steps in a row after an add', () => {
    const layout = chainLayout('2d6', [add(1), mul(2), div(2)]);
    expect(layout.opens).toBe(1);
    expect(layout.steps.map((s) => s.closeBefore)).toEqual([false, true, false]);
  });

  it('hands back every step in the order it was given', () => {
    const chain = [sub(1), mul(3), add(2)];
    expect(chainLayout('2d6', chain).steps.map((s) => s.step)).toEqual(chain);
  });
});
