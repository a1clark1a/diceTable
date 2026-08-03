import { getRowData } from '../../state/useDistributions';
import { hitProbability } from '../../engine/stats';
import { rowColor } from '../chart/palette';
import type { Distribution, Expression, TargetRuling } from '../../types';

export interface TargetRow {
  id: string;
  name: string;
  color: string;
  isPool: boolean;
  dist: Distribution;
  min: number;
  max: number;
}

export function toTargetRows(expressions: Expression[]): TargetRow[] {
  return expressions.flatMap((expr, idx) => {
    const { stats, tooComplex } = getRowData(expr);
    if (!stats.hasDist || tooComplex) return [];
    return [
      {
        id: expr.id,
        name: expr.name,
        color: rowColor(idx),
        isPool: expr.mode === 'pool',
        dist: stats.dist,
        min: stats.min,
        max: stats.max,
      },
    ];
  });
}

// The single place that decides which target a row answers to: sum rows use
// the toolbar target under the shared ruling, pool rows always measure the
// shared pool target as a minimum success count.
export function rowHitChance(
  row: TargetRow,
  targetValue: number,
  ruling: TargetRuling,
  poolTarget: number,
): number {
  return row.isPool
    ? hitProbability(row.dist, poolTarget, 'gte')
    : hitProbability(row.dist, targetValue, ruling);
}

// A pool row answers one question no matter how many targets are set, so it
// appears only under the first target column or panel.
export function rowShowsUnderTarget(
  row: TargetRow,
  targetIndex: number,
): boolean {
  return !row.isPool || targetIndex === 0;
}

// hitProbability(dist, v, ruling) for every integer v in [min..max], computed
// in one cumulative pass instead of one full-distribution scan per point.
export function hitSeries(
  dist: Distribution,
  min: number,
  max: number,
  ruling: TargetRuling,
): number[] {
  const size = max - min + 1;
  const pmf = new Array<number>(size).fill(0);
  for (const [v, p] of dist) pmf[v - min] = p;
  if (ruling === 'eq') return pmf;
  const out = new Array<number>(size).fill(0);
  if (ruling === 'gte' || ruling === 'gt') {
    let acc = 0;
    for (let i = size - 1; i >= 0; i--) {
      if (ruling === 'gt') {
        out[i] = acc;
        acc += pmf[i] ?? 0;
      } else {
        acc += pmf[i] ?? 0;
        out[i] = acc;
      }
    }
  } else {
    let acc = 0;
    for (let i = 0; i < size; i++) {
      if (ruling === 'lt') {
        out[i] = acc;
        acc += pmf[i] ?? 0;
      } else {
        acc += pmf[i] ?? 0;
        out[i] = acc;
      }
    }
  }
  return out;
}
