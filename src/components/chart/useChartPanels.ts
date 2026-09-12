import { useMemo } from 'react';
import { isTotalsMode } from '../../engine/expression';
import { useApp } from '../../state/useApp';
import { useDistributions } from '../../state/useDistributions';
import {
  CHART_ROW_LIMIT,
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
  effectiveView: ChartView;
  target: TargetState;
  /** Whether this panel's own scale has a target to measure against. */
  hasTarget: boolean;
}

export interface ChartPanels {
  panels: ChartPanelData[];
  dists: Map<string, Distribution>;
  colors: Map<string, string>;
  overLimit: boolean;
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

  const overLimit = expressions.length > CHART_ROW_LIMIT;

  // Keyed by unfiltered row position so the sum/pool split cannot shift any
  // series off its table swatch color.
  const colors = useMemo(() => {
    const map = new Map<string, string>();
    expressions.forEach((expr, idx) => map.set(expr.id, rowColor(idx)));
    return map;
  }, [expressions]);

  // Pool rows answer to the shared pool targets, not the numeric target list.
  const poolTargetState = useMemo<TargetState>(
    () => ({ values: poolTargets, ruling: 'gte' }),
    [poolTargets],
  );

  const panels = useMemo(() => {
    const sum: LegendEntry[] = [];
    const pool: LegendEntry[] = [];
    if (!overLimit) {
      expressions.forEach((expr, idx) => {
        const dist = dists.get(expr.id);
        if (!dist || dist.size === 0) return;
        const entry: LegendEntry = {
          id: expr.id,
          name: expr.name,
          color: rowColor(idx),
        };
        if (isTotalsMode(expr)) sum.push(entry);
        else pool.push(entry);
      });
    }

    const out: ChartPanelData[] = [];
    if (sum.length > 0) {
      out.push({
        key: 'totals',
        title: 'Totals',
        titleTip: 'totalsChart',
        titleColor: 'fg',
        entries: sum,
        expressions: expressions.filter(isTotalsMode),
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
        entries: pool,
        expressions: expressions.filter((e) => !isTotalsMode(e)),
        // A pool target always exists, so this panel can reach the target view
        // even while the numeric target list is empty.
        effectiveView: effectiveChartView(chartViews.successes, true),
        target: poolTargetState,
        hasTarget: true,
      });
    }
    return out;
  }, [overLimit, expressions, dists, chartViews, target, poolTargetState]);

  return {
    panels,
    dists,
    colors,
    overLimit,
    rowCount: expressions.length,
  };
}
