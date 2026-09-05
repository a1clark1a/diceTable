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
  /** A total on a numeric column, a success count on a pool column. */
  value: number;
  /** True when the column measures success counts rather than totals. */
  pool: boolean;
}

// Two axes side by side: the numeric targets sum rows answer to, then the pool
// targets pool rows answer to. Each axis appears only when the table holds both
// a target of that kind and a row that can measure it, so neither kind of row
// has to squat under a column that means nothing to it.
export function targetColumns(
  target: TargetState,
  poolTargets: number[],
  hasPools: boolean,
  hasSums: boolean,
): TargetColumn[] {
  const columns: TargetColumn[] = [];
  if (hasSums) {
    for (const value of target.values) columns.push({ value, pool: false });
  }
  if (hasPools) {
    for (const value of poolTargets) columns.push({ value, pool: true });
  }
  return columns;
}

// The two axes can carry the same number (numeric target 3 beside pool target
// 3), so the prefix is what keeps their keys apart.
export function columnKey(column: TargetColumn): string {
  return `${column.pool ? 'pool' : 'num'}-${column.value}`;
}

// The single place that decides which question a cell answers: a numeric column
// reads a total under the shared ruling, a pool column reads a minimum success
// count.
export function rowHitChance(
  row: TargetRow,
  column: TargetColumn,
  ruling: TargetRuling,
): number {
  return column.pool
    ? hitProbability(row.dist, column.value, 'gte')
    : hitProbability(row.dist, column.value, ruling);
}

// Each axis is answered only by the rows on its scale: totals under the numeric
// columns, success counts under the pool ones.
export function rowShowsUnderTarget(
  row: TargetRow,
  column: TargetColumn,
): boolean {
  return column.pool === row.isPool;
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
