import { hitProbability } from '../../engine/stats';
import { getRowData } from '../../state/useDistributions';
import type { RowStats } from '../../state/rowStats';
import type { Expression, TargetState } from '../../types';

// Half the last printed decimal place: deltas format with two decimals (stats)
// or one decimal of percentage points (hits), so anything below these prints
// as zero and must also tone as 'same'.
export const STAT_DELTA_EPS = 5e-3;
export const HIT_DELTA_EPS = 5e-4;

export interface BaselineComparison {
  id: string;
  name: string;
  isPool: boolean;
  stats: RowStats;
  /**
   * Sum baseline: one entry per toolbar target. Pool baseline: one entry per
   * shared pool target. Null when no targets are set.
   */
  hits: number[] | null;
}

/** The pinned row itself, which is the only row the comparison reads. */
export function baselineRowOf(
  expressions: Expression[],
  baselineId: string | null,
): Expression | undefined {
  if (baselineId === null) return undefined;
  return expressions.find((e) => e.id === baselineId);
}

/**
 * Split from the lookup so a caller can depend on the pinned row rather than on
 * the whole list. The comparison reads exactly one row, so keying it on the
 * array rebuilds it whenever any other row is edited, which hands every row a
 * fresh object and defeats the memo on all of them.
 */
export function comparisonFor(
  baseline: Expression | undefined,
  target: TargetState,
  poolTargets: number[],
): BaselineComparison | null {
  if (baseline === undefined) return null;
  const { stats, tooComplex } = getRowData(baseline);
  if (!stats.hasDist || tooComplex) return null;

  const isPool = baseline.mode === 'pool';
  const hits = isPool
    ? poolTargets.map((n) => hitProbability(stats.dist, n, 'gte'))
    : target.values.length === 0
      ? null
      : target.values.map((v) => hitProbability(stats.dist, v, target.ruling));

  return {
    id: baseline.id,
    name: baseline.name,
    isPool,
    stats,
    hits,
  };
}
