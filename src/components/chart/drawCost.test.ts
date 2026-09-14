import { describe, expect, it } from 'vitest';
import { CHART_DRAW_POINT_BUDGET, type Expression } from '../../types';
import { panelDrawPoints } from './drawCost';

// Real expressions through the real cache, not stubs: the number this returns
// has to track what seriesXs will actually plot, and a stub would let the two
// drift without a test noticing.
function roll(id: string, count: number, sides: number): Expression {
  return {
    id,
    name: id,
    parts: [{ id: `p-${id}`, count, sides }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
}

describe('panelDrawPoints', () => {
  it('counts a row as its support plus its flat anchors', () => {
    // 1d20 spans 1..20, so twenty points plus at most two anchors a side.
    expect(panelDrawPoints([roll('a', 1, 20)])).toBe(24);
    // 20d100 spans 20..2000.
    expect(panelDrawPoints([roll('b', 20, 100)])).toBe(1985);
  });

  it('admits a hundred narrow rows', () => {
    const rows = Array.from({ length: 100 }, (_, i) => roll(`r${i}`, 1, 20));
    expect(panelDrawPoints(rows)).toBe(2400);
    expect(panelDrawPoints(rows)).toBeLessThanOrEqual(CHART_DRAW_POINT_BUDGET);
  });

  it('refuses a hundred wide ones', () => {
    // This is the case the budget exists for: the draw is unaffordable at a
    // hundred curves however legible the picture would have been.
    const rows = Array.from({ length: 100 }, (_, i) => roll(`r${i}`, 3, 100));
    expect(panelDrawPoints(rows)).toBeGreaterThan(CHART_DRAW_POINT_BUDGET);
  });

  it('ignores a row with nothing to draw', () => {
    const empty: Expression = { ...roll('e', 1, 6), parts: [] };
    expect(panelDrawPoints([empty])).toBe(0);
  });
});
