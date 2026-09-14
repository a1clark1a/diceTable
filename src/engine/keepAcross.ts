import type { DicePart, Distribution, KeepRule } from '../types';
import { convolveMany, emptyDistribution, sortedKeys } from './distribution';
import { singleDieDistribution } from './die';

interface DieGroup {
  faces: number[];
  probs: number[];
  count: number;
}

function buildGroups(parts: readonly DicePart[]): DieGroup[] | null {
  if (parts.length === 0) return null;
  const groups: DieGroup[] = [];
  for (const part of parts) {
    if (!Number.isInteger(part.count) || part.count < 1) return null;
    if (!Number.isInteger(part.sides) || part.sides < 2) return null;
    const single = singleDieDistribution(part);
    if (single.size === 0) return null;
    const faces = sortedKeys(single);
    groups.push({
      faces,
      probs: faces.map((f) => single.get(f) ?? 0),
      count: part.count,
    });
  }
  return groups;
}

function maxFaceOf(groups: readonly DieGroup[]): number {
  let max = 0;
  for (const g of groups) {
    const last = g.faces[g.faces.length - 1] ?? 0;
    if (last > max) max = last;
  }
  return max;
}

function totalDiceOf(groups: readonly DieGroup[]): number {
  let total = 0;
  for (const g of groups) total += g.count;
  return total;
}

// Dense P(X <= t) for t = 0..T+1. Every consumer below walks t in order, so a
// lookup table beats a binary search per query and keeps the level walk flat.
function denseCdf(group: DieGroup, maxFace: number): Float64Array {
  const arr = new Float64Array(maxFace + 2);
  let acc = 0;
  let i = 0;
  for (let t = 1; t <= maxFace; t++) {
    while (i < group.faces.length && group.faces[i] === t) {
      acc += group.probs[i] ?? 0;
      i++;
    }
    arr[t] = acc;
  }
  arr[maxFace + 1] = acc;
  return arr;
}

function densePmf(group: DieGroup, maxFace: number): Float64Array {
  const arr = new Float64Array(maxFace + 2);
  for (let i = 0; i < group.faces.length; i++) {
    const face = group.faces[i] ?? 0;
    if (face >= 1 && face <= maxFace) arr[face] = group.probs[i] ?? 0;
  }
  return arr;
}

function keepHighestOne(groups: readonly DieGroup[], maxFace: number): Distribution {
  const cdfs = groups.map((g) => denseCdf(g, maxFace));
  const result = new Map<number, number>();
  let prev = 0;
  for (let v = 1; v <= maxFace; v++) {
    let cum = 1;
    for (let i = 0; i < groups.length; i++) {
      cum *= Math.pow(cdfs[i]?.[v] ?? 0, groups[i]?.count ?? 0);
    }
    const p = cum - prev;
    if (p > 0) result.set(v, p);
    prev = cum;
  }
  return result;
}

function keepLowestOne(groups: readonly DieGroup[], maxFace: number): Distribution {
  const cdfs = groups.map((g) => denseCdf(g, maxFace));
  const result = new Map<number, number>();
  let atOrAbove = 1;
  for (let v = 1; v <= maxFace; v++) {
    let above = 1;
    for (let i = 0; i < groups.length; i++) {
      above *= Math.pow(1 - (cdfs[i]?.[v] ?? 0), groups[i]?.count ?? 0);
    }
    const p = atOrAbove - above;
    if (p > 0) result.set(v, p);
    atOrAbove = above;
  }
  return result;
}

function pascal(maxN: number): number[][] {
  const rows: number[][] = [[1]];
  for (let n = 1; n <= maxN; n++) {
    const prev = rows[n - 1] ?? [1];
    const row: number[] = [1];
    for (let k = 1; k < n; k++) row.push((prev[k - 1] ?? 0) + (prev[k] ?? 0));
    row.push(1);
    rows.push(row);
  }
  return rows;
}

