import { useMemo } from 'react';
import { useApp } from './useApp';
import { expressionDistribution } from '../engine/expression';
import { expressionTooComplex } from '../engine/complexity';
import { computeRowStats, type RowStats } from './rowStats';
import type { Distribution, Expression } from '../types';

export interface RowData {
  dist: Distribution;
  tooComplex: boolean;
  stats: RowStats;
}

export interface DistributionsSelector {
  dists: Map<string, Distribution>;
  tooComplex: Set<string>;
}

const cache: WeakMap<Expression, RowData> = new WeakMap();

export function getRowData(expr: Expression): RowData {
  let entry = cache.get(expr);
  if (entry === undefined) {
    const dist = expressionDistribution(expr);
    entry = {
      dist,
      tooComplex: expressionTooComplex(expr),
      stats: computeRowStats(dist),
    };
    cache.set(expr, entry);
  }
  return entry;
}

export function useDistributions(): DistributionsSelector {
  const { expressions } = useApp();

  return useMemo(() => {
    const dists = new Map<string, Distribution>();
    const tooComplex = new Set<string>();
    for (const expr of expressions) {
      const entry = getRowData(expr);
      dists.set(expr.id, entry.dist);
      if (entry.tooComplex) tooComplex.add(expr.id);
    }
    return { dists, tooComplex };
  }, [expressions]);
}
