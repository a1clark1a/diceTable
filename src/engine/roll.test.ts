import { describe, expect, it } from 'vitest';
import type { DicePart, Distribution } from '../types';
import { emptyDistribution, totalMass } from './distribution';
import { keepAcrossDistribution } from './keepAcross';
import { applyRollMode, sumPartsDistribution } from './roll';
import { mean } from './stats';

const part = (overrides: Partial<DicePart>): DicePart => ({
  id: 'p',
  count: 1,
  sides: 6,
  ...overrides,
});

const dist = (entries: [number, number][]): Distribution => new Map(entries);

const d6 = (): Distribution =>
  dist([
    [1, 1 / 6],
    [2, 1 / 6],
    [3, 1 / 6],
    [4, 1 / 6],
    [5, 1 / 6],
    [6, 1 / 6],
  ]);

describe('applyRollMode', () => {
  it('returns an empty distribution when given an empty distribution', () => {
    expect(applyRollMode(emptyDistribution(), 'normal').size).toBe(0);
    expect(applyRollMode(emptyDistribution(), 'advantage').size).toBe(0);
    expect(applyRollMode(emptyDistribution(), 'disadvantage').size).toBe(0);
  });

  it('normal mode returns a copy, so mutating the result leaves the original alone', () => {
    const original = dist([
      [1, 0.5],
      [2, 0.5],
    ]);
    const copy = applyRollMode(original, 'normal');

    expect(copy).not.toBe(original);
    copy.set(3, 99);
    expect(original.has(3)).toBe(false);
    expect(original.size).toBe(2);
  });

  it('normal mode leaves every probability untouched', () => {
    const skewed = dist([
      [1, 0.2],
      [4, 0.3],
      [9, 0.5],
    ]);

    expect([...applyRollMode(skewed, 'normal').entries()]).toEqual([
      [1, 0.2],
      [4, 0.3],
      [9, 0.5],
    ]);
  });

  it('advantage on a single certain outcome leaves it certain', () => {
    const certain = dist([[7, 1]]);
    expect([...applyRollMode(certain, 'advantage').entries()]).toEqual([[7, 1]]);
  });

  it('disadvantage on a single certain outcome leaves it certain', () => {
    const certain = dist([[7, 1]]);
    expect([...applyRollMode(certain, 'disadvantage').entries()]).toEqual([[7, 1]]);
  });

  it('advantage on a fair coin makes the higher outcome three times as likely', () => {
    const coin = dist([
      [0, 0.5],
      [1, 0.5],
    ]);
    const adv = applyRollMode(coin, 'advantage');

    expect(adv.get(0)).toBeCloseTo(0.25, 12);
    expect(adv.get(1)).toBeCloseTo(0.75, 12);
    expect(totalMass(adv)).toBeCloseTo(1, 12);
  });

  it('disadvantage on a fair coin makes the lower outcome three times as likely', () => {
    const coin = dist([
      [0, 0.5],
      [1, 0.5],
    ]);
    const dis = applyRollMode(coin, 'disadvantage');

    expect(dis.get(0)).toBeCloseTo(0.75, 12);
    expect(dis.get(1)).toBeCloseTo(0.25, 12);
    expect(totalMass(dis)).toBeCloseTo(1, 12);
  });

  // Two outcomes cannot tell the squared-CDF rule apart from several near misses,
  // because there is only ever one earlier step to subtract. Six can.
  it('advantage on a d6 is the highest of two d6: face k has probability (2k-1)/36', () => {
    const adv = applyRollMode(d6(), 'advantage');

    expect(adv.size).toBe(6);
    expect(adv.get(1)).toBeCloseTo(1 / 36, 12);
    expect(adv.get(2)).toBeCloseTo(3 / 36, 12);
    expect(adv.get(3)).toBeCloseTo(5 / 36, 12);
    expect(adv.get(4)).toBeCloseTo(7 / 36, 12);
    expect(adv.get(5)).toBeCloseTo(9 / 36, 12);
    expect(adv.get(6)).toBeCloseTo(11 / 36, 12);
    expect(totalMass(adv)).toBeCloseTo(1, 12);
    expect(mean(adv)).toBeCloseTo(161 / 36, 12);
  });

  it('disadvantage on a d6 is the lowest of two d6: face k has probability (13-2k)/36', () => {
    const dis = applyRollMode(d6(), 'disadvantage');

    expect(dis.size).toBe(6);
    expect(dis.get(1)).toBeCloseTo(11 / 36, 12);
    expect(dis.get(2)).toBeCloseTo(9 / 36, 12);
    expect(dis.get(3)).toBeCloseTo(7 / 36, 12);
    expect(dis.get(4)).toBeCloseTo(5 / 36, 12);
    expect(dis.get(5)).toBeCloseTo(3 / 36, 12);
    expect(dis.get(6)).toBeCloseTo(1 / 36, 12);
    expect(totalMass(dis)).toBeCloseTo(1, 12);
    expect(mean(dis)).toBeCloseTo(91 / 36, 12);
  });

  it('keeps working when the outcomes are negative', () => {
    const swing = dist([
      [-2, 0.5],
      [3, 0.5],
    ]);
    const adv = applyRollMode(swing, 'advantage');

    expect(adv.get(-2)).toBeCloseTo(0.25, 12);
    expect(adv.get(3)).toBeCloseTo(0.75, 12);
  });

  it('reads outcomes in numeric order, not insertion order', () => {
    const shuffled = dist([
      [3, 1 / 3],
      [1, 1 / 3],
      [2, 1 / 3],
    ]);
    const adv = applyRollMode(shuffled, 'advantage');

    expect(adv.get(1)).toBeCloseTo(1 / 9, 12);
    expect(adv.get(2)).toBeCloseTo(3 / 9, 12);
    expect(adv.get(3)).toBeCloseTo(5 / 9, 12);
  });

  it('drops an outcome that can never come up', () => {
    const withDeadFace = dist([
      [1, 0],
      [2, 1],
    ]);
    const adv = applyRollMode(withDeadFace, 'advantage');

    expect(adv.has(1)).toBe(false);
    expect(adv.get(2)).toBeCloseTo(1, 12);
  });
});

