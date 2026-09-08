import { describe, expect, it } from 'vitest';
import type { CheckSpec, DicePart, Expression } from '../types';
import { critApplies, critEffectParts } from './critEffect';
import { checkComplexity } from './complexity';
import { checkOutcomeChances } from './check';
import { expressionDistribution } from './expression';

const effectParts: DicePart[] = [{ id: 'e1', count: 1, sides: 8 }];

// exactOptionalPropertyTypes forbids writing `crit: undefined`, so drop the key.
function withoutCrit(check: CheckSpec): CheckSpec {
  const rest: CheckSpec = { ...check };
  delete rest.crit;
  return rest;
}

const part = (overrides: Partial<DicePart>): DicePart => ({
  id: 'p',
  count: 1,
  sides: 6,
  ...overrides,
});

const spec = (parts: DicePart[], crit?: CheckSpec['crit']): CheckSpec => ({
  threshold: { direction: 'gte', value: 15 },
  effect: { parts, flatModifier: 0 },
  onSuccess: 'full',
  onFailure: 'none',
  ...(crit ? { crit } : {}),
});

const counts = (parts: readonly DicePart[]): number[] => parts.map((p) => p.count);

describe('critEffectParts', () => {
  it('doubleDice doubles the count of every part', () => {
    const s = spec(
      [
        part({ id: 'a', count: 2, sides: 6 }),
        part({ id: 'b', count: 1, sides: 8 }),
        part({ id: 'c', count: 3, sides: 4 }),
      ],
      { onFaces: [20], effect: 'doubleDice' },
    );

    expect(counts(critEffectParts(s))).toEqual([4, 2, 6]);
  });

  it('doubleDice leaves everything about a part except its count alone', () => {
    const s = spec(
      [
        part({
          id: 'a',
          count: 4,
          sides: 6,
          keep: { type: 'highest', n: 3 },
          reroll: { values: [1], mode: 'once' },
          explode: { onFaces: [6], depthCap: 2 },
        }),
      ],
      { onFaces: [20], effect: 'doubleDice' },
    );

    expect(critEffectParts(s)).toStrictEqual([
      {
        id: 'a',
        count: 8,
        sides: 6,
        keep: { type: 'highest', n: 3 },
        reroll: { values: [1], mode: 'once' },
        explode: { onFaces: [6], depthCap: 2 },
      },
    ]);
  });

  it('extraDie adds one die to the first part only', () => {
    const s = spec(
      [
        part({ id: 'a', count: 2, sides: 6, keep: { type: 'highest', n: 1 } }),
        part({ id: 'b', count: 1, sides: 8, reroll: { values: [1], mode: 'always' } }),
        part({ id: 'c', count: 3, sides: 4 }),
      ],
      { onFaces: [20], effect: 'extraDie' },
    );

    expect(critEffectParts(s)).toStrictEqual([
      { id: 'a', count: 3, sides: 6, keep: { type: 'highest', n: 1 } },
      { id: 'b', count: 1, sides: 8, reroll: { values: [1], mode: 'always' } },
      { id: 'c', count: 3, sides: 4 },
    ]);
  });

  it('extraDie on a single-part effect adds one die to that part', () => {
    const s = spec([part({ id: 'a', count: 1, sides: 8 })], {
      onFaces: [20],
      effect: 'extraDie',
    });

    expect(counts(critEffectParts(s))).toEqual([2]);
  });

  it('adds the extra die even when the crit rule lists no faces', () => {
    const s = spec([part({ id: 'a', count: 2, sides: 6 })], {
      onFaces: [],
      effect: 'extraDie',
    });

    expect(counts(critEffectParts(s))).toEqual([3]);
  });

  it('maxPlusRoll leaves the effect dice exactly as they are', () => {
    const s = spec(
      [
        part({ id: 'a', count: 2, sides: 6, explode: { onFaces: [6], depthCap: 1 } }),
        part({ id: 'b', count: 1, sides: 8 }),
      ],
      { onFaces: [20], effect: 'maxPlusRoll' },
    );

    // Compared against a literal rather than against spec.effect.parts: an
    // implementation that edited the caller's parts in place would agree with
    // itself and slip through.
    expect(critEffectParts(s)).toStrictEqual([
      { id: 'a', count: 2, sides: 6, explode: { onFaces: [6], depthCap: 1 } },
      { id: 'b', count: 1, sides: 8 },
    ]);
  });

  it('a spec with no crit rule returns the effect dice unchanged', () => {
    const s = spec([
      part({ id: 'a', count: 2, sides: 6 }),
      part({ id: 'b', count: 1, sides: 8, keep: { type: 'lowest', n: 1 } }),
    ]);

    expect(critEffectParts(s)).toStrictEqual([
      { id: 'a', count: 2, sides: 6 },
      { id: 'b', count: 1, sides: 8, keep: { type: 'lowest', n: 1 } },
    ]);
  });

  it('returns an empty array when the effect has no dice', () => {
    expect(critEffectParts(spec([]))).toEqual([]);
    expect(critEffectParts(spec([], { onFaces: [20], effect: 'doubleDice' }))).toEqual([]);
    expect(critEffectParts(spec([], { onFaces: [20], effect: 'extraDie' }))).toEqual([]);
    expect(critEffectParts(spec([], { onFaces: [20], effect: 'maxPlusRoll' }))).toEqual([]);
  });

  it('never hands back the array the spec is holding', () => {
    const parts = [part({ id: 'a', count: 2, sides: 6 })];
    const plain = spec(parts);

    expect(critEffectParts(plain)).not.toBe(plain.effect.parts);
    expect(
      critEffectParts(spec(parts, { onFaces: [20], effect: 'doubleDice' })),
    ).not.toBe(parts);
    expect(critEffectParts(spec(parts, { onFaces: [20], effect: 'extraDie' }))).not.toBe(
      parts,
    );
    expect(
      critEffectParts(spec(parts, { onFaces: [20], effect: 'maxPlusRoll' })),
    ).not.toBe(parts);
  });

  it('does not mutate the spec it was given', () => {
    const s = spec(
      [
        part({ id: 'a', count: 2, sides: 6, keep: { type: 'highest', n: 1 } }),
        part({ id: 'b', count: 1, sides: 8 }),
      ],
      { onFaces: [20], effect: 'doubleDice' },
    );
    const before = JSON.parse(JSON.stringify(s)) as CheckSpec;
    const partsArray = s.effect.parts;

    critEffectParts(s);
    critEffectParts({ ...s, crit: { onFaces: [20], effect: 'extraDie' } });
    critEffectParts({ ...s, crit: { onFaces: [20], effect: 'maxPlusRoll' } });
    critEffectParts(spec(s.effect.parts));

    expect(s).toEqual(before);
    expect(s.effect.parts).toBe(partsArray);
  });

  it('growing the returned array leaves the spec at its own length', () => {
    const s = spec([part({ id: 'a', count: 2, sides: 6 })], {
      onFaces: [20],
      effect: 'doubleDice',
    });
    const result = critEffectParts(s);

    result.push(part({ id: 'extra', count: 9, sides: 9 }));
    expect(s.effect.parts).toHaveLength(1);
  });
});

