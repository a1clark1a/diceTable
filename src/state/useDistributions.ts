import { useMemo } from 'react';
import { useApp } from './useApp';
import { expressionDistribution } from '../engine/expression';
import { expressionTooComplex } from '../engine/complexity';
import { checkOutcomeChances, type CheckOutcomeChances } from '../engine/check';
import { computeRowStats, type RowStats } from './rowStats';
import type { Distribution, Expression } from '../types';

export interface RowData {
  dist: Distribution;
  tooComplex: boolean;
  stats: RowStats;
  /**
   * How often a check row crits, succeeds, and fails; null on a non-check row,
   * on one too complex to enumerate, and on one whose odds cannot be computed.
   * Consumers must show the null honestly (the "(too complex)" treatment), not
   * as a confident 0%.
   */
  checkChances: CheckOutcomeChances | null;
}

export interface DistributionsSelector {
  dists: Map<string, Distribution>;
  tooComplex: Set<string>;
}

// The complexity guard runs before the convolution so a too-heavy check row
// costs nothing here instead of re-running the unguarded enumeration on every
// table-wide render.
function computeCheckChances(
  expr: Expression,
  tooComplex: boolean,
): CheckOutcomeChances | null {
  if (expr.check === undefined || tooComplex) return null;
  const chances = checkOutcomeChances(expr);
  const total = chances.success + chances.crit + chances.failure;
  if (total <= 0) return null;
  // Summing face masses leaves IEEE residue around 1 (twenty exact 1/20ths sum
  // to just over it, six 1/6ths to just under). A check that cannot miss must
  // read as certain, not hedged to >99%, so the residue is scaled out before
  // any formatter sees it.
  if (total !== 1 && Math.abs(total - 1) < 1e-9) {
    return {
      success: chances.success / total,
      crit: chances.crit / total,
      failure: chances.failure / total,
    };
  }
  return chances;
}

// Keyed by Expression *object identity*. Safe today because every patch in
// AppContext returns a new Expression — there is no in-place mutation. If a
// future code path mutates an expression instead of replacing it, this cache
// will return stale stats. Switch to a content-keyed Map (JSON.stringify) if
// that invariant is ever relaxed.
const cache: WeakMap<Expression, RowData> = new WeakMap();

export function getRowData(expr: Expression): RowData {
  let entry = cache.get(expr);
  if (entry === undefined) {
    const dist = expressionDistribution(expr);
    const tooComplex = expressionTooComplex(expr);
    entry = {
      dist,
      tooComplex,
      stats: computeRowStats(dist),
      checkChances: computeCheckChances(expr, tooComplex),
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
