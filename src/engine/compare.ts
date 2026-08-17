import type { Distribution } from '../types';

export interface BeatChance {
  win: number;
  tie: number;
}

interface CumulativeDist {
  below: (v: number) => number;
  atOrBelow: (v: number) => number;
}

// Sorted values plus running totals, so P(X < v) and P(X ≤ v) are a binary
// search per query instead of a full scan of the distribution.
function cumulative(dist: Distribution): CumulativeDist {
  const values = [...dist.keys()].sort((a, b) => a - b);
  const totals: number[] = [];
  let acc = 0;
  for (const v of values) {
    acc += dist.get(v) ?? 0;
    totals.push(acc);
  }
  const find = (v: number, strict: boolean): number => {
    let lo = 0;
    let hi = values.length - 1;
    let best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const value = values[mid] ?? Infinity;
      if (strict ? value < v : value <= v) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best < 0 ? 0 : totals[best] ?? 0;
  };
  return {
    below: (v) => find(v, true),
    atOrBelow: (v) => find(v, false),
  };
}

/** One-on-one odds: how often a rolls strictly higher than b, and how often they land equal. */
export function beatChance(a: Distribution, b: Distribution): BeatChance {
  if (a.size === 0 || b.size === 0) return { win: 0, tie: 0 };
  const cdfB = cumulative(b);
  let win = 0;
  let tie = 0;
  for (const [v, p] of a) {
    win += p * cdfB.below(v);
    tie += p * (b.get(v) ?? 0);
  }
  return { win, tie };
}

/**
 * N-way roll-off: for each distribution, the chance of producing the single
 * highest result, plus the chance of tying for best without winning outright.
 * An empty distribution zeroes every result: it can never land below anyone,
 * so nobody wins against it, and it has no values to win with itself.
 */
export function winChances(dists: readonly Distribution[]): BeatChance[] {
  const cdfs = dists.map(cumulative);
  return dists.map((dist, i) => {
    let win = 0;
    let bestOrTied = 0;
    for (const [v, p] of dist) {
      let allBelow = 1;
      let allAtOrBelow = 1;
      for (const [j, cdf] of cdfs.entries()) {
        if (j === i) continue;
        allBelow *= cdf.below(v);
        allAtOrBelow *= cdf.atOrBelow(v);
      }
      win += p * allBelow;
      bestOrTied += p * allAtOrBelow;
    }
    // Floating error can push bestOrTied a hair under win; a tie is never negative.
    return { win, tie: Math.max(0, bestOrTied - win) };
  });
}
