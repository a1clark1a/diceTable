import { describe, expect, it } from 'vitest';
import { chartRowCap, enlargedRowCap, pageCount, pagePanels } from './rowCap';
import type { ChartPanelData } from './useChartPanels';
import {
  CHART_DRAW_POINT_BUDGET,
  CHART_ROW_CAP_ENLARGED,
  CHART_ROW_CAP_RAIL,
  MAX_EXPRESSIONS,
  type TargetState,
} from '../../types';

const TARGET: TargetState = { values: [], ruling: 'gte' };

function panel(
  key: ChartPanelData['key'],
  count: number,
  prefix: string,
): ChartPanelData {
  const ids = Array.from({ length: count }, (_, i) => `${prefix}${i}`);
  return {
    key,
    title: key === 'totals' ? 'Totals' : 'Successes',
    titleTip: 'totalsChart',
    titleColor: 'fg',
    entries: ids.map((id) => ({ id, name: id, color: '#000' })),
    expressions: ids.map((id) => ({
      id,
      name: id,
      parts: [{ id: `${id}-p`, count: 1, sides: 6 }],
      flatModifier: 0,
      rollMode: 'normal' as const,
      mode: 'sum' as const,
    })),
    drawn: count,
    total: count,
    from: 0,
    page: 0,
    effectiveView: 'pmf',
    target: TARGET,
    hasTarget: false,
  };
}

describe('chartRowCap', () => {
  it('gives the rail its own budget at every width', () => {
    expect(chartRowCap('rail', true)).toBe(CHART_ROW_CAP_RAIL);
    expect(chartRowCap('rail', false)).toBe(CHART_ROW_CAP_RAIL);
  });

  it('gives the enlarged copy the bigger budget only when its canvas is wide', () => {
    expect(chartRowCap('enlarged', true)).toBe(CHART_ROW_CAP_ENLARGED);
  });

  it('falls back to the rail budget for a narrow enlarged canvas', () => {
    // A cover dialog on a phone is a 360px canvas, narrower than the desktop
    // rail, so it must not inherit the wide-screen budget.
    expect(chartRowCap('enlarged', false)).toBe(CHART_ROW_CAP_RAIL);
  });
});

describe('pageCount', () => {
  it('is one page for a table that fits, including an empty one', () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(20, 20)).toBe(1);
  });

  it('adds a page for the remainder', () => {
    expect(pageCount(21, 20)).toBe(2);
    expect(pageCount(75, 20)).toBe(4);
  });
});

describe('pagePanels', () => {
  it('hands back the same panel object when it all fits, so nothing re-renders', () => {
    const panels = [panel('totals', 20, 's')];
    expect(pagePanels(panels, 20, {})[0]).toBe(panels[0]);
  });

  it('draws the first page in table order', () => {
    const [totals] = pagePanels([panel('totals', 75, 's')], 20, {});
    expect(totals!.from).toBe(0);
    expect(totals!.drawn).toBe(20);
    expect(totals!.total).toBe(75);
    expect(totals!.entries[0]!.id).toBe('s0');
    expect(totals!.entries[19]!.id).toBe('s19');
  });

  it('moves to the rolls the first page left out', () => {
    const [totals] = pagePanels([panel('totals', 75, 's')], 20, { totals: 1 });
    expect(totals!.from).toBe(20);
    expect(totals!.entries[0]!.id).toBe('s20');
    expect(totals!.entries[19]!.id).toBe('s39');
  });

  it('draws a short last page rather than padding it', () => {
    const [totals] = pagePanels([panel('totals', 75, 's')], 20, { totals: 3 });
    expect(totals!.from).toBe(60);
    expect(totals!.drawn).toBe(15);
    expect(totals!.entries[14]!.id).toBe('s74');
  });

  it('keeps the legend and the curves describing one set', () => {
    const [totals] = pagePanels([panel('totals', 75, 's')], 20, { totals: 2 });
    expect(totals!.expressions.map((e) => e.id)).toEqual(
      totals!.entries.map((e) => e.id),
    );
  });

  it('pages each panel on its own, so one kind cannot push the other off', () => {
    // The budget used to be split in proportion, which mattered while the rows
    // past the cut were unreachable. Every roll is one page away now.
    const [totals, successes] = pagePanels(
      [panel('totals', 75, 's'), panel('successes', 25, 'p')],
      20,
      { totals: 1 },
    );
    expect(totals!.from).toBe(20);
    expect(totals!.drawn).toBe(20);
    expect(successes!.from).toBe(0);
    expect(successes!.drawn).toBe(20);
  });

  it('lands on the last page when rows are deleted out from under it', () => {
    // Page 3 of a 75-row table does not exist once the table is 25 rows, and an
    // empty chart is a worse answer than the last page that does exist.
    const [totals] = pagePanels([panel('totals', 25, 's')], 20, { totals: 3 });
    expect(totals!.page).toBe(1);
    expect(totals!.from).toBe(20);
    expect(totals!.drawn).toBe(5);
  });

  it('treats a negative page as the first one', () => {
    const [totals] = pagePanels([panel('totals', 75, 's')], 20, { totals: -2 });
    expect(totals!.from).toBe(0);
  });
});

describe('enlargedRowCap', () => {
  const solo = panel('totals', 100, 's');
  const all = {
    wideCanvas: true,
    finePointer: true,
    solo,
    drawPoints: 2400,
  };

  it('draws the whole table only when every condition holds', () => {
    expect(enlargedRowCap(all)).toBe(MAX_EXPRESSIONS);
  });

  it('falls back to the rail page on each condition on its own', () => {
    // One assertion per conjunct, because a fallback that fires for the wrong
    // reason is a fallback that will stop firing when that reason changes.
    expect(enlargedRowCap({ ...all, wideCanvas: false })).toBe(
      CHART_ROW_CAP_RAIL,
    );
    expect(enlargedRowCap({ ...all, finePointer: false })).toBe(
      CHART_ROW_CAP_RAIL,
    );
    expect(enlargedRowCap({ ...all, solo: undefined })).toBe(
      CHART_ROW_CAP_RAIL,
    );
    expect(
      enlargedRowCap({ ...all, solo: { ...solo, effectiveView: 'target' } }),
    ).toBe(CHART_ROW_CAP_RAIL);
    expect(
      enlargedRowCap({ ...all, drawPoints: CHART_DRAW_POINT_BUDGET + 1 }),
    ).toBe(CHART_ROW_CAP_RAIL);
  });

  it('admits a draw exactly at the budget', () => {
    expect(
      enlargedRowCap({ ...all, drawPoints: CHART_DRAW_POINT_BUDGET }),
    ).toBe(MAX_EXPRESSIONS);
  });

  it('leaves a whole-table page with nothing to page', () => {
    // pagePanels returns the panel untouched once the page covers it, which is
    // what keeps the pager from mounting without needing a flag to hide it.
    const panels = [panel('totals', 100, 't')];
    expect(pagePanels(panels, MAX_EXPRESSIONS, {})[0]).toBe(panels[0]);
    const paged = pagePanels(panels, CHART_ROW_CAP_RAIL, {})[0];
    expect(paged).not.toBe(panels[0]);
    expect(paged?.drawn).toBe(20);
    expect(paged?.total).toBe(100);
  });
});
