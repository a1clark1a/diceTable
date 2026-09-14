import type { DicePart, Distribution, ExplodeRule, RerollRule } from '../types';
import { emptyDistribution, uniformDistribution } from './distribution';

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

// The check die crits on the face it shows, never on a chain total, so its
// explosion needs the first draw and the continuation draws to come from
// different distributions: `first` carries the (possibly restricted) outer face
// mass, while every further die in a chain is a full `continuation` draw that
// keeps exploding on the rule's faces. With first === continuation this is
// exactly applyExplode.
export function explodeFrom(
  first: Distribution,
  continuation: Distribution,
  rule: ExplodeRule,
): Distribution {
  if (first.size === 0) return emptyDistribution();
  const cap = Number.isInteger(rule.depthCap) && rule.depthCap >= 0
    ? rule.depthCap
    : DEFAULT_EXPLODE_CAP;
  const onSet = new Set(rule.onFaces);
  let pExplode = 0;
  for (const [k, p] of first) {
    if (onSet.has(k)) pExplode += p;
  }
  if (cap === 0 || pExplode <= 0) return new Map(first);

  const tail = applyExplode(continuation, { ...rule, depthCap: cap - 1 });
  if (tail.size === 0) return emptyDistribution();

  const result = new Map<number, number>();
  for (const [face, pf] of first) {
    if (onSet.has(face)) {
      for (const [k, pk] of tail) {
        const total = face + k;
        result.set(total, (result.get(total) ?? 0) + pf * pk);
      }
    } else {
      result.set(face, (result.get(face) ?? 0) + pf);
    }
  }
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

