import type { ChartView, TargetState } from '../../types';

export function effectiveChartView(
  chartView: ChartView,
  target: TargetState,
): ChartView {
  return chartView === 'target' && target.values.length === 0 ? 'pmf' : chartView;
}
