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
   * Sum baseline: one entry per toolbar target. Pool baseline: a single entry
   * against the shared pool target. Null when no targets are set.
   */
  hits: number[] | null;
  /**
   * Largest absolute delta among same-scale rows, shared so bar lengths in a
   * column are comparable between rows.
   */
  maxMeanDelta: number;
  maxSigmaDelta: number;
}

/** Null when no baseline is pinned or the pinned row has no usable distribution. */
export function buildBaselineComparison(
  expressions: Expression[],
  baselineId: string | null,
  target: TargetState,
  poolTarget: number,
): BaselineComparison | null {
  if (baselineId === null) return null;
  const baseline = expressions.find((e) => e.id === baselineId);
  if (baseline === undefined) return null;
  const { stats, tooComplex } = getRowData(baseline);
  if (!stats.hasDist || tooComplex) return null;

  const isPool = baseline.mode === 'pool';
  const hits =
    target.values.length === 0
      ? null
      : isPool
        ? [hitProbability(stats.dist, poolTarget, 'gte')]
        : target.values.map((v) => hitProbability(stats.dist, v, target.ruling));

  let maxMeanDelta = 0;
  let maxSigmaDelta = 0;
  for (const expr of expressions) {
    if (expr.id === baselineId) continue;
    if ((expr.mode === 'pool') !== isPool) continue;
    const row = getRowData(expr);
    if (!row.stats.hasDist || row.tooComplex) continue;
    maxMeanDelta = Math.max(
      maxMeanDelta,
      Math.abs(row.stats.mean - stats.mean),
    );
    maxSigmaDelta = Math.max(
      maxSigmaDelta,
      Math.abs(row.stats.stddev - stats.stddev),
    );
  }

  return {
    id: baseline.id,
    name: baseline.name,
    isPool,
    stats,
    hits,
    maxMeanDelta,
    maxSigmaDelta,
  };
}