describe('critApplies', () => {
  const oneDie: DicePart[] = [{ id: 'c', count: 1, sides: 20 }];

  it('applies to a check of exactly one die carrying crit faces', () => {
    expect(critApplies(spec(effectParts, { onFaces: [20], effect: 'doubleDice' }), oneDie)).toBe(
      true,
    );
  });

  it('does not apply when the check die is rolled more than once', () => {
    expect(
      critApplies(spec(effectParts, { onFaces: [20], effect: 'doubleDice' }), [
        { id: 'c', count: 2, sides: 20 },
      ]),
    ).toBe(false);
  });

  it('does not apply when the check is split across two parts', () => {
    expect(
      critApplies(spec(effectParts, { onFaces: [20], effect: 'doubleDice' }), [
        { id: 'c', count: 1, sides: 20 },
        { id: 'd', count: 1, sides: 4 },
      ]),
    ).toBe(false);
  });

  it('does not apply without a crit rule, or with an empty face list', () => {
    expect(critApplies(spec(effectParts), oneDie)).toBe(false);
    expect(critApplies(spec(effectParts, { onFaces: [], effect: 'doubleDice' }), oneDie)).toBe(
      false,
    );
  });

  it('does not apply to a check with no dice at all', () => {
    expect(critApplies(spec(effectParts, { onFaces: [20], effect: 'doubleDice' }), [])).toBe(
      false,
    );
  });
});

describe('checkComplexity agrees with the math about criticals', () => {
  // A multi-die check can never crit, so charging it for the bigger roll a
  // critical would make reported a computable row as too complex.
  const multiDieCheck: Expression = {
    id: 'e',
    name: 'Two dice',
    parts: [{ id: 'c', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'check',
    check: {
      threshold: { direction: 'gte', value: 9 },
      effect: {
        parts: [{ id: 'p', count: 10, sides: 10, keep: { type: 'highest', n: 5 } }],
        flatModifier: 0,
      },
      onSuccess: 'full',
      onFailure: 'none',
      crit: { onFaces: [6], effect: 'doubleDice' },
    },
  };

  it('does not charge a multi-die check for a critical it can never roll', () => {
    const withCrit = checkComplexity(multiDieCheck);
    const bare = checkComplexity({
      ...multiDieCheck,
      check: withoutCrit(multiDieCheck.check!),
    });
    expect(withCrit).toBe(bare);
  });

  it('still computes a multi-die check that carries a stale crit rule', () => {
    expect(checkOutcomeChances(multiDieCheck).crit).toBe(0);
    expect(expressionDistribution(multiDieCheck).size).toBeGreaterThan(0);
  });

  it('does charge a single-die check for the critical it can roll', () => {
    const single: Expression = {
      ...multiDieCheck,
      parts: [{ id: 'c', count: 1, sides: 20 }],
      check: { ...multiDieCheck.check!, crit: { onFaces: [20], effect: 'doubleDice' } },
    };
    const bare = checkComplexity({ ...single, check: withoutCrit(single.check!) });
    expect(checkComplexity(single)).toBeGreaterThan(bare);
  });
});
