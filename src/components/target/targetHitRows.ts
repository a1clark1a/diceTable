import { getRowData } from '../../state/useDistributions';
import { hitProbability } from '../../engine/stats';
import { rowColor } from '../chart/palette';
import type {
  Distribution,
  Expression,
  TargetRuling,
  TargetState,
} from '../../types';

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

export interface TargetColumn {
  /** What sum rows measure against here; pool rows always use the pool target. */
  value: number;
  /** True when the column is the pool target standing in for an empty list. */
  pool: boolean;
}

// The columns the target views measure. Normally the numeric targets, with
// pool rows riding the first one. With no numeric target set the pool target
// is the only thing left to measure, so it becomes the sole column rather
// than leaving a table of pool rolls with nothing to show.
export function targetColumns(
  target: TargetState,
  poolTarget: number,
  hasPools: boolean,
): TargetColumn[] {
  if (target.values.length > 0)
    return target.values.map((value) => ({ value, pool: false }));
  return hasPools ? [{ value: poolTarget, pool: true }] : [];
}

// The single place that decides which target a row answers to: sum rows use
// the toolbar target under the shared ruling, pool rows always measure the
// shared pool target as a minimum success count.
export function rowHitChance(
  row: TargetRow,
  column: TargetColumn,
  ruling: TargetRuling,
  poolTarget: number,
): number {
  return row.isPool
    ? hitProbability(row.dist, poolTarget, 'gte')
    : hitProbability(row.dist, column.value, ruling);
}

// A pool row answers one question no matter how many targets are set, so it
// appears only under the first column; a pool column is the mirror case,
// where sum rows have nothing to measure.
export function rowShowsUnderTarget(
  row: TargetRow,
  column: TargetColumn,
  columnIndex: number,
): boolean {
  return column.pool ? row.isPool : !row.isPool || columnIndex === 0;
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
