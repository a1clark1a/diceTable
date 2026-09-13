import { useMemo } from 'react';
import { isTotalsMode } from '../../engine/expression';
import { useApp } from '../../state/useApp';
import { useDistributions } from '../../state/useDistributions';
import {
  type ChartView,
  type Distribution,
  type Expression,
  type TargetState,
} from '../../types';
import { rowColor } from './palette';
import { effectiveChartView } from './effectiveView';

export interface LegendEntry {
  id: string;
  name: string;
  color: string;
}

export interface ChartPanelData {
  key: 'totals' | 'successes';
  title: string;
  titleTip: string;
  titleColor: string;
  entries: LegendEntry[];
  expressions: Expression[];
  /** Curves actually drawn, and how many this panel had to choose from. */
  drawn: number;
  total: number;
  effectiveView: ChartView;
  target: TargetState;
  /** Whether this panel's own scale has a target to measure against. */
  hasTarget: boolean;
}

export interface ChartPanels {
  panels: ChartPanelData[];
  dists: Map<string, Distribution>;
  slots: Map<string, number>;
  rowCount: number;
}

/**
 * Everything the comparison panels need except the hover, which stays with
 * whoever frames them. Lifted out of OverlayChart so a second frame can render
 * the same panel rather than redrawing one of its own.
 */
export function useChartPanels(): ChartPanels {
  const { expressions, chartViews, target, poolTargets } = useApp();
  const { dists } = useDistributions();

  // The unfiltered row position, which is the one thing every surface agrees
  // on: the table swatch, the legend, the line and the shared picture all key
  // off it. Handing out the position rather than a resolved color is what stops
  // the stroke and the dash being derived from two different indices.
  const slots = useMemo(() => {
    const map = new Map<string, number>();
    expressions.forEach((expr, idx) => map.set(expr.id, idx));
    return map;
  }, [expressions]);

  // Pool rows answer to the shared pool targets, not the numeric target list.
  const poolTargetState = useMemo<TargetState>(
    () => ({ values: poolTargets, ruling: 'gte' }),
    [poolTargets],
  );

  const panels = useMemo(() => {
    // One pass building the legend entry and its expression together. They used
    // to be built from two different lists, the entries skipping rows with no
    // distribution and the expressions not, so the legend and the curves could
    // describe different sets and any count taken off one would be wrong.
    const sum: { entry: LegendEntry; expr: Expression }[] = [];
    const pool: { entry: LegendEntry; expr: Expression }[] = [];
    expressions.forEach((expr, idx) => {
      const dist = dists.get(expr.id);
      if (!dist || dist.size === 0) return;
      const pair = {
        entry: { id: expr.id, name: expr.name, color: rowColor(idx) },
        expr,
      };
      if (isTotalsMode(expr)) sum.push(pair);
      else pool.push(pair);
    });

    const out: ChartPanelData[] = [];
    if (sum.length > 0) {
      out.push({
        key: 'totals',
        title: 'Totals',
        titleTip: 'totalsChart',
        titleColor: 'fg',
        entries: sum.map((p) => p.entry),
        expressions: sum.map((p) => p.expr),
        drawn: sum.length,
        total: sum.length,
        effectiveView: effectiveChartView(
          chartViews.totals,
          target.values.length > 0,
        ),
        target,
        hasTarget: target.values.length > 0,
      });
    }
    if (pool.length > 0) {
      out.push({
        key: 'successes',
        title: 'Successes',
        titleTip: 'successesChart',
        titleColor: 'purple.fg',
        entries: pool.map((p) => p.entry),
        expressions: pool.map((p) => p.expr),
        drawn: pool.length,
        total: pool.length,
        // A pool target always exists, so this panel can reach the target view
        // even while the numeric target list is empty.
        effectiveView: effectiveChartView(chartViews.successes, true),
        target: poolTargetState,
        hasTarget: true,
      });
    }
    return out;
  }, [expressions, dists, chartViews, target, poolTargetState]);

  return {
    panels,
    dists,
    slots,
    rowCount: expressions.length,
  };
}
