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
