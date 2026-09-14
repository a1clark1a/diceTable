import { getRowData } from '../../state/useDistributions';
import { hitProbability } from '../../engine/stats';
import { rowColor, rowColorHex } from '../chart/palette';
import type {
  Distribution,
  Expression,
  TargetRuling,
  TargetState,
} from '../../types';

export interface TargetRow {
  id: string;
  name: string;
  /** Unfiltered row position, so the picture dashes the way the screen does. */
  slot: number;
  color: string;
  isPool: boolean;
  dist: Distribution;
  min: number;
  max: number;
}

// theme is passed only by the share image, which leaves the app and so cannot
// carry the CSS variable the screen uses.
export function toTargetRows(
  expressions: Expression[],
  theme?: 'light' | 'dark',
): TargetRow[] {
  return expressions.flatMap((expr, idx) => {
    const { stats, tooComplex } = getRowData(expr);
    if (!stats.hasDist || tooComplex) return [];
    return [
      {
        id: expr.id,
        name: expr.name,
        slot: idx,
        color: theme === undefined ? rowColor(idx) : rowColorHex(idx, theme),
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
