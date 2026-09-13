import { describe, expect, it } from 'vitest';
import { capPanels, chartRowCap } from './rowCap';
import type { ChartPanelData } from './useChartPanels';
import {
  CHART_ROW_CAP_ENLARGED,
  CHART_ROW_CAP_RAIL,
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

describe('capPanels', () => {
  it('leaves a table inside the budget untouched, object identity included', () => {
    const panels = [panel('totals', 5, 's')];
    expect(capPanels(panels, 20)).toBe(panels);
  });

  it('leaves a table exactly at the budget untouched', () => {
    const panels = [panel('totals', 20, 's')];
    expect(capPanels(panels, 20)).toBe(panels);
  });

  it('cuts in table order and records what it drew', () => {
    const [totals] = capPanels([panel('totals', 21, 's')], 20);
    expect(totals!.drawn).toBe(20);
    expect(totals!.total).toBe(21);
    expect(totals!.entries.map((e) => e.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => `s${i}`),
    );
  });

  it('keeps the legend and the curves describing one set', () => {
    const [totals] = capPanels([panel('totals', 30, 's')], 20);
    expect(totals!.expressions.map((e) => e.id)).toEqual(
      totals!.entries.map((e) => e.id),
    );
  });

  it('splits the budget in proportion so neither kind is starved off', () => {
    const [totals, successes] = capPanels(
      [panel('totals', 25, 's'), panel('successes', 25, 'p')],
      20,
    );
    expect(totals!.drawn).toBe(10);
    expect(successes!.drawn).toBe(10);
    expect(totals!.total).toBe(25);
  });

  it('holds the mounted total at the budget for a lopsided mix', () => {
    const capped = capPanels(
      [panel('totals', 40, 's'), panel('successes', 10, 'p')],
      20,
    );
    const drawn = capped.reduce((n, p) => n + p.entries.length, 0);
    // 16 + 4 exactly; the floor of two never has to fire here.
    expect(drawn).toBe(20);
  });

  it('never draws a panel with a single curve, which would compare nothing', () => {
    // One pool row among fifty sum rows: its proportional share rounds to zero.
    const [, successes] = capPanels(
      [panel('totals', 50, 's'), panel('successes', 3, 'p')],
      20,
    );
    expect(successes!.drawn).toBe(2);
  });

  it('leaves a panel whole when its share already covers it', () => {
    const [, successes] = capPanels(
      [panel('totals', 20, 's'), panel('successes', 1, 'p')],
      20,
    );
    // Its share rounds below its single row, so the row survives uncut and the
    // panel reports no cut at all.
    expect(successes!.drawn).toBe(1);
    expect(successes!.total).toBe(1);
  });
});