// Sum of the top n dice, exactly, for dice of different sizes.
//
// The identity behind it: for positive integer faces, the top-n sum equals
// sum over thresholds t of min(n, C_t), where C_t counts dice showing at least t.
// So walk t downward and accumulate. The state is how many dice of each part have
// already reached the current threshold, which stays small because dice inside a
// part are identical, so a part's newcomers at each level are binomial rather
// than needing their own identity.
function keepHighestSum(
  groups: readonly DieGroup[],
  n: number,
  maxFace: number,
): Distribution {
  const groupCount = groups.length;
  const stride: number[] = new Array(groupCount).fill(0);
  let stateCount = 1;
  for (let i = 0; i < groupCount; i++) {
    stride[i] = stateCount;
    stateCount *= (groups[i]?.count ?? 0) + 1;
  }

  const maxSum = n * maxFace;
  const width = maxSum + 1;
  const cdfs = groups.map((g) => denseCdf(g, maxFace));
  const pmfs = groups.map((g) => densePmf(g, maxFace));

  let maxCount = 0;
  for (const g of groups) if (g.count > maxCount) maxCount = g.count;
  const binom = pascal(maxCount);

  let cur = new Float64Array(stateCount * width);
  cur[0] = 1;

  const counts: number[] = new Array(groupCount).fill(0);

  for (let t = maxFace; t >= 1; t--) {
    const next = new Float64Array(stateCount * width);

    const transitions: Float64Array[][] = groups.map((g, gi) => {
      const cdf = cdfs[gi]?.[t] ?? 0;
      const q = cdf > 0 ? (pmfs[gi]?.[t] ?? 0) / cdf : 0;
      const table: Float64Array[] = [];
      for (let remaining = 0; remaining <= g.count; remaining++) {
        const row = new Float64Array(remaining + 1);
        const coefficients = binom[remaining] ?? [1];
        for (let taken = 0; taken <= remaining; taken++) {
          row[taken] =
            (coefficients[taken] ?? 0) *
            Math.pow(q, taken) *
            Math.pow(1 - q, remaining - taken);
        }
        table.push(row);
      }
      return table;
    });

    for (let state = 0; state < stateCount; state++) {
      const base = state * width;
      let occupied = false;
      for (let k = 0; k < width; k++) {
        if ((cur[base + k] ?? 0) !== 0) {
          occupied = true;
          break;
        }
      }
      if (!occupied) continue;

      let rest = state;
      let counted = 0;
      for (let gi = 0; gi < groupCount; gi++) {
        const radix = (groups[gi]?.count ?? 0) + 1;
        const digit = rest % radix;
        counts[gi] = digit;
        counted += digit;
        rest = (rest - digit) / radix;
      }

      const walk = (
        gi: number,
        weight: number,
        stateDelta: number,
        countDelta: number,
      ): void => {
        if (weight === 0) return;
        if (gi === groupCount) {
          const contribution = Math.min(n, counted + countDelta);
          const target = (state + stateDelta) * width + contribution;
          for (let k = 0; k + contribution <= maxSum; k++) {
            const p = cur[base + k] ?? 0;
            if (p === 0) continue;
            const at = target + k;
            next[at] = (next[at] ?? 0) + p * weight;
          }
          return;
        }
        const remaining = (groups[gi]?.count ?? 0) - (counts[gi] ?? 0);
        const row = transitions[gi]?.[remaining];
        if (!row) return;
        for (let taken = 0; taken <= remaining; taken++) {
          walk(
            gi + 1,
            weight * (row[taken] ?? 0),
            stateDelta + taken * (stride[gi] ?? 0),
            countDelta + taken,
          );
        }
      };
      walk(0, 1, 0, 0);
    }

    cur = next;
  }

  // Every face is at least 1, so by the time the walk reaches t = 1 every die has
  // been counted and only the all-counted state carries mass.
  const finalBase = (stateCount - 1) * width;
  const result = new Map<number, number>();
  for (let k = 0; k <= maxSum; k++) {
    const p = cur[finalBase + k] ?? 0;
    if (p > 0) result.set(k, p);
  }
  return result;
}

function mirrorGroups(groups: readonly DieGroup[], maxFace: number): DieGroup[] {
  return groups.map((g) => {
    const faces: number[] = [];
    const probs: number[] = [];
    for (let i = g.faces.length - 1; i >= 0; i--) {
      faces.push(maxFace + 1 - (g.faces[i] ?? 0));
      probs.push(g.probs[i] ?? 0);
    }
    return { faces, probs, count: g.count };
  });
}

/**
 * Keep the highest or lowest n dice across every part of a roll, then sum them.
 * Unlike the per-part keep rule this works across dice of different sizes, so a
 * trait die plus a wild die can be compared as one roll.
 */
export function keepAcrossDistribution(
  parts: readonly DicePart[],
  rule: KeepRule,
): Distribution {
  if (!Number.isInteger(rule.n) || rule.n < 1) return emptyDistribution();

  const groups = buildGroups(parts);
  if (groups === null) return emptyDistribution();

  return keepFromGroups(groups, rule);
}

/**
 * The same walk over one group of identical dice, given the face distribution
 * already built.
 *
 * A per-part keep rule is the one-group case of keeping across parts, so it runs
 * the same dynamic program rather than enumerating every way the dice could have
 * landed. The enumeration it replaces costs a weak composition of `count` over
 * the die's distinct faces, which is fine for a plain d6 and is not fine once a
 * chain puts 56 faces on it.
 *
 * It takes the distribution rather than the part because partDistribution has
 * already built it, and buildGroups would build it again on every keystroke.
 */
export function keepFromSingleDie(
  single: Distribution,
  count: number,
  rule: KeepRule,
): Distribution {
  if (!Number.isInteger(rule.n) || rule.n < 1) return emptyDistribution();
  if (!Number.isInteger(count) || count < 1) return emptyDistribution();
  if (single.size === 0) return emptyDistribution();

  const faces = sortedKeys(single);
  const group: DieGroup = {
    faces,
    probs: faces.map((f) => single.get(f) ?? 0),
    count,
  };
  return keepFromGroups([group], rule);
}

function keepFromGroups(groups: readonly DieGroup[], rule: KeepRule): Distribution {
  const maxFace = maxFaceOf(groups);
  if (maxFace < 1) return emptyDistribution();

  const totalDice = totalDiceOf(groups);

  if (rule.n >= totalDice) {
    const perDie: Distribution[] = [];
    for (const g of groups) {
      const single = new Map<number, number>();
      for (let i = 0; i < g.faces.length; i++) {
        single.set(g.faces[i] ?? 0, g.probs[i] ?? 0);
      }
      for (let i = 0; i < g.count; i++) perDie.push(single);
    }
    return convolveMany(perDie);
  }

  if (rule.n === 1) {
    return rule.type === 'highest'
      ? keepHighestOne(groups, maxFace)
      : keepLowestOne(groups, maxFace);
  }

  if (rule.type === 'highest') {
    return keepHighestSum(groups, rule.n, maxFace);
  }

  // Lowest n of v is the highest n of (maxFace + 1 - v), read back through the
  // same reflection. Keeps one DP instead of two mirror-image ones.
  const mirrored = keepHighestSum(mirrorGroups(groups, maxFace), rule.n, maxFace);
  const offset = rule.n * (maxFace + 1);
  const result = new Map<number, number>();
  for (const [k, p] of mirrored) {
    result.set(offset - k, (result.get(offset - k) ?? 0) + p);
  }
  return result;
}