describe('sumPartsDistribution', () => {
  it('returns an empty distribution for an empty parts array', () => {
    expect(sumPartsDistribution([]).size).toBe(0);
  });

  it('a single part is just that part rolled', () => {
    const d = sumPartsDistribution([part({ count: 1, sides: 6 })]);

    expect(d.size).toBe(6);
    for (let face = 1; face <= 6; face++) {
      expect(d.get(face)).toBeCloseTo(1 / 6, 12);
    }
  });

  it('adds several parts together: 1d6 + 1d4 spans 2 to 10 with mean 6', () => {
    const d = sumPartsDistribution([
      part({ id: 'a', count: 1, sides: 6 }),
      part({ id: 'b', count: 1, sides: 4 }),
    ]);

    expect(d.size).toBe(9);
    expect(d.get(2)).toBeCloseTo(1 / 24, 12);
    expect(d.get(5)).toBeCloseTo(4 / 24, 12);
    expect(d.get(10)).toBeCloseTo(1 / 24, 12);
    expect(mean(d)).toBeCloseTo(6, 12);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  it('a keep-across rule replaces the addition: highest of 1d6 and 1d4', () => {
    const d = sumPartsDistribution(
      [part({ id: 'a', count: 1, sides: 6 }), part({ id: 'b', count: 1, sides: 4 })],
      { type: 'highest', n: 1 },
    );

    expect(d.get(1)).toBeCloseTo(1 / 24, 12);
    expect(d.get(2)).toBeCloseTo(3 / 24, 12);
    expect(d.get(3)).toBeCloseTo(5 / 24, 12);
    expect(d.get(4)).toBeCloseTo(7 / 24, 12);
    expect(d.get(5)).toBeCloseTo(4 / 24, 12);
    expect(d.get(6)).toBeCloseTo(4 / 24, 12);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  it('a keep-lowest rule across the parts: lowest of 1d6 and 1d4', () => {
    const d = sumPartsDistribution(
      [part({ id: 'a', count: 1, sides: 6 }), part({ id: 'b', count: 1, sides: 4 })],
      { type: 'lowest', n: 1 },
    );

    expect(d.get(1)).toBeCloseTo(9 / 24, 12);
    expect(d.get(2)).toBeCloseTo(7 / 24, 12);
    expect(d.get(3)).toBeCloseTo(5 / 24, 12);
    expect(d.get(4)).toBeCloseTo(3 / 24, 12);
    expect(d.has(5)).toBe(false);
    expect(d.has(6)).toBe(false);
    expect(totalMass(d)).toBeCloseTo(1, 12);
  });

  // Hand-enumerated: three dice (one d4, two d2) is 16 equally likely outcomes, and
  // the top two of each sum to 2, 3, 4, 5, 6 in 1, 3, 5, 4, 3 of them.
  it('keeps the best two dice across parts of different sizes: 1d4 + 2d2', () => {
    const d = sumPartsDistribution(
      [part({ id: 'a', count: 1, sides: 4 }), part({ id: 'b', count: 2, sides: 2 })],
      { type: 'highest', n: 2 },
    );

    expect(d.get(2)).toBeCloseTo(1 / 16, 12);
    expect(d.get(3)).toBeCloseTo(3 / 16, 12);
    expect(d.get(4)).toBeCloseTo(5 / 16, 12);
    expect(d.get(5)).toBeCloseTo(4 / 16, 12);
    expect(d.get(6)).toBeCloseTo(3 / 16, 12);
    expect(totalMass(d)).toBeCloseTo(1, 12);
    expect(mean(d)).toBeCloseTo(69 / 16, 12);
  });

  it('hands a keep-across rule to the keep-across walk rather than adding the parts', () => {
    const parts = [
      part({ id: 'a', count: 1, sides: 8 }),
      part({ id: 'b', count: 2, sides: 6 }),
    ];
    const rule = { type: 'highest', n: 2 } as const;

    const viaSum = sumPartsDistribution(parts, rule);
    const direct = keepAcrossDistribution(parts, rule);

    expect([...viaSum.entries()].sort((x, y) => x[0] - y[0])).toEqual(
      [...direct.entries()].sort((x, y) => x[0] - y[0]),
    );
    // The plain sum of 1d8 + 2d6 averages 4.5 + 3.5 + 3.5. Dropping the worst of
    // the three has to land strictly under that.
    expect(mean(sumPartsDistribution(parts))).toBeCloseTo(11.5, 12);
    expect(mean(viaSum)).toBeLessThan(11.5);
    expect(totalMass(viaSum)).toBeCloseTo(1, 12);
  });

  it('keeping every die across the parts is the same as adding them', () => {
    const parts = [
      part({ id: 'a', count: 1, sides: 6 }),
      part({ id: 'b', count: 1, sides: 4 }),
    ];
    const kept = sumPartsDistribution(parts, { type: 'highest', n: 2 });
    const added = sumPartsDistribution(parts);

    expect([...kept.entries()].sort((x, y) => x[0] - y[0])).toEqual(
      [...added.entries()].sort((x, y) => x[0] - y[0]),
    );
    expect(kept.size).toBe(9);
    expect(kept.get(2)).toBeCloseTo(1 / 24, 12);
    expect(kept.get(5)).toBeCloseTo(4 / 24, 12);
    expect(kept.get(10)).toBeCloseTo(1 / 24, 12);
    expect(mean(kept)).toBeCloseTo(6, 12);
    expect(totalMass(kept)).toBeCloseTo(1, 12);
  });

  it('asking to keep more dice than the roll has keeps all of them', () => {
    const parts = [
      part({ id: 'a', count: 1, sides: 6 }),
      part({ id: 'b', count: 1, sides: 4 }),
    ];
    const kept = sumPartsDistribution(parts, { type: 'lowest', n: 7 });

    expect(kept.size).toBe(9);
    expect(kept.get(2)).toBeCloseTo(1 / 24, 12);
    expect(mean(kept)).toBeCloseTo(6, 12);
  });

  it('a keep-across rule that keeps fewer than one die yields an empty distribution', () => {
    const parts = [part({ id: 'a', count: 2, sides: 6 })];
    expect(sumPartsDistribution(parts, { type: 'highest', n: 0 }).size).toBe(0);
    expect(sumPartsDistribution(parts, { type: 'highest', n: -1 }).size).toBe(0);
    expect(sumPartsDistribution(parts, { type: 'lowest', n: 1.5 }).size).toBe(0);
  });

  it('a part with fewer than two sides yields an empty distribution', () => {
    const d = sumPartsDistribution([
      part({ id: 'a', count: 1, sides: 6 }),
      part({ id: 'b', count: 1, sides: 1 }),
    ]);
    expect(d.size).toBe(0);
  });

  it('one bad part poisons the whole roll wherever it sits in the list', () => {
    const good = part({ id: 'a', count: 1, sides: 6 });
    const bad = part({ id: 'b', count: 1, sides: 0 });

    expect(sumPartsDistribution([bad, good]).size).toBe(0);
    expect(sumPartsDistribution([good, bad]).size).toBe(0);
    expect(sumPartsDistribution([good, bad, good]).size).toBe(0);
  });

  it('a part with a count below one yields an empty distribution', () => {
    expect(sumPartsDistribution([part({ count: 0 })]).size).toBe(0);
    expect(sumPartsDistribution([part({ count: -2 })]).size).toBe(0);
  });

  it('a count that is not a whole number yields an empty distribution', () => {
    expect(sumPartsDistribution([part({ count: 2.5 })]).size).toBe(0);
    expect(sumPartsDistribution([part({ count: Number.NaN })]).size).toBe(0);
    expect(sumPartsDistribution([part({ count: Number.POSITIVE_INFINITY })]).size).toBe(0);
  });

  it('an invalid part yields an empty distribution under a keep-across rule too', () => {
    const d = sumPartsDistribution([part({ count: 0 })], { type: 'highest', n: 1 });
    expect(d.size).toBe(0);
  });

  it('a part too complex to enumerate collapses the whole roll to empty', () => {
    const heavy = part({ id: 'b', count: 20, sides: 20, keep: { type: 'highest', n: 3 } });
    const d = sumPartsDistribution([part({ id: 'a', count: 1, sides: 6 }), heavy]);
    expect(d.size).toBe(0);

    // The guard has to be about the size of the enumeration, not about keep rules
    // in general: a keep of the same shape but small still comes through.
    const light = part({ id: 'c', count: 3, sides: 6, keep: { type: 'highest', n: 2 } });
    const ok = sumPartsDistribution([part({ id: 'a', count: 1, sides: 6 }), light]);
    expect(ok.size).toBeGreaterThan(0);
    expect(totalMass(ok)).toBeCloseTo(1, 12);
  });
});
