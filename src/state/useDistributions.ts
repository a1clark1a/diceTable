import { useMemo } from 'react';
import { useApp } from './useApp';
import { expressionDistribution } from '../engine/expression';
import { expressionTooComplex } from '../engine/complexity';
import type { Distribution, Expression } from '../types';

export interface DistributionsSelector {
  dists: Map<string, Distribution>;
  tooComplex: Set<string>;
}

interface CacheEntry {
  dist: Distribution;
  tooComplex: boolean;
}

const cache: WeakMap<Expression, CacheEntry> = new WeakMap();

export function useDistributions(): DistributionsSelector {
  const { expressions } = useApp();

  return useMemo(() => {
    const dists = new Map<string, Distribution>();
    const tooComplex = new Set<string>();
    for (const expr of expressions) {
      let entry = cache.get(expr);
      if (entry === undefined) {
        entry = {
          dist: expressionDistribution(expr),
          tooComplex: expressionTooComplex(expr),
        };
        cache.set(expr, entry);
      }
      dists.set(expr.id, entry.dist);
      if (entry.tooComplex) tooComplex.add(expr.id);
    }
    return { dists, tooComplex };
  }, [expressions]);
}
