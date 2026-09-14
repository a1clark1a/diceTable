import { describe, expect, it } from 'vitest';
import type { CheckSpec, DicePart, Expression } from '../types';
import {
  checkComplexity,
  COMPLEXITY_OVERFLOW,
  expressionComplexity,
  supportWidth,
  expressionTooComplex,
  keepAcrossComplexity,
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
  mode: 'sum',
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

  it('8d6kh4 is under the cap (1287 leaves)', () => {
    const c = partComplexity(
      part({ count: 8, sides: 6, keep: { type: 'highest', n: 4 } }),
    );
    expect(c).toBe(1287);
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

  // The enumeration runs over the die's distinct values after reroll and
  // explode, so a part scored on `sides` is scored on a die that no longer
  // exists. Each of these was admitted while taking between a tenth of a second
  // and half an hour of synchronous main-thread time.
  it.each([
    ['4d6kh3', 4, 3],
    ['5d6kh3', 5, 3],
    ['6d6kh5', 6, 5],
    ['8d6kh7', 8, 7],
  ])('refuses %s once its exploding faces are counted', (_label, count, n) => {
    const exploding = part({
      count,
      sides: 6,
      keep: { type: 'highest', n },
      explode: { onFaces: [6], depthCap: 10 },
    });
    expect(partTooComplex(exploding)).toBe(true);
    // The same shape without the chain is cheap and has to stay admitted.
    expect(partTooComplex(part({ count, sides: 6, keep: { type: 'highest', n } }))).toBe(
      false,
    );
  });

  it('charges a chain by the face that explodes, not by the top of the die', () => {
    // A d100 exploding on 1 reaches 150, not 5,100: only the faces that keep the
    // chain going are chained, and the last roll is the only unrestricted one.
    const lowTrigger = expr({
      parts: [part({ count: 3, sides: 100, explode: { onFaces: [1], depthCap: 50 } })],
    });
    expect(supportWidth(lowTrigger)).toBe(448);
    expect(expressionTooComplex(lowTrigger)).toBe(false);
    expect(expressionDistribution(lowTrigger).size).toBe(445);

    // Exploding on the top face really is that wide, and stays refused.
    const topTrigger = expr({
      parts: [part({ count: 3, sides: 100, explode: { onFaces: [100], depthCap: 50 } })],
    });
    expect(expressionTooComplex(topTrigger)).toBe(true);
  });

  it('ignores a trigger face the die cannot show', () => {
    // onFaces is not range-checked at the type level, and a face above the die
    // never comes up, so it never explodes and must not be charged for.
    const unreachable = part({ count: 3, sides: 6, explode: { onFaces: [99], depthCap: 50 } });
    expect(supportWidth(expr({ parts: [unreachable] }))).toBe(16);
    expect(partTooComplex(unreachable)).toBe(false);
  });

  it('a cost of exactly the cap is allowed, one over is not', () => {
    const atCap = part({ count: 1, sides: 10000, explode: { onFaces: [10000], depthCap: 10 } });
    const overCap = part({ count: 1, sides: 10001, explode: { onFaces: [10001], depthCap: 10 } });

    expect(partComplexity(atCap)).toBe(MAX_COMPLEXITY);
    expect(partTooComplex(atCap)).toBe(false);
    expect(partComplexity(overCap)).toBe(100010);
    expect(partTooComplex(overCap)).toBe(true);
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

  it('a cap of zero costs nothing, because nothing ever re-rolls', () => {
    expect(
      partComplexity(part({ count: 1, sides: 6, explode: { onFaces: [6], depthCap: 0 } })),
    ).toBe(0);
  });

  it('a nonsense cap falls back to the default depth of ten', () => {
    expect(
      partComplexity(part({ count: 1, sides: 6, explode: { onFaces: [6], depthCap: -1 } })),
    ).toBe(60);
    expect(
      partComplexity(part({ count: 1, sides: 6, explode: { onFaces: [6], depthCap: 2.5 } })),
    ).toBe(60);
  });
});

describe('partComplexity — invalid input', () => {
  // Each part below carries an explode rule, so an unguarded partComplexity would
  // charge for it. Scoring a plain part proves nothing: plain dice cost zero anyway.
  const boom = { onFaces: [6], depthCap: 10 };

  it('non-integer or below-min count returns zero', () => {
    expect(partComplexity(part({ count: 0, explode: boom }))).toBe(0);
    expect(partComplexity(part({ count: -3, explode: boom }))).toBe(0);
    expect(partComplexity(part({ count: 1.5, explode: boom }))).toBe(0);
  });

  it('non-integer or below-min sides returns zero', () => {
    expect(partComplexity(part({ sides: 1, explode: { onFaces: [1], depthCap: 10 } }))).toBe(0);
    expect(partComplexity(part({ sides: 6.5, explode: boom }))).toBe(0);
  });

  it('invalid dice never trip the guard', () => {
    // 20000 * 10 would be double the cap if the count guard were not there.
    expect(partTooComplex(part({ count: -3, sides: 20000, explode: boom }))).toBe(false);
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

  it('an expression with no parts costs nothing', () => {
    expect(expressionComplexity(expr({ parts: [] }))).toBe(0);
    expect(expressionComplexity(expr({ parts: [], mode: 'pool' }))).toBe(0);
    expect(expressionTooComplex(expr({ parts: [] }))).toBe(false);
  });
});

// Pool rows strip keep and explode, so scoring them the sum way would score every
// pool at zero. They are charged for the Bernoulli convolution instead: dice squared.
describe('expressionComplexity — pool mode', () => {
  const pool = (parts: DicePart[]): Expression => expr({ mode: 'pool', parts });

  it('charges the square of the dice count, not the sum-mode cost', () => {
    expect(expressionComplexity(pool([part({ count: 30, sides: 6 })]))).toBe(900);
    expect(
      expressionComplexity(
        pool([part({ id: 'a', count: 20, sides: 6 }), part({ id: 'b', count: 10, sides: 10 })]),
      ),
    ).toBe(900);
  });

  it('ignores keep and explode, which a pool never applies', () => {
    const keepy = pool([part({ count: 4, sides: 6, keep: { type: 'highest', n: 3 } })]);

    expect(expressionComplexity(keepy)).toBe(16);
    expect(expressionComplexity({ ...keepy, mode: 'sum' })).toBe(126);
  });

  it('skips invalid dice instead of counting them', () => {
    const e = pool([
      part({ id: 'a', count: 30, sides: 6 }),
      part({ id: 'b', count: 0, sides: 6 }),
      part({ id: 'c', count: 5, sides: 1 }),
      part({ id: 'd', count: 2.5, sides: 6 }),
    ]);

    expect(expressionComplexity(e)).toBe(900);
  });

  it('a pool under the cap passes the guard, one over it does not', () => {
    // 316^2 = 99856, just inside; 317^2 = 100489, just outside.
    expect(expressionTooComplex(pool([part({ count: 316, sides: 6 })]))).toBe(false);
    expect(expressionTooComplex(pool([part({ count: 317, sides: 6 })]))).toBe(true);
  });

  it('a pool too big to count overflows instead of squaring', () => {
    const e = pool([
      part({ id: 'a', count: 100000, sides: 6 }),
      part({ id: 'b', count: 100000, sides: 6 }),
    ]);

    expect(expressionComplexity(e)).toBe(COMPLEXITY_OVERFLOW);
    expect(expressionTooComplex(e)).toBe(true);
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
    // Every total from 3 to 18 is reachable, so the guard must not have fired.
    expect(d.size).toBe(16);
  });
});

describe('keepAcrossComplexity — keep-across-parts state space', () => {
  it('the closed-form single-die path is free', () => {
    const parts = [part({ id: 'a', count: 20, sides: 6 }), part({ id: 'b', count: 20, sides: 8 })];
    expect(keepAcrossComplexity(parts, { type: 'highest', n: 1 })).toBe(0);
    expect(keepAcrossComplexity(parts, { type: 'lowest', n: 1 })).toBe(0);
  });

  it('keeping every die is free, because it is a plain sum', () => {
    const parts = [part({ id: 'a', count: 2, sides: 6 }), part({ id: 'b', count: 1, sides: 8 })];
    expect(keepAcrossComplexity(parts, { type: 'highest', n: 3 })).toBe(0);
    expect(keepAcrossComplexity(parts, { type: 'highest', n: 9 })).toBe(0);
  });

  it('keeping every one of many dice is free even when the state space would overflow', () => {
    const parts = [
      part({ id: 'a', count: 20, sides: 6 }),
      part({ id: 'b', count: 20, sides: 6 }),
      part({ id: 'c', count: 20, sides: 6 }),
      part({ id: 'd', count: 20, sides: 6 }),
    ];
    // 21^4 states would overflow, but keeping all 80 dice never builds them:
    // the walk short-circuits into a plain sum.
    expect(keepAcrossComplexity(parts, { type: 'highest', n: 80 })).toBe(0);
    expect(keepAcrossComplexity(parts, { type: 'highest', n: 3 })).toBe(COMPLEXITY_OVERFLOW);

    const e = expr({ parts, keepAcross: { type: 'highest', n: 80 } });
    expect(expressionTooComplex(e)).toBe(false);
    expect(expressionDistribution(e).size).toBeGreaterThan(0);
  });

  it('a trait die beside a wild die stays far under the cap', () => {
    const parts = [
      part({ id: 'a', count: 1, sides: 8, explode: { onFaces: [8], depthCap: 10 } }),
      part({ id: 'b', count: 1, sides: 6, explode: { onFaces: [6], depthCap: 10 } }),
      part({ id: 'c', count: 1, sides: 6 }),
    ];
    // 2*2*2 states, squared, times n=2, times the d8's exploded ceiling of 88.
    const c = keepAcrossComplexity(parts, { type: 'highest', n: 2 });
    expect(c).toBe(11264);
    expect(c).toBeLessThan(MAX_COMPLEXITY);
  });

  it('an explode rule with no faces does not inflate the face count', () => {
    const withFaces = part({ id: 'a', count: 2, sides: 6, explode: { onFaces: [6], depthCap: 10 } });
    const withoutFaces = part({ id: 'a', count: 2, sides: 6, explode: { onFaces: [], depthCap: 10 } });
    const other = part({ id: 'b', count: 1, sides: 6 });
    const rule = { type: 'highest', n: 2 } as const;
    // Same 6 states either way; only the top face moves, 6 versus 6 * 11.
    expect(keepAcrossComplexity([withoutFaces, other], rule)).toBe(432);
    expect(keepAcrossComplexity([withFaces, other], rule)).toBe(4752);
  });

  it('sixty mixed dice keeping three exceeds the cap', () => {
    const parts = [
      part({ id: 'a', count: 20, sides: 6 }),
      part({ id: 'b', count: 20, sides: 8 }),
      part({ id: 'c', count: 20, sides: 10 }),
    ];
    // 21^3 states, squared, times n=3, times the d10's top face.
    expect(keepAcrossComplexity(parts, { type: 'highest', n: 3 })).toBe(2572983630);
  });

  it('a state space too large to count overflows instead of wrapping', () => {
    const parts = [
      part({ id: 'a', count: 100, sides: 6 }),
      part({ id: 'b', count: 100, sides: 6 }),
      part({ id: 'c', count: 100, sides: 6 }),
      part({ id: 'd', count: 100, sides: 6 }),
      part({ id: 'e', count: 100, sides: 6 }),
    ];
    expect(keepAcrossComplexity(parts, { type: 'highest', n: 2 })).toBe(COMPLEXITY_OVERFLOW);
  });

  it('invalid dice score zero rather than a bogus cost', () => {
    expect(keepAcrossComplexity([part({ count: 0, sides: 6 })], { type: 'highest', n: 2 })).toBe(0);
    expect(keepAcrossComplexity([part({ count: 2, sides: 1 })], { type: 'highest', n: 2 })).toBe(0);
    expect(keepAcrossComplexity([part({ count: 2, sides: 6 })], { type: 'highest', n: 0 })).toBe(0);
    expect(keepAcrossComplexity([part({ count: 2, sides: 6 })], { type: 'highest', n: 1.5 })).toBe(
      0,
    );
  });

  it('one bad part zeroes the whole walk, it does not score the good ones', () => {
    const parts = [
      part({ id: 'a', count: 20, sides: 10 }),
      part({ id: 'b', count: 20, sides: 10 }),
      part({ id: 'c', count: 0, sides: 10 }),
    ];

    expect(keepAcrossComplexity(parts, { type: 'highest', n: 3 })).toBe(0);
  });

  it('folds into the expression cost and trips the guard', () => {
    const e = expr({
      parts: [
        part({ id: 'a', count: 20, sides: 6 }),
        part({ id: 'b', count: 20, sides: 8 }),
        part({ id: 'c', count: 20, sides: 10 }),
      ],
      keepAcross: { type: 'highest', n: 3 },
    });
    expect(expressionTooComplex(e)).toBe(true);
    expect(expressionTooComplex({ ...e, keepAcross: { type: 'highest', n: 1 } })).toBe(false);
  });
});

describe('checkComplexity — a check row pays for three rolls', () => {
  const checkSpec = (overrides: Partial<CheckSpec>): CheckSpec => ({
    threshold: { direction: 'gte', value: 15 },
    effect: { parts: [part({ id: 'e', count: 1, sides: 8 })], flatModifier: 0 },
    onSuccess: 'full',
    onFailure: 'none',
    ...overrides,
  });

  const checkExpr = (spec: CheckSpec, parts?: DicePart[]): Expression =>
    expr({
      mode: 'check',
      parts: parts ?? [part({ id: 't', count: 1, sides: 20 })],
      check: spec,
    });

  it('a plain check costs nothing and is not too complex', () => {
    const e = checkExpr(
      checkSpec({
        effect: { parts: [part({ id: 'e', count: 2, sides: 6 })], flatModifier: 4 },
        crit: { onFaces: [20], effect: 'doubleDice' },
      }),
    );

    expect(checkComplexity(e)).toBe(0);
    expect(expressionTooComplex(e)).toBe(false);
    expect(expressionDistribution(e).size).toBeGreaterThan(0);
  });

  it('scores the check dice, the effect dice and the crit variant together', () => {
    const e = checkExpr(
      checkSpec({
        effect: {
          parts: [part({ id: 'e', count: 4, sides: 6, keep: { type: 'highest', n: 3 } })],
          flatModifier: 0,
        },
        crit: { onFaces: [20], effect: 'doubleDice' },
      }),
      [part({ id: 't', count: 1, sides: 20, explode: { onFaces: [20], depthCap: 2 } })],
    );

    // 40 for the exploding check die, 126 for 4d6kh3, 1287 for the doubled 8d6kh3.
    expect(checkComplexity(e)).toBe(1453);
  });

  it('a check row is scored through checkComplexity, a sum row only by its dice', () => {
    const e = checkExpr(
      checkSpec({
        effect: {
          parts: [part({ id: 'e', count: 4, sides: 6, keep: { type: 'highest', n: 3 } })],
          flatModifier: 0,
        },
      }),
      [part({ id: 't', count: 1, sides: 20, explode: { onFaces: [20], depthCap: 2 } })],
    );

    // 40 for the exploding check die plus 126 for the 4d6kh3 effect it triggers.
    expect(checkComplexity(e)).toBe(166);
    expect(expressionComplexity(e)).toBe(166);
    expect(expressionComplexity({ ...e, mode: 'sum' })).toBe(40);
  });

  it('an extra-die crit costs one more die on the first effect part', () => {
    const e = checkExpr(
      checkSpec({
        effect: {
          parts: [part({ id: 'e', count: 4, sides: 6, keep: { type: 'highest', n: 3 } })],
          flatModifier: 0,
        },
        crit: { onFaces: [20], effect: 'extraDie' },
      }),
    );

    // 126 for 4d6kh3 plus 252 for the 5d6kh3 a crit rolls.
    expect(checkComplexity(e)).toBe(378);
  });

  it('a max-plus-roll crit costs a second roll of the same dice', () => {
    const e = checkExpr(
      checkSpec({
        effect: {
          parts: [part({ id: 'e', count: 4, sides: 6, keep: { type: 'highest', n: 3 } })],
          flatModifier: 0,
        },
        crit: { onFaces: [20], effect: 'maxPlusRoll' },
      }),
    );

    expect(checkComplexity(e)).toBe(252);
  });

  it('does not charge for a crit whose roll a none success scale skips', () => {
    const effect = {
      parts: [part({ id: 'e', count: 10, sides: 10, keep: { type: 'highest', n: 5 } })],
      flatModifier: 0,
    };
    const withCrit = checkExpr(
      checkSpec({ effect, onSuccess: 'none', crit: { onFaces: [20], effect: 'doubleDice' } }),
    );
    const bare = checkExpr(checkSpec({ effect, onSuccess: 'none' }));

    expect(checkComplexity(withCrit)).toBe(checkComplexity(bare));
    expect(expressionTooComplex(withCrit)).toBe(false);
  });

  it('a crit that can never happen is not charged for', () => {
    const e = checkExpr(
      checkSpec({
        effect: {
          parts: [part({ id: 'e', count: 4, sides: 6, keep: { type: 'highest', n: 3 } })],
          flatModifier: 0,
        },
        crit: { onFaces: [], effect: 'doubleDice' },
      }),
    );

    expect(checkComplexity(e)).toBe(126);
  });

  it('a check row with no spec scores only its check dice', () => {
    const e = expr({
      mode: 'check',
      parts: [part({ count: 4, sides: 6, keep: { type: 'highest', n: 3 } })],
    });

    expect(checkComplexity(e)).toBe(126);
  });

  it('a huge effect trips the guard even though the check dice are cheap', () => {
    const e = checkExpr(
      checkSpec({
        effect: {
          parts: [
            part({ id: 'e', count: 20, sides: 20, keep: { type: 'highest', n: 3 } }),
          ],
          flatModifier: 0,
        },
      }),
    );

    expect(expressionComplexity(e)).toBe(COMPLEXITY_OVERFLOW);
    expect(expressionTooComplex(e)).toBe(true);
    expect(expressionTooComplex({ ...e, mode: 'sum' })).toBe(false);
  });

  it('doubling a borderline effect trips the guard the effect alone does not', () => {
    const effect = {
      parts: [part({ id: 'e', count: 10, sides: 10, keep: { type: 'highest', n: 5 } })],
      flatModifier: 0,
    };
    const withoutCrit = checkExpr(checkSpec({ effect }));
    const withCrit = checkExpr(
      checkSpec({ effect, crit: { onFaces: [20], effect: 'doubleDice' } }),
    );

    expect(checkComplexity(withoutCrit)).toBe(92378);
    expect(expressionTooComplex(withoutCrit)).toBe(false);
    expect(expressionTooComplex(withCrit)).toBe(true);
  });

  it('an effect that keeps across sixty dice trips the guard', () => {
    const e = checkExpr(
      checkSpec({
        effect: {
          parts: [
            part({ id: 'x', count: 20, sides: 6 }),
            part({ id: 'y', count: 20, sides: 8 }),
            part({ id: 'z', count: 20, sides: 10 }),
          ],
          flatModifier: 0,
          keepAcross: { type: 'highest', n: 3 },
        },
      }),
    );

    expect(expressionTooComplex(e)).toBe(true);
  });

  it('check dice too big to count overflow whatever the effect costs', () => {
    const e = checkExpr(checkSpec({}), [
      part({ id: 't', count: 100, sides: 100, keep: { type: 'highest', n: 50 } }),
    ]);

    expect(checkComplexity(e)).toBe(COMPLEXITY_OVERFLOW);
  });

  it('an over-budget check row returns an empty distribution within 50 ms', () => {
    const e = checkExpr(
      checkSpec({
        effect: {
          parts: [
            part({ id: 'e', count: 20, sides: 20, keep: { type: 'highest', n: 3 } }),
          ],
          flatModifier: 0,
        },
        crit: { onFaces: [20], effect: 'doubleDice' },
      }),
    );

    const t0 = performance.now();
    const d = expressionDistribution(e);
    const elapsed = performance.now() - t0;

    expect(d.size).toBe(0);
    expect(elapsed).toBeLessThan(50);
  });
});

describe('supportWidth and the sum guard', () => {
  function sumRow(count: number, sides: number): Expression {
    return {
      id: 'w',
      name: 'w',
      parts: [{ id: 'wp', count, sides }],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'sum',
    };
  }

  it('counts the totals a roll can land on', () => {
    // 20d6 runs 20 to 120, which is 101 distinct totals.
    expect(supportWidth(sumRow(20, 6))).toBe(101);
    expect(supportWidth(sumRow(1, 20))).toBe(20);
  });

  it('charges a keep row only for the dice it keeps', () => {
    const keepRow: Expression = {
      ...sumRow(4, 6),
      parts: [{ id: 'wp', count: 4, sides: 6, keep: { type: 'highest', n: 3 } }],
    };
    // Three kept d6 span 3 to 18, not four dice worth.
    expect(supportWidth(keepRow)).toBe(16);
  });

  it('leaves pool rows to the guard that already bounds them', () => {
    expect(supportWidth({ ...sumRow(50, 10), mode: 'pool' })).toBe(0);
  });

  it('admits the rows people actually build', () => {
    // Measured: 0.9ms, 2.3ms and 34ms respectively.
    expect(expressionTooComplex(sumRow(20, 6))).toBe(false);
    expect(expressionTooComplex(sumRow(20, 20))).toBe(false);
    expect(expressionTooComplex(sumRow(20, 100))).toBe(false);
    expect(expressionTooComplex(sumRow(50, 100))).toBe(false);
  });

  it('refuses a plain sum that would freeze the main thread', () => {
    // These scored zero before, because partComplexity only charges for keep
    // and explode. 100d100 measured 615ms and 100d1000 over three minutes.
    expect(expressionTooComplex(sumRow(100, 100))).toBe(true);
    expect(expressionTooComplex(sumRow(100, 1000))).toBe(true);
    expect(expressionTooComplex(sumRow(999, 1000))).toBe(true);
  });
});
