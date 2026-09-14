import { describe, expect, it } from 'vitest';
import type { CheckSpec, DicePart, Expression } from '../types';
import {
  checkComplexity,
  COMPLEXITY_OVERFLOW,
  expressionComplexity,
  supportWidth,
  expressionTooComplex,
  keepWork,
  MAX_COMPLEXITY,
  MAX_KEEP_WORK,
  partComplexity,
  partTooComplex,
} from './complexity';
import { partDistribution } from './parts';
import { expressionDistribution } from './expression';
import { totalMass } from './distribution';

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

// keepWork is its own unit against its own cap, the way supportWidth is, so
// partComplexity no longer charges for a keep at all.
const keepWorkOf = (count: number, sides: number, n: number, maxFace = sides): number =>
  maxFace * (count + 1) * (n * maxFace + count);

describe('keepWork — what a keep rule costs', () => {
  it('partComplexity does not charge for a keep, in either unit', () => {
    expect(partComplexity(part({ count: 4, sides: 6, keep: { type: 'highest', n: 3 } }))).toBe(0);
    expect(partComplexity(part({ count: 100, sides: 100 }))).toBe(0);
  });

  it('prices a keep by levels, states and the width of the kept sum', () => {
    // One level per face value, one state per (dice counted, running sum).
    expect(keepWork([part({ count: 4, sides: 6 })], { type: 'highest', n: 3 })).toBe(
      keepWorkOf(4, 6, 3),
    );
    expect(keepWork([part({ count: 8, sides: 6 })], { type: 'highest', n: 4 })).toBe(
      keepWorkOf(8, 6, 4),
    );
  });

  it('charges nothing for the two cases with no walk to run', () => {
    // One die is a closed form; keeping them all is the plain sum.
    expect(keepWork([part({ count: 8, sides: 6 })], { type: 'highest', n: 1 })).toBe(0);
    expect(keepWork([part({ count: 8, sides: 6 })], { type: 'lowest', n: 1 })).toBe(0);
    expect(keepWork([part({ count: 8, sides: 6 })], { type: 'highest', n: 8 })).toBe(0);
    expect(keepWork([part({ count: 8, sides: 6 })], { type: 'highest', n: 99 })).toBe(0);
  });

  it('admits the heaviest keep row the previous release computed', () => {
    // The cap is set by compatibility, and this row is what sets it: sweeping
    // every plain keep row 2.1.0 allowed, this is the most expensive of them.
    const binding = part({ count: 999, sides: 2, keep: { type: 'highest', n: 998 } });
    expect(keepWork([binding], binding.keep!)).toBe(keepWorkOf(999, 2, 998));
    expect(keepWork([binding], binding.keep!)).toBeLessThan(MAX_KEEP_WORK);
    expect(partTooComplex(binding)).toBe(false);
  });

  // Pricing the walk rather than the enumeration it replaced takes back rows
  // that were refused for work the engine no longer does.
  it.each([
    ['20d20kh3', part({ count: 20, sides: 20, keep: { type: 'highest', n: 3 } })],
    ['30d6kh1', part({ count: 30, sides: 6, keep: { type: 'highest', n: 1 } })],
    ['100d100kh1', part({ count: 100, sides: 100, keep: { type: 'highest', n: 1 } })],
  ])('computes %s, which the multinomial score refused', (_label, p) => {
    expect(partTooComplex(p)).toBe(false);
    expect(partDistribution(p).size).toBeGreaterThan(0);
  });

  // The rows the old score admitted and could not finish. They are cheap on the
  // walk, so they are admitted here too, which is the point of pricing the work
  // rather than bounding the face count.
  it.each([
    ['4d6kh3', 4, 3],
    ['5d6kh3', 5, 3],
    ['6d6kh5', 6, 5],
    ['8d6kh7', 8, 7],
  ])('computes %s with a chain on it', (_label, count, n) => {
    const exploding = part({
      count,
      sides: 6,
      keep: { type: 'highest', n },
      explode: { onFaces: [6], depthCap: 10 },
    });
    // A d6 exploding ten deep tops out at 66, so the walk is 66 levels, not 6.
    expect(keepWork([exploding], exploding.keep!)).toBe(keepWorkOf(count, 6, n, 66));
    expect(partTooComplex(exploding)).toBe(false);

    // Timed, not just asserted non-empty. These are the rows that used to take
    // between a tenth of a second and half an hour, and the enumeration they no
    // longer run is synchronous, so a regression would hang the suite rather
    // than fail it. Measured at 2 to 3ms; the bound is loose enough for CI.
    const t0 = performance.now();
    const d = partDistribution(exploding);
    expect(performance.now() - t0).toBeLessThan(250);
    expect(d.size).toBeGreaterThan(0);
  });

  it('computes roll-and-keep at the size real systems use', () => {
    // 12d10 exploding on 10, keep the highest 6: the published case AnyDice
    // times out on against its five-second budget. 2.1.0 refused it too.
    const l5r = part({
      count: 12,
      sides: 10,
      keep: { type: 'highest', n: 6 },
      explode: { onFaces: [10], depthCap: 10 },
    });
    expect(partTooComplex(l5r)).toBe(false);
    const t0 = performance.now();
    const d = partDistribution(l5r);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(d.size).toBe(655);
    expect(totalMass(d)).toBeCloseTo(1, 10);
  });

  it('still refuses a keep whose walk is genuinely too big', () => {
    const huge = part({ count: 999, sides: 6, keep: { type: 'highest', n: 500 } });
    expect(keepWork([huge], huge.keep!)).toBeGreaterThan(MAX_KEEP_WORK);
    expect(partTooComplex(huge)).toBe(true);
    expect(partDistribution(huge).size).toBe(0);
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
        part({ id: 'a', count: 4, sides: 6, explode: { onFaces: [6], depthCap: 10 } }),
        part({ id: 'b', count: 4, sides: 6, explode: { onFaces: [6], depthCap: 10 } }),
      ],
    });
    expect(expressionComplexity(e)).toBe(120);
  });

  it('one runaway part dooms the expression', () => {
    const e = expr({
      parts: [
        part({ id: 'a', count: 1, sides: 6 }),
        part({ id: 'b', count: 1, sides: 20000, explode: { onFaces: [20000], depthCap: 10 } }),
      ],
    });
    expect(expressionTooComplex(e)).toBe(true);
  });

  it('a keep too big to walk dooms it through its own cap', () => {
    // Keep has its own unit, so it reaches expressionTooComplex on its own
    // clause rather than through expressionComplexity's total.
    const e = expr({
      parts: [part({ id: 'a', count: 999, sides: 6, keep: { type: 'highest', n: 500 } })],
    });
    expect(expressionComplexity(e)).toBe(0);
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
    const chained = pool([
      part({ count: 4, sides: 6, explode: { onFaces: [6], depthCap: 10 } }),
    ]);

    expect(expressionComplexity(chained)).toBe(16);
    expect(expressionComplexity({ ...chained, mode: 'sum' })).toBe(60);
  });

  it('never charges a pool for a keep walk it does not run', () => {
    const keepy = pool([part({ count: 999, sides: 6, keep: { type: 'highest', n: 500 } })]);
    // The same part in a sum row is refused on the keep clause.
    expect(expressionTooComplex({ ...keepy, mode: 'sum' })).toBe(true);
    expect(expressionComplexity(keepy)).toBe(998001);
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
  it('partDistribution of a keep too big to walk returns empty within 50 ms', () => {
    const p = part({ count: 999, sides: 6, keep: { type: 'highest', n: 500 } });
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
        part({ id: 'b', count: 999, sides: 6, keep: { type: 'highest', n: 500 } }),
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

describe('keepWork — keep-across-parts state space', () => {
  it('the closed-form single-die path is free', () => {
    const parts = [part({ id: 'a', count: 20, sides: 6 }), part({ id: 'b', count: 20, sides: 8 })];
    expect(keepWork(parts, { type: 'highest', n: 1 })).toBe(0);
    expect(keepWork(parts, { type: 'lowest', n: 1 })).toBe(0);
  });

  it('keeping every die is free, because it is a plain sum', () => {
    const parts = [part({ id: 'a', count: 2, sides: 6 }), part({ id: 'b', count: 1, sides: 8 })];
    expect(keepWork(parts, { type: 'highest', n: 3 })).toBe(0);
    expect(keepWork(parts, { type: 'highest', n: 9 })).toBe(0);
  });

  it('keeping every one of many dice is free even when the state space would overflow', () => {
    const parts = [
      part({ id: 'a', count: 20, sides: 6 }),
      part({ id: 'b', count: 20, sides: 6 }),
      part({ id: 'c', count: 20, sides: 6 }),
      part({ id: 'd', count: 20, sides: 6 }),
    ];
    // 21^4 states is more than the cap can afford, but keeping all 80 dice
    // never builds them: the walk short-circuits into a plain sum.
    expect(keepWork(parts, { type: 'highest', n: 80 })).toBe(0);
    expect(keepWork(parts, { type: 'highest', n: 3 })).toBeGreaterThan(MAX_KEEP_WORK);

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
    // 8 states over 88 levels, the d8's exploded ceiling, with a kept sum that
    // reaches 2 * 88, across 3 parts.
    const c = keepWork(parts, { type: 'highest', n: 2 });
    expect(c).toBe(88 * 8 * (2 * 88 + 3) * 3);
    expect(c).toBeLessThan(MAX_KEEP_WORK);
  });

  it('an explode rule with no faces does not inflate the face count', () => {
    const withFaces = part({ id: 'a', count: 2, sides: 6, explode: { onFaces: [6], depthCap: 10 } });
    const withoutFaces = part({ id: 'a', count: 2, sides: 6, explode: { onFaces: [], depthCap: 10 } });
    const other = part({ id: 'b', count: 1, sides: 6 });
    const rule = { type: 'highest', n: 2 } as const;
    // Same 6 states either way; only the ceiling moves, 6 against 6 + 10 * 6.
    expect(keepWork([withoutFaces, other], rule)).toBe(6 * 6 * (2 * 6 + 3) * 2);
    expect(keepWork([withFaces, other], rule)).toBe(66 * 6 * (2 * 66 + 3) * 2);
  });

  it('sixty mixed dice keeping three exceeds the cap', () => {
    const parts = [
      part({ id: 'a', count: 20, sides: 6 }),
      part({ id: 'b', count: 20, sides: 8 }),
      part({ id: 'c', count: 20, sides: 10 }),
    ];
    // 21^3 states over the d10's 10 levels, a kept sum reaching 3 * 10 plus the
    // 60 dice still to be counted, across 3 parts.
    const c = keepWork(parts, { type: 'highest', n: 3 });
    expect(c).toBe(10 * 21 ** 3 * (3 * 10 + 60) * 3);
    expect(c).toBeGreaterThan(MAX_KEEP_WORK);
  });

  it('a state space too large to count overflows instead of wrapping', () => {
    const parts = [
      part({ id: 'a', count: 100, sides: 6 }),
      part({ id: 'b', count: 100, sides: 6 }),
      part({ id: 'c', count: 100, sides: 6 }),
      part({ id: 'd', count: 100, sides: 6 }),
      part({ id: 'e', count: 100, sides: 6 }),
    ];
    expect(keepWork(parts, { type: 'highest', n: 2 })).toBe(COMPLEXITY_OVERFLOW);
  });

  it('invalid dice score zero rather than a bogus cost', () => {
    expect(keepWork([part({ count: 0, sides: 6 })], { type: 'highest', n: 2 })).toBe(0);
    expect(keepWork([part({ count: 2, sides: 1 })], { type: 'highest', n: 2 })).toBe(0);
    expect(keepWork([part({ count: 2, sides: 6 })], { type: 'highest', n: 0 })).toBe(0);
    expect(keepWork([part({ count: 2, sides: 6 })], { type: 'highest', n: 1.5 })).toBe(
      0,
    );
  });

  it('one bad part zeroes the whole walk, it does not score the good ones', () => {
    const parts = [
      part({ id: 'a', count: 20, sides: 10 }),
      part({ id: 'b', count: 20, sides: 10 }),
      part({ id: 'c', count: 0, sides: 10 }),
    ];

    expect(keepWork(parts, { type: 'highest', n: 3 })).toBe(0);
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
          parts: [
            part({ id: 'e', count: 4, sides: 6, explode: { onFaces: [6], depthCap: 10 } }),
          ],
          flatModifier: 0,
        },
        crit: { onFaces: [20], effect: 'doubleDice' },
      }),
      [part({ id: 't', count: 1, sides: 20, explode: { onFaces: [20], depthCap: 2 } })],
    );

    // 40 for the exploding check die, 60 for the exploding effect, and 60 again
    // for the doubled effect a critical rolls.
    expect(checkComplexity(e)).toBe(160);
  });

  it('a check row is scored through checkComplexity, a sum row only by its dice', () => {
    const e = checkExpr(
      checkSpec({
        effect: {
          parts: [
            part({ id: 'e', count: 4, sides: 6, explode: { onFaces: [6], depthCap: 10 } }),
          ],
          flatModifier: 0,
        },
      }),
      [part({ id: 't', count: 1, sides: 20, explode: { onFaces: [20], depthCap: 2 } })],
    );

    // 40 for the exploding check die plus 60 for the exploding effect it triggers.
    expect(checkComplexity(e)).toBe(100);
    expect(expressionComplexity(e)).toBe(100);
    expect(expressionComplexity({ ...e, mode: 'sum' })).toBe(40);
  });

  // A crit rolls more dice, and dice counts move the width rather than the
  // per-part cost, so the crit variant is measured where it lands.
  const effectOf = (count: number, sides: number): CheckSpec['effect'] => ({
    parts: [part({ id: 'e', count, sides })],
    flatModifier: 0,
  });

  it('an extra-die crit is one die wider than the effect alone', () => {
    const plain = checkExpr(checkSpec({ effect: effectOf(40, 100) }));
    const extra = checkExpr(
      checkSpec({ effect: effectOf(40, 100), crit: { onFaces: [20], effect: 'extraDie' } }),
    );
    expect(supportWidth(extra) - supportWidth(plain)).toBe(99);
  });

  it('a max-plus-roll crit rolls the same dice, so it is no wider', () => {
    const plain = checkExpr(checkSpec({ effect: effectOf(40, 100) }));
    const maxPlus = checkExpr(
      checkSpec({ effect: effectOf(40, 100), crit: { onFaces: [20], effect: 'maxPlusRoll' } }),
    );
    // It adds the dice's maximum as a flat bonus, which shifts rather than widens.
    expect(supportWidth(maxPlus)).toBe(supportWidth(plain));
  });

  it('a doubling crit is measured, not taken on trust', () => {
    // The effect alone is inside the width gate and the doubled one is not, so
    // scoring only the ordinary effect would admit a roll twice the size of the
    // one it measured.
    const plain = checkExpr(checkSpec({ effect: effectOf(40, 100) }));
    const doubled = checkExpr(
      checkSpec({ effect: effectOf(40, 100), crit: { onFaces: [20], effect: 'doubleDice' } }),
    );
    expect(expressionTooComplex(plain)).toBe(false);
    expect(supportWidth(doubled)).toBe(2 * supportWidth(plain) - 1);
    expect(expressionTooComplex(doubled)).toBe(true);
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
      checkSpec({ effect: effectOf(40, 100), crit: { onFaces: [], effect: 'doubleDice' } }),
    );
    const bare = checkExpr(checkSpec({ effect: effectOf(40, 100) }));

    expect(supportWidth(e)).toBe(supportWidth(bare));
    expect(expressionTooComplex(e)).toBe(false);
  });

  it('a check row with no spec scores only its check dice', () => {
    const e = expr({
      mode: 'check',
      parts: [part({ count: 1, sides: 6, explode: { onFaces: [6], depthCap: 10 } })],
    });

    expect(checkComplexity(e)).toBe(60);
  });

  it('a huge effect trips the guard even though the check dice are cheap', () => {
    const e = checkExpr(
      checkSpec({
        effect: {
          parts: [
            part({ id: 'e', count: 999, sides: 6, keep: { type: 'highest', n: 500 } }),
          ],
          flatModifier: 0,
        },
      }),
    );

    // The effect's keep walk is what refuses it, on the keep clause rather than
    // through the expression's own total.
    expect(expressionTooComplex(e)).toBe(true);
    expect(expressionTooComplex({ ...e, mode: 'sum' })).toBe(false);
  });

  it('doubling a borderline effect trips the guard the effect alone does not', () => {
    const effect = {
      parts: [part({ id: 'e', count: 500, sides: 6, keep: { type: 'highest', n: 250 } })],
      flatModifier: 0,
    };
    const withoutCrit = checkExpr(checkSpec({ effect }));
    const withCrit = checkExpr(
      checkSpec({ effect, crit: { onFaces: [20], effect: 'doubleDice' } }),
    );

    // 500d6 keeping 250 is a walk the guard affords; the 1000d6 keeping 250 that
    // a doubling crit rolls is not, and it is a roll the row actually makes.
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

  it('check dice too big to count refuse the row whatever the effect costs', () => {
    const e = checkExpr(checkSpec({}), [
      part({ id: 't', count: 999, sides: 6, keep: { type: 'highest', n: 500 } }),
    ]);

    expect(expressionTooComplex(e)).toBe(true);
  });

  it('an over-budget check row returns an empty distribution within 50 ms', () => {
    const e = checkExpr(
      checkSpec({
        effect: {
          parts: [
            part({ id: 'e', count: 999, sides: 6, keep: { type: 'highest', n: 500 } }),
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
