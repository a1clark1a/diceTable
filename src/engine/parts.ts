import type {
  DicePart,
  Distribution,
  KeepRule,
  SuccessThreshold,
} from '../types';
import { convolve, emptyDistribution } from './distribution';
import { partTooComplex } from './complexity';
import { singleDieDistribution } from './die';
import { keepFromSingleDie } from './keepAcross';

// The single-die helpers live in die.ts so keepAcross.ts can reach them without
// importing this module, which now depends on it. Re-exported because they are
// part of what a caller means by "parts".
export {
  applyExplode,
  applyReroll,
  explodeFrom,
  singleDieDistribution,
} from './die';

export function canKeep(rule: KeepRule, count: number): boolean {
  return Number.isInteger(rule.n) && rule.n >= 1 && rule.n <= count;
}

export function meetsThreshold(value: number, threshold: SuccessThreshold): boolean {
  return threshold.direction === 'gte'
    ? value >= threshold.value
    : value <= threshold.value;
}

// Counting successes asks a different question of the same die: not "what did it
// add up to" but "did it clear the bar". Reading the per-die odds off
// singleDieDistribution rather than off the raw faces is what makes a reroll pool
// ("reroll 1s, count 5+") come out exact instead of merely close.
export function poolPartDistribution(
  part: DicePart,
  threshold: SuccessThreshold,
): Distribution {
  if (!Number.isInteger(part.count) || part.count < 1) return emptyDistribution();
  if (!Number.isInteger(part.sides) || part.sides < 2) return emptyDistribution();
  if (!Number.isInteger(threshold.value)) return emptyDistribution();

  const single = singleDieDistribution(part);
  if (single.size === 0) return emptyDistribution();

  let p = 0;
  for (const [face, prob] of single) {
    if (meetsThreshold(face, threshold)) p += prob;
  }

  let result: Distribution = new Map([[0, 1]]);
  for (let i = 0; i < part.count; i++) {
    const next = new Map<number, number>();
    for (const [k, pk] of result) {
      if (p < 1) next.set(k, (next.get(k) ?? 0) + pk * (1 - p));
      if (p > 0) next.set(k + 1, (next.get(k + 1) ?? 0) + pk * p);
    }
    result = next;
  }
  return result;
}

export function partDistribution(part: DicePart): Distribution {
  if (!Number.isInteger(part.count) || part.count < 1) return emptyDistribution();
  if (!Number.isInteger(part.sides) || part.sides < 2) return emptyDistribution();
  if (partTooComplex(part)) return emptyDistribution();

  const single = singleDieDistribution(part);
  if (single.size === 0) return emptyDistribution();

  // A rule that keeps more dice than the part rolls has no answer, and the
  // editor says so in red. Stated here rather than left to whatever runs the
  // keep, because "keep them all" is a legitimate reading of n >= count that
  // returns the plain sum, and a row the editor calls invalid must not quietly
  // show stats for a different roll.
  if (part.keep && !canKeep(part.keep, part.count)) return emptyDistribution();

  if (part.keep) {
    return keepFromSingleDie(single, part.count, part.keep);
  }

  let result: Distribution = new Map(single);
  for (let i = 1; i < part.count; i++) {
    result = convolve(result, single);
    if (result.size === 0) return emptyDistribution();
  }
  return result;
}
