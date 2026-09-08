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

// Under half a percentage point a chance rounds away to nothing, the floor both
// the roll-off view and its share card read before saying anything about ties.
export const TIE_FLOOR = 0.005;

/**
 * The one sentence the roll-off leads with, shared so the picture cannot say
 * something different from the screen it is a picture of. Names are passed in
 * already fit to their space: the card truncates, the view does not.
 */
export function rollOffHeadline(
  top: { name: string; win: number },
  second: { name: string; win: number },
): string {
  // Nobody wins outright, so naming a favourite would be a lie: every track is
  // empty and the ties carry the whole story.
  if (top.win < TIE_FLOOR) return 'These rolls almost always tie.';
  // The gap between the top two decides the phrasing; below one percentage
  // point the race reads as even.
  if (top.win - second.win < 0.01) {
    return `It’s nearly a coin flip between ${top.name} and ${second.name}.`;
  }
  return `${top.name} is most likely to come out on top.`;
}
