import { getRowData } from '../../state/useDistributions';
import { rowColor } from '../chart/palette';
import type { Distribution, Expression } from '../../types';

export interface CompareRow {
  expr: Expression;
  color: string;
  isPool: boolean;
  dist: Distribution;
}

// Rows join the comparison views only with computable dice. The color index is
// the table position, so swatches keep matching the chart legend even when a
// row in between drops out.
export function toCompareRows(expressions: Expression[]): CompareRow[] {
  return expressions.flatMap((expr, idx) => {
    const { stats, tooComplex } = getRowData(expr);
    if (!stats.hasDist || tooComplex) return [];
    return [
      {
        expr,
        color: rowColor(idx),
        isPool: expr.mode === 'pool',
        dist: stats.dist,
      },
    ];
  });
}

// Pool rows compare on a different scale by design; the caption owns that
// explanation instead of a silent exclusion.
export const MIXED_SCALE_NOTE =
  'Pool rows compare their success counts against the other rolls’ totals, so cross-scale match-ups are usually lopsided.';

export function hasMixedScales(rows: CompareRow[]): boolean {
  return rows.some((r) => r.isPool) && rows.some((r) => !r.isPool);
}
