import type { ChartView, Expression, TargetState } from '../../types';

export function effectiveChartView(
  chartView: ChartView,
  hasTarget: boolean,
): ChartView {
  return chartView === 'target' && !hasTarget ? 'pmf' : chartView;
}

// The target view needs something to measure against. Sum rows measure the
// numeric targets, but pool rows always measure the shared pool target, so a
// table holding a pool row can show the view with the numeric list empty.
export function targetViewAvailable(
  target: TargetState,
  expressions: Expression[],
): boolean {
  return (
    target.values.length > 0 || expressions.some((e) => e.mode === 'pool')
  );
}

// The Shape column header names one view, but each row resolves its own: a
// pool row measures the pool targets while a sum row measures the numeric
// ones, so a mixed table in target view really does draw two different things.
// Returning null says "the rows disagree" so the header can stay neutral
// instead of labelling half the column wrong.
export function shapeHeaderView(
  chartView: ChartView,
  target: TargetState,
  poolTargets: number[],
  expressions: Expression[],
): ChartView | null {
  if (chartView !== 'target') return chartView;
  if (expressions.length === 0) {
    return effectiveChartView(
      chartView,
      targetViewAvailable(target, expressions),
    );
  }
  let sawTarget = false;
  let sawFallback = false;
  for (const e of expressions) {
    const hasTarget =
      e.mode === 'pool' ? poolTargets.length > 0 : target.values.length > 0;
    if (hasTarget) sawTarget = true;
    else sawFallback = true;
  }
  if (sawTarget && sawFallback) return null;
  return sawTarget ? 'target' : 'pmf';
}
