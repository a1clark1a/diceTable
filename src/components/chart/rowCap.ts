import {
  CHART_DRAW_POINT_BUDGET,
  CHART_ROW_CAP_ENLARGED,
  CHART_ROW_CAP_RAIL,
} from '../../types';
import type { ChartPanelData } from './useChartPanels';

/** Which frame is asking. The rail is the glance; the dialog has more room. */
export type ChartSurface = 'rail' | 'enlarged';

/**
 * The budget keys off how much canvas there is, not off which frame is asking.
 * The enlarged copy is a cover dialog, so on a 360px phone it is a 360px
 * canvas, narrower than the desktop rail: it takes the rail's number there
 * rather than the one it gets on a wide screen.
 *
 * "Wide" is a media query rather than a measurement of the rendered element,
 * and `enlargedRowCap` below is what decides which one to ask for.
 */
export function chartRowCap(surface: ChartSurface, wideCanvas: boolean): number {
  return surface === 'enlarged' && wideCanvas
    ? CHART_ROW_CAP_ENLARGED
    : CHART_ROW_CAP_RAIL;
}

export interface EnlargedBudget {
  /** Viewport is at least the width the dialog's canvas stops growing at. */
  wideCanvas: boolean;
  /** The device can hover, which is the only way into the field. */
  finePointer: boolean;
  /** The one panel on screen, or undefined when two are sharing the height. */
  solo: ChartPanelData | undefined;
  /** Points that panel would plot; meaningless when solo is undefined. */
  drawPoints: number;
}

/**
 * Whether the enlarged copy gets the whole table or one page of it.
 *
 * Four conjuncts, and each one is a case where the field stops being legible
 * rather than one where it is merely smaller. Two panels halve the height the
 * curves were calibrated at. The target view has no dash channel to carry
 * identity and its bars grow past the dialog. A table wide enough to blow the
 * point budget cannot be drawn at a hundred curves whatever it looks like.
 * Failing any of them takes the rail's number and the pager that goes with it,
 * which is what this surface did before the field existed.
 */
export function enlargedRowCap(input: EnlargedBudget): number {
  const { wideCanvas, finePointer, solo, drawPoints } = input;
  const field =
    wideCanvas &&
    finePointer &&
    solo !== undefined &&
    solo.effectiveView !== 'target' &&
    drawPoints <= CHART_DRAW_POINT_BUDGET;
  return chartRowCap('enlarged', field);
}

/** Zero-based page per panel key. Absent means the first page. */
export type ChartPages = Partial<Record<ChartPanelData['key'], number>>;

/** How many pages of `size` it takes to cover `total`; never fewer than one. */
export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/**
 * One page of curves per panel, in table order.
 *
 * A flat page each rather than one budget shared between them. The budget used
 * to be split in proportion so neither kind could be pushed off the surface
 * entirely, which mattered while the rows past the cut were unreachable. They
 * are not unreachable any more: every roll is one page away, so each panel can
 * simply take a full page and the arithmetic stops needing explaining.
 *
 * Table order, because there is no reorder action and "21 to 40" is a fact the
 * caption can state without the user having to learn a rule first.
 */
export function pagePanels(
  panels: ChartPanelData[],
  size: number,
  pages: ChartPages,
): ChartPanelData[] {
  return panels.map((panel) => {
    const total = panel.entries.length;
    if (total <= size) return panel;

    // A page can fall out of range when rows are deleted, and the honest answer
    // is the last page rather than an empty chart.
    const page = Math.min(Math.max(pages[panel.key] ?? 0, 0), pageCount(total, size) - 1);
    const from = page * size;
    const to = Math.min(from + size, total);
    return {
      ...panel,
      // Both lists are built in one pass and stay index-aligned, so the same
      // slice keeps the legend and the curves describing one set.
      entries: panel.entries.slice(from, to),
      expressions: panel.expressions.slice(from, to),
      drawn: to - from,
      total,
      from,
      page,
    };
  });
}
