import type { DicePart } from '../types';

/**
 * Parts the complexity guard refuses, for tests that need "something the engine
 * will not compute" as a fixture rather than as the thing under test.
 *
 * Both shapes are refused on a gate that rescoring the keep enumeration cannot
 * move. A fixture refused only by the cost charged for keep starts computing the
 * moment that cost is charged correctly, which is what 20d20kh3, 100d100kh1 and
 * 30d6kh1 all did: each was picked because the binomial happened to overflow,
 * and each is cheap once the real work is priced. Reach for these instead, and
 * assert on a keep rule only where the keep rule is the subject.
 */

/**
 * Refused because of how wide its total is: 100 dice of 99 steps each is 9,901
 * possible totals, whose square is past MAX_SUPPORT_WORK. It carries no keep
 * rule at all, so nothing about keep can reprice it.
 *
 * Refused at the expression level, not the part level. Use it where a *row* has
 * to come back empty.
 */
export const WIDTH_REFUSED_PART: DicePart = {
  id: 'width-refused',
  count: 100,
  sides: 100,
};

/**
 * Refused by `partTooComplex` itself, which is the check `partDistribution` and
 * `sumPartsDistribution` make before they enumerate anything. Use it where a
 * single *part* has to come back empty, or where the point being made is about
 * keep rules specifically.
 *
 * Keeping 500 of 999 dice is a walk that stays expensive under any honest
 * pricing, unlike a keep of 1, which has a closed form and is free.
 */
export const KEEP_REFUSED_PART: DicePart = {
  id: 'keep-refused',
  count: 999,
  sides: 6,
  keep: { type: 'highest', n: 500 },
};
