import { CHART_ROW_CAP_ENLARGED, CHART_ROW_CAP_RAIL } from '../../types';
import type { ChartPanelData } from './useChartPanels';

/** Which frame is asking. The rail is the glance; the dialog has more room. */
export type ChartSurface = 'rail' | 'enlarged';

/**
 * The budget keys off how much canvas there actually is, not off which frame is
 * asking. The enlarged copy is a cover dialog, so on a 360px phone it is a
 * 360px canvas, narrower than the desktop rail: it takes the rail's number
 * there rather than the one it gets on a wide screen.
 */
export function chartRowCap(surface: ChartSurface, wideCanvas: boolean): number {
  return surface === 'enlarged' && wideCanvas
    ? CHART_ROW_CAP_ENLARGED
    : CHART_ROW_CAP_RAIL;
}

/**
 * Share one budget between the panels and record what was cut.
 *
 * Proportional rather than a flat cap each, so a mixed table cannot mount twice
 * the series a single-kind table does, and so one kind cannot starve the other
 * off the surface. Same shape as the target-hit card's split, with a floor of
 * two instead of one: a panel drawn with a single curve compares nothing.
 *
 * Cut in table order. There is no reorder action, so the newest row is always
 * the one dropped, and "the first N" is a fact the caption can state without
 * the user having to know a rule.
 */
export function capPanels(
  panels: ChartPanelData[],
  cap: number,
): ChartPanelData[] {
  const total = panels.reduce((n, p) => n + p.entries.length, 0);
  if (total <= cap) return panels;

  const share = (n: number): number =>
    n === 0 ? 0 : Math.max(2, Math.floor((n / total) * cap));

  return panels.map((panel) => {
    const keep = share(panel.entries.length);
    if (keep >= panel.entries.length) return panel;
    return {
      ...panel,
      // Both lists are built in one pass and stay index-aligned, so the same
      // slice keeps the legend and the curves describing one set.
      entries: panel.entries.slice(0, keep),
      expressions: panel.expressions.slice(0, keep),
      drawn: keep,
      total: panel.entries.length,
    };
  });
}
