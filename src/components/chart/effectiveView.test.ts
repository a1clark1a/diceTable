import { describe, expect, it } from 'vitest';
import {
  effectiveChartView,
  shapeHeaderView,
  targetViewAvailable,
} from './effectiveView';
import type { ChartView, Expression, TargetState } from '../../types';

function sumExpr(id: string): Expression {
  return {
    id,
    name: `${id} name`,
    parts: [{ id: `${id}-p0`, count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
}

function poolExpr(id: string): Expression {
  return {
    id,
    name: `${id} name`,
    parts: [{ id: `${id}-p0`, count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 4 },
  };
}

function checkExpr(id: string): Expression {
  return {
    id,
    name: `${id} name`,
    parts: [{ id: `${id}-p0`, count: 1, sides: 20 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'check',
    check: {
      threshold: { direction: 'gte', value: 15 },
      effect: {
        parts: [{ id: `${id}-e0`, count: 1, sides: 6 }],
        flatModifier: 0,
      },
      onSuccess: 'full',
      onFailure: 'none',
    },
  };
}

const noValues: TargetState = { values: [], ruling: 'gte' };
const withValues: TargetState = { values: [10], ruling: 'gte' };

const DISTRIBUTION_VIEWS: ChartView[] = ['pmf', 'cdf', 'ccdf'];

describe('effectiveChartView', () => {
  it('falls back to the distribution view when the target view has nothing to measure', () => {
    expect(effectiveChartView('target', false)).toBe('pmf');
  });

  it('keeps the target view when there is something to measure', () => {
    expect(effectiveChartView('target', true)).toBe('target');
  });

  it('never rewrites a distribution view, whether or not a target is available', () => {
    for (const view of DISTRIBUTION_VIEWS) {
      expect(effectiveChartView(view, true)).toBe(view);
      expect(effectiveChartView(view, false)).toBe(view);
    }
  });
});

describe('targetViewAvailable', () => {
  it('offers the target view when numeric targets are set and no row is a pool', () => {
    expect(targetViewAvailable(withValues, [sumExpr('a'), sumExpr('b')])).toBe(true);
  });

  it('offers the target view for a pool row even with no numeric target set', () => {
    expect(targetViewAvailable(noValues, [poolExpr('p')])).toBe(true);
  });

  it('offers the target view when the pool row sits below other rows', () => {
    expect(
      targetViewAvailable(noValues, [sumExpr('a'), checkExpr('c'), poolExpr('p')]),
    ).toBe(true);
  });

  it('offers the target view when both a numeric target and a pool row are present', () => {
    expect(targetViewAvailable(withValues, [sumExpr('a'), poolExpr('p')])).toBe(true);
  });

  it('withholds the target view when no numeric target is set and no row is a pool', () => {
    expect(targetViewAvailable(noValues, [sumExpr('a'), checkExpr('c')])).toBe(false);
  });

  it('withholds the target view for an empty table with no numeric target', () => {
    expect(targetViewAvailable(noValues, [])).toBe(false);
  });
});

// The pair as ViewBar composes it: availability decides whether the TARGET chip
// survives, so a table of pool rolls has to reach the view with the numeric
// target list still empty.
describe('the view a table resolves to', () => {
  it('stays on the target view for a table of only pool rolls with no numeric target', () => {
    const available = targetViewAvailable(noValues, [poolExpr('p')]);
    expect(effectiveChartView('target', available)).toBe('target');
  });

  it('stays on the target view when a pool roll shares the table with sum rolls', () => {
    const available = targetViewAvailable(noValues, [sumExpr('a'), poolExpr('p')]);
    expect(effectiveChartView('target', available)).toBe('target');
  });

  it('drops off the target view for a table of only sum rolls with no numeric target', () => {
    const available = targetViewAvailable(noValues, [sumExpr('a'), sumExpr('b')]);
    expect(effectiveChartView('target', available)).toBe('pmf');
  });
});

describe('shapeHeaderView', () => {
  const poolTargets = [1, 3];

  it('passes a distribution view straight through whatever the rows are', () => {
    for (const view of DISTRIBUTION_VIEWS) {
      expect(
        shapeHeaderView(view, noValues, poolTargets, [sumExpr('a'), poolExpr('p')]),
      ).toBe(view);
    }
  });

  it('names the target view when every sum row has a numeric target', () => {
    expect(
      shapeHeaderView('target', withValues, poolTargets, [
        sumExpr('a'),
        checkExpr('c'),
      ]),
    ).toBe('target');
  });

  it('names the fallback when sum rows have no numeric target', () => {
    expect(
      shapeHeaderView('target', noValues, poolTargets, [
        sumExpr('a'),
        checkExpr('c'),
      ]),
    ).toBe('pmf');
  });

  it('names the target view for a pool-only table with no numeric target', () => {
    expect(shapeHeaderView('target', noValues, poolTargets, [poolExpr('p')])).toBe(
      'target',
    );
  });

  it('names the fallback for a pool-only table whose pool target list is empty', () => {
    expect(shapeHeaderView('target', noValues, [], [poolExpr('p')])).toBe('pmf');
  });

  it('reports disagreement when a pool row draws the target view and a sum row does not', () => {
    expect(
      shapeHeaderView('target', noValues, poolTargets, [
        sumExpr('a'),
        poolExpr('p'),
      ]),
    ).toBeNull();
  });

  it('reports disagreement when a sum row draws the target view and a pool row does not', () => {
    expect(
      shapeHeaderView('target', withValues, [], [sumExpr('a'), poolExpr('p')]),
    ).toBeNull();
  });

  it('names the target view when a mixed table has both kinds of target', () => {
    expect(
      shapeHeaderView('target', withValues, poolTargets, [
        sumExpr('a'),
        poolExpr('p'),
      ]),
    ).toBe('target');
  });

  it('names the fallback when a mixed table has neither kind of target', () => {
    expect(
      shapeHeaderView('target', noValues, [], [sumExpr('a'), poolExpr('p')]),
    ).toBe('pmf');
  });

  it('falls back to the numeric target alone on an empty table', () => {
    expect(shapeHeaderView('target', noValues, poolTargets, [])).toBe('pmf');
    expect(shapeHeaderView('target', withValues, [], [])).toBe('target');
  });
});
