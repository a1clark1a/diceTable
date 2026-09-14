import { getRowData } from '../../state/useDistributions';
import type { Expression } from '../../types';

/**
 * Roughly how many points a panel would plot, without plotting them.
 *
 * `seriesXs` gives each series its own support plus at most two flat anchors a
 * side, so the support width plus four is the upper bound and the fifth is the
 * inclusive endpoint. Every read goes through the per-Expression cache, so this
 * is a walk over already-computed stats rather than a second convolution.
 *
 * Rows with no distribution contribute nothing, matching `buildSeries`, which
 * drops them before anything is drawn.
 */
export function panelDrawPoints(expressions: readonly Expression[]): number {
  let points = 0;
  for (const expr of expressions) {
    const { stats } = getRowData(expr);
    if (!stats.hasDist) continue;
    points += stats.max - stats.min + 5;
  }
  return points;
}
