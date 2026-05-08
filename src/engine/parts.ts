import type { DicePart, Distribution, ExplodeRule, KeepRule, RerollRule } from '../types';
import {
  convolve,
  emptyDistribution,
  sortedKeys,
  uniformDistribution,
} from './distribution';
import { partTooComplex } from './complexity';

const DEFAULT_EXPLODE_CAP = 10;

export function applyReroll(base: Distribution, rule: RerollRule): Distribution {
  if (base.size === 0) return emptyDistribution();
  const valueSet = new Set(rule.values);

  if (rule.mode === 'always') {
    let pIn = 0;
    for (const [k, p] of base) {
      if (valueSet.has(k)) pIn += p;
    }
    const remaining = 1 - pIn;
    if (remaining <= 0) return emptyDistribution();
    const result = new Map<number, number>();
    for (const [k, p] of base) {
      if (!valueSet.has(k)) result.set(k, p / remaining);
    }
    return result;
  }

  let pIn = 0;
  for (const [k, p] of base) {
    if (valueSet.has(k)) pIn += p;
  }
  const result = new Map<number, number>();
  for (const [k, p] of base) {
    const kept = valueSet.has(k) ? 0 : p;
    const fromReroll = pIn * p;
    const total = kept + fromReroll;
    if (total > 0) result.set(k, total);
  }
  return result;
}

export function applyExplode(base: Distribution, rule: ExplodeRule): Distribution {
  if (base.size === 0) return emptyDistribution();
  const cap = Number.isInteger(rule.depthCap) && rule.depthCap >= 0
    ? rule.depthCap
    : DEFAULT_EXPLODE_CAP;
  if (cap === 0) return new Map(base);

  const onSet = new Set(rule.onFaces);
  let pExplode = 0;
  for (const [k, p] of base) {
    if (onSet.has(k)) pExplode += p;
  }
  if (pExplode <= 0) return new Map(base);
  if (pExplode >= 1) return emptyDistribution();

  let result: Distribution = new Map(base);
  for (let depth = 0; depth < cap; depth++) {
    const next = new Map<number, number>();
    for (const [face, pf] of base) {
      if (onSet.has(face)) {
        for (const [k, pk] of result) {
          const total = face + k;
          next.set(total, (next.get(total) ?? 0) + pf * pk);
        }
      } else {
        next.set(face, (next.get(face) ?? 0) + pf);
      }
    }
    result = next;
  }
  return result;
}

function applyKeep(singleDie: Distribution, count: number, rule: KeepRule): Distribution {
  const n = rule.n;
  if (!Number.isInteger(n) || n < 1 || n > count) return emptyDistribution();

  const faces = sortedKeys(singleDie);
  const probs = faces.map((f) => singleDie.get(f) as number);
  const F = faces.length;
  if (F === 0) return emptyDistribution();

  const logFact: number[] = [0];
  for (let i = 1; i <= count; i++) logFact.push(logFact[i - 1]! + Math.log(i));

  const result = new Map<number, number>();
  const counts: number[] = new Array(F).fill(0);

  function recurse(idx: number, remaining: number): void {
    if (idx === F - 1) {
      counts[idx] = remaining;
      let logProb = logFact[count]!;
      for (let i = 0; i < F; i++) {
        const c = counts[i]!;
        if (c > 0) {
          logProb += c * Math.log(probs[i]!) - logFact[c]!;
        }
      }
      const prob = Math.exp(logProb);

      let kept = 0;
      if (rule.type === 'highest') {
        let toTake = n;
        for (let i = F - 1; i >= 0 && toTake > 0; i--) {
          const take = Math.min(toTake, counts[i]!);
          kept += take * faces[i]!;
          toTake -= take;
        }
      } else {
        let toTake = n;
        for (let i = 0; i < F && toTake > 0; i++) {
          const take = Math.min(toTake, counts[i]!);
          kept += take * faces[i]!;
          toTake -= take;
        }
      }
      result.set(kept, (result.get(kept) ?? 0) + prob);
      return;
    }
    for (let c = 0; c <= remaining; c++) {
      counts[idx] = c;
      recurse(idx + 1, remaining - c);
    }
  }

  recurse(0, count);
  return result;
}

export function singleDieDistribution(part: DicePart): Distribution {
  if (!Number.isInteger(part.sides) || part.sides < 2) return emptyDistribution();
  let dist = uniformDistribution(part.sides);
  if (part.reroll) dist = applyReroll(dist, part.reroll);
  if (dist.size === 0) return emptyDistribution();
  if (part.explode) dist = applyExplode(dist, part.explode);
  return dist;
}

export function partDistribution(part: DicePart): Distribution {
  if (!Number.isInteger(part.count) || part.count < 1) return emptyDistribution();
  if (!Number.isInteger(part.sides) || part.sides < 2) return emptyDistribution();
  if (partTooComplex(part)) return emptyDistribution();

  const single = singleDieDistribution(part);
  if (single.size === 0) return emptyDistribution();

  if (part.keep) {
    return applyKeep(single, part.count, part.keep);
  }

  let result: Distribution = new Map(single);
  for (let i = 1; i < part.count; i++) {
    result = convolve(result, single);
    if (result.size === 0) return emptyDistribution();
  }
  return result;
}
