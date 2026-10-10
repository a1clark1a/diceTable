import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { RowSparkline, Sparkline, ShapeHeaderLabel } from './Sparkline';
import { convolve, uniformDistribution } from '../../engine/distribution';
import type { TargetState } from '../../types';

const Plain = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

afterEach(() => {
  window.localStorage.clear();
});

function countSubPaths(d: string | null | undefined): number {
  if (!d) return 0;
  return (d.match(/M /g) ?? []).length;
}

describe('Sparkline', () => {
  it('renders nothing for an empty distribution', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={new Map()} color="#000" />
      </Plain>,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders a check row whose only outcome is a miss at full height, uncapped', () => {
    const { container } = render(
      <Plain>
        <Sparkline
          dist={new Map([[0, 1]])}
          color="#000"
          view="pmf"
          mode="check"
        />
      </Plain>,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    // With nothing else in the row to scale against, the miss bar IS the
    // scale, so the cut-off treatment must not appear.
    expect(
      container.querySelector('line[stroke-dasharray="1.5 1.5"]'),
    ).toBeNull();
  });

  it('renders a stepped area path in PMF view', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="pmf" />
      </Plain>,
    );
    const areaPaths = container.querySelectorAll('path[fill-opacity]');
    expect(areaPaths).toHaveLength(1);
    expect(areaPaths[0]?.getAttribute('fill-opacity')).toBe('0.16');
  });

  it('renders a separate stroked top path in PMF view', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="pmf" />
      </Plain>,
    );
    const strokePaths = container.querySelectorAll('path[stroke="#000"]');
    expect(strokePaths.length).toBeGreaterThanOrEqual(1);
  });

  it('renders one hit zone per integer for hover', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" />
      </Plain>,
    );
    expect(
      container.querySelectorAll('rect[fill="transparent"]'),
    ).toHaveLength(6);
  });

  it('renders a stepped line path with no fill in CDF view', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="cdf" />
      </Plain>,
    );
    expect(container.querySelectorAll('path[fill-opacity]')).toHaveLength(0);
    const strokePath = container.querySelector('path[fill="none"]');
    expect(strokePath).not.toBeNull();
    expect(strokePath?.getAttribute('stroke')).toBe('#000');
  });

  it('renders a stepped line path with no fill in CCDF view', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="ccdf" />
      </Plain>,
    );
    expect(container.querySelectorAll('path[fill-opacity]')).toHaveLength(0);
    const strokePath = container.querySelector('path[fill="none"]');
    expect(strokePath).not.toBeNull();
  });

  it('renders a faded background and a brighter match foreground in target view', () => {
    const target: TargetState = { values: [4], ruling: 'gte' };
    const { container } = render(
      <Plain>
        <Sparkline
          dist={uniformDistribution(6)}
          color="#000"
          view="target"
          target={target}
        />
      </Plain>,
    );
    const opacities = Array.from(
      container.querySelectorAll('path[fill-opacity]'),
    ).map((p) => p.getAttribute('fill-opacity'));
    expect(opacities).toContain('0.16');
    expect(opacities).toContain('0.55');
  });

  it('falls back to a plain PMF area when target view has no values', () => {
    const target: TargetState = { values: [], ruling: 'gte' };
    const { container } = render(
      <Plain>
        <Sparkline
          dist={uniformDistribution(6)}
          color="#000"
          view="target"
          target={target}
        />
      </Plain>,
    );
    expect(container.querySelector('path[fill-opacity="0.55"]')).toBeNull();
    const opacities = Array.from(
      container.querySelectorAll('path[fill-opacity]'),
    ).map((p) => p.getAttribute('fill-opacity'));
    expect(opacities).toEqual(['0.16']);
  });

  it('uses the lowest gte target as the threshold when multiple values are set', () => {
    const target: TargetState = { values: [3, 5], ruling: 'gte' };
    const { container } = render(
      <Plain>
        <Sparkline
          dist={uniformDistribution(6)}
          color="#000"
          view="target"
          target={target}
        />
      </Plain>,
    );
    const fg = container.querySelector('path[fill-opacity="0.55"]');
    expect(countSubPaths(fg?.getAttribute('d'))).toBe(4);
  });

  it('only highlights listed values for an eq ruling with multiple targets', () => {
    const target: TargetState = { values: [2, 5], ruling: 'eq' };
    const { container } = render(
      <Plain>
        <Sparkline
          dist={uniformDistribution(6)}
          color="#000"
          view="target"
          target={target}
        />
      </Plain>,
    );
    const fg = container.querySelector('path[fill-opacity="0.55"]');
    expect(countSubPaths(fg?.getAttribute('d'))).toBe(2);
  });

  it('renders a baseline line at the bottom of the chart', () => {
    const { container } = render(
      <Plain>
        <Sparkline
          dist={uniformDistribution(6)}
          color="#000"
          height={24}
        />
      </Plain>,
    );
    const baseline = container.querySelector('line[y1="23.5"][y2="23.5"]');
    expect(baseline).not.toBeNull();
  });

  it('shows PMF tooltip text "value: percent" for each bar', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="pmf" />
      </Plain>,
    );
    const titles = Array.from(container.querySelectorAll('title')).map(
      (t) => t.textContent,
    );
    expect(titles[0]).toBe('1: 16.7%');
    expect(titles[5]).toBe('6: 16.7%');
  });

  it('shows CDF tooltip text "≤ value: cumulative percent" climbing to 100%', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="cdf" />
      </Plain>,
    );
    const titles = Array.from(container.querySelectorAll('title')).map(
      (t) => t.textContent,
    );
    expect(titles[0]).toBe('≤ 1: 16.7%');
    expect(titles[5]).toBe('≤ 6: 100%');
  });

  it('shows CCDF tooltip text "≥ value: cumulative percent" descending from 100%', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="ccdf" />
      </Plain>,
    );
    const titles = Array.from(container.querySelectorAll('title')).map(
      (t) => t.textContent,
    );
    expect(titles[0]).toBe('≥ 1: 100%');
    expect(titles[5]).toBe('≥ 6: 16.7%');
  });
});

describe('Sparkline pool ladder', () => {
  it('renders one discrete bar per result instead of a step area in pool PMF', () => {
    const { container } = render(
      <Plain>
        <Sparkline
          dist={uniformDistribution(6)}
          color="#000"
          view="pmf"
          mode="pool"
        />
      </Plain>,
    );
    const bars = container.querySelectorAll('rect[fill="#000"]:not([data-spread-band])');
    expect(bars).toHaveLength(6);
    bars.forEach((b) => expect(b.getAttribute('fill-opacity')).toBe('0.55'));
    expect(container.querySelectorAll('path[fill-opacity]')).toHaveLength(0);
    expect(container.querySelector('path[fill="none"]')).toBeNull();
  });

  it('skips the mode tick in pool PMF where sum PMF would draw one', () => {
    const dist = new Map([
      [0, 0.2],
      [1, 0.5],
      [2, 0.3],
    ]);
    const sum = render(
      <Plain>
        <Sparkline dist={dist} color="#000" view="pmf" />
      </Plain>,
    );
    expect(sum.container.querySelector('line[stroke="#000"]')).not.toBeNull();
    const pool = render(
      <Plain>
        <Sparkline dist={dist} color="#000" view="pmf" mode="pool" />
      </Plain>,
    );
    expect(pool.container.querySelector('line[stroke="#000"]')).toBeNull();
  });

  it('renders no bar for a zero-probability count but keeps its hover zone', () => {
    const dist = new Map([
      [0, 0.5],
      [2, 0.5],
    ]);
    const { container } = render(
      <Plain>
        <Sparkline dist={dist} color="#000" view="pmf" mode="pool" />
      </Plain>,
    );
    expect(container.querySelectorAll('rect[fill="#000"]:not([data-spread-band])')).toHaveLength(2);
    expect(
      container.querySelectorAll('rect[fill="transparent"]'),
    ).toHaveLength(3);
  });

  it('brightens matching bars and dims the rest in pool target view', () => {
    const dist = new Map([
      [0, 0.25],
      [1, 0.25],
      [2, 0.25],
      [3, 0.25],
    ]);
    const target: TargetState = { values: [2], ruling: 'gte' };
    const { container } = render(
      <Plain>
        <Sparkline
          dist={dist}
          color="#000"
          view="target"
          target={target}
          mode="pool"
        />
      </Plain>,
    );
    expect(
      container.querySelectorAll('rect[fill="#000"]:not([data-spread-band])[fill-opacity="0.55"]'),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll('rect[fill="#000"]:not([data-spread-band])[fill-opacity="0.16"]'),
    ).toHaveLength(2);
    expect(container.querySelector('path[fill-opacity="0.55"]')).toBeNull();
  });

  it('keeps the cumulative curve rendering for pool rows in CDF view', () => {
    const { container } = render(
      <Plain>
        <Sparkline
          dist={uniformDistribution(6)}
          color="#000"
          view="cdf"
          mode="pool"
        />
      </Plain>,
    );
    expect(container.querySelectorAll('rect[fill="#000"]:not([data-spread-band])')).toHaveLength(0);
    expect(container.querySelector('path[fill="none"]')).not.toBeNull();
  });

  it('passes mode through RowSparkline to render the ladder', () => {
    const target: TargetState = { values: [], ruling: 'gte' };
    const { container } = render(
      <Plain>
        <RowSparkline
          dist={uniformDistribution(6)}
          color="#000"
          exprName="Pool row"
          view="pmf"
          target={target}
          mode="pool"
        />
      </Plain>,
    );
    expect(container.querySelectorAll('rect[fill="#000"]:not([data-spread-band])')).toHaveLength(6);
  });
});

describe('ShapeHeaderLabel', () => {
  function seed(
    chartView: string,
    targetValue: number | null = null,
    mode: 'sum' | 'pool' | 'mixed' = 'sum',
  ) {
    const sumRow = {
      id: 'e1',
      name: 'Test',
      parts: [{ id: 'p1', count: 1, sides: 6 }],
      flatModifier: 0,
      rollMode: 'normal',
    };
    const poolRow = {
      id: 'e2',
      name: 'Pool',
      parts: [{ id: 'p2', count: 2, sides: 6 }],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 4 },
    };
    const rows =
      mode === 'sum'
        ? [sumRow]
        : mode === 'pool'
          ? [poolRow]
          : [sumRow, poolRow];
    const state = {
      version: 2,
      expressions: rows,
      ui: {
        expandedId: null,
        chartView,
        target: {
          values: targetValue === null ? [] : [targetValue],
          ruling: 'gte',
        },
      },
    };
    window.localStorage.setItem(
      'dicetable.v2',
      JSON.stringify({ version: 2, value: state }),
    );
  }

  it('shows PMF when chartView is pmf', () => {
    seed('pmf');
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('PMF')).toBeInTheDocument();
  });

  it('shows CDF when chartView is cdf', () => {
    seed('cdf');
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('CDF')).toBeInTheDocument();
  });

  it('shows CCDF when chartView is ccdf', () => {
    seed('ccdf');
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('CCDF')).toBeInTheDocument();
  });

  it('shows Target when chartView is target and a target value is set', () => {
    seed('target', 10);
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('Target')).toBeInTheDocument();
  });

  it('falls back to PMF when chartView is target but no target value is set', () => {
    seed('target', null);
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('PMF')).toBeInTheDocument();
  });

  it('shows Target when chartView is target and a pool row is present with no target value set', () => {
    seed('target', null, 'pool');
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('Target')).toBeInTheDocument();
  });

  it('stays neutral when a pool row draws the target view but a sum row falls back to PMF', () => {
    seed('target', null, 'mixed');
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('Shape')).toBeInTheDocument();
    expect(screen.queryByText('Target')).not.toBeInTheDocument();
  });

  it('shows Target when a sum row and a pool row share the table and a target value is set', () => {
    seed('target', 10, 'mixed');
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('Target')).toBeInTheDocument();
  });
});

describe('Sparkline bucketing', () => {
  // A 2,000-sided die spans 2,000 results in an 80-unit box: 0.04 of a unit
  // each, which is neither readable nor tappable, and one rect plus one title
  // per result in a column that draws one of these per row.
  const WIDE = uniformDistribution(2000);

  function hitRects(container: HTMLElement): Element[] {
    return [...container.querySelectorAll('rect')].filter(
      (r) => r.querySelector('title') !== null,
    );
  }

  it('stops at forty hit zones however many results a row has', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={WIDE} color="#000" view="pmf" />
      </Plain>,
    );
    expect(hitRects(container)).toHaveLength(40);
  });

  it('keeps one zone per result for a row that fits', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="pmf" />
      </Plain>,
    );
    expect(hitRects(container)).toHaveLength(6);
  });

  it('names the range a bucket covers rather than one result inside it', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={WIDE} color="#000" view="pmf" />
      </Plain>,
    );
    const first = hitRects(container)[0]?.querySelector('title')?.textContent;
    // A single result's chance here is 0.05%; the bucket holds fifty of them,
    // so labelling it with one result's number would understate it fiftyfold.
    expect(first).toMatch(/^1 to 50: /);
  });

  it('keeps a single-result label when a bucket holds one result', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="pmf" />
      </Plain>,
    );
    const first = hitRects(container)[0]?.querySelector('title')?.textContent;
    expect(first).toBe('1: 16.7%');
  });

  it('reads a cumulative bucket at its far edge, never by adding running totals', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={WIDE} color="#000" view="cdf" />
      </Plain>,
    );
    const zones = hitRects(container);
    const last = zones[zones.length - 1]?.querySelector('title')?.textContent;
    expect(last).toBe('≤ 2000: 100%');
  });

  it('draws a bounded curve for a wide row', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={WIDE} color="#000" view="cdf" />
      </Plain>,
    );
    const d = container.querySelector('path')?.getAttribute('d') ?? '';
    // One command per bucket, not one per result: 2,000 would be ~2,000.
    expect((d.match(/[ML]/g) ?? []).length).toBeLessThan(200);
  });
});

describe('Sparkline spread band', () => {
  // 2d6: running totals reach 6/36 at 4 (first past 10%) and 33/36 at 10
  // (first past 90%), so the band covers results 4 to 10. With one bucket per
  // result starting at 2, those are buckets 2 and 8 of 11.
  const TWO_D6 = convolve(uniformDistribution(6), uniformDistribution(6));
  const WIDTH = 80;
  const STEP = WIDTH / 11;

  function bandIn(container: HTMLElement): Element | null {
    return container.querySelector('rect[data-spread-band]');
  }

  function bandBox(container: HTMLElement): { x: number; width: number } {
    const band = bandIn(container);
    if (band === null) throw new Error('no spread band drawn');
    return {
      x: Number(band.getAttribute('x')),
      width: Number(band.getAttribute('width')),
    };
  }

  it('draws a band for 2d6 in PMF view', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={TWO_D6} color="#000" view="pmf" />
      </Plain>,
    );
    expect(bandIn(container)).not.toBeNull();
  });

  it('spans the buckets of 4 through 10 for 2d6 in PMF view', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={TWO_D6} color="#000" view="pmf" />
      </Plain>,
    );
    const { x, width } = bandBox(container);
    // Stepped view: from the left edge of bucket 2 to the right edge of bucket 8.
    expect(x).toBeCloseTo(2 * STEP, 9);
    expect(width).toBeCloseTo(7 * STEP, 9);
  });

  it('draws a band for 2d6 in CDF view', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={TWO_D6} color="#000" view="cdf" />
      </Plain>,
    );
    expect(bandIn(container)).not.toBeNull();
  });

  // The cumulative curve stretches its 11 points edge to edge (10 gaps), so
  // the band follows the curve's x: point 2 sits at 16, point 8 at 64.
  it('spans the curve points of 4 through 10 for 2d6 in CDF view', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={TWO_D6} color="#000" view="cdf" />
      </Plain>,
    );
    const { x, width } = bandBox(container);
    expect(x).toBeCloseTo(16, 9);
    expect(width).toBeCloseTo(48, 9);
  });

  it('draws the same band for 2d6 in CCDF view', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={TWO_D6} color="#000" view="ccdf" />
      </Plain>,
    );
    const { x, width } = bandBox(container);
    expect(x).toBeCloseTo(16, 9);
    expect(width).toBeCloseTo(48, 9);
  });

  // The target view already shades what it is about; a second shaded region
  // there would read as a second target.
  it('draws no band in target view', () => {
    const target: TargetState = { values: [7], ruling: 'gte' };
    const { container } = render(
      <Plain>
        <Sparkline dist={TWO_D6} color="#000" view="target" target={target} />
      </Plain>,
    );
    expect(bandIn(container)).toBeNull();
  });

  it('draws the band when the target view has no values and falls back to PMF', () => {
    const target: TargetState = { values: [], ruling: 'gte' };
    const { container } = render(
      <Plain>
        <Sparkline dist={TWO_D6} color="#000" view="target" target={target} />
      </Plain>,
    );
    expect(bandIn(container)).not.toBeNull();
  });

  // 1d8: the first result past 10% is 1 (12.5%) and the first past 90% is 8,
  // so a band would cover every result and say nothing.
  it('draws no band for a flat 1d8', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(8)} color="#000" view="pmf" />
      </Plain>,
    );
    expect(bandIn(container)).toBeNull();
  });

  it('draws no band for a flat 1d8 in CDF view either', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(8)} color="#000" view="cdf" />
      </Plain>,
    );
    expect(bandIn(container)).toBeNull();
  });

  // 1d20: running totals reach 10% exactly at 2 and 90% exactly at 18, so the
  // band is 2 to 18, buckets 1 to 17 of 20 at 4 units each.
  // Every face of a d20 is as likely as the next, so there is no middle where
  // most results land; a band would only shade all but the two end faces.
  it('draws no band for a flat 1d20', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(20)} color="#000" view="pmf" />
      </Plain>,
    );
    expect(bandIn(container)).toBeNull();
  });

  it('draws no band for a single fixed result', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={new Map([[5, 1]])} color="#000" view="pmf" />
      </Plain>,
    );
    expect(container.querySelector('svg')).not.toBeNull();
    expect(bandIn(container)).toBeNull();
  });

  // Four coin-flip dice: 1, 4, 6, 4, 1 out of 16 successes at 0 to 4. The
  // first count past 10% is 1 (5/16) and the first past 90% is 3 (15/16).
  it('places a pool row band on its successes scale', () => {
    const pool = new Map([
      [0, 1 / 16],
      [1, 4 / 16],
      [2, 6 / 16],
      [3, 4 / 16],
      [4, 1 / 16],
    ]);
    const { container } = render(
      <Plain>
        <Sparkline dist={pool} color="#000" view="pmf" mode="pool" />
      </Plain>,
    );
    const { x, width } = bandBox(container);
    expect(x).toBeCloseTo(16, 9);
    expect(width).toBeCloseTo(48, 9);
  });

  // A check that misses half the time: the miss alone passes 10%, so the band
  // starts at 0, and it ends at 4 where the running total first reaches 90%.
  it('starts a check row band at 0 when it misses often', () => {
    const check = new Map([
      [0, 0.5],
      [1, 0.1],
      [2, 0.1],
      [3, 0.1],
      [4, 0.1],
      [5, 0.1],
    ]);
    const { container } = render(
      <Plain>
        <Sparkline dist={check} color="#000" view="pmf" mode="check" />
      </Plain>,
    );
    const { x, width } = bandBox(container);
    expect(x).toBe(0);
    expect(width).toBeCloseTo(5 * (WIDTH / 6), 9);
    // The cut-off miss bar still draws alongside the band.
    expect(
      container.querySelector('line[stroke-dasharray="1.5 1.5"]'),
    ).not.toBeNull();
  });

  // 1d2000 sits in 40 buckets of 50. The band runs 200 to 1800, which falls in
  // buckets 3 and 35, so it spans 3 × 2 to 36 × 2 units.
  it('snaps the band to bucket edges on a wide row', () => {
    const { container } = render(
      <Plain>
        <Sparkline
          dist={convolve(uniformDistribution(1000), uniformDistribution(1000))}
          color="#000"
          view="pmf"
        />
      </Plain>,
    );
    // 2d1000 has 1,999 results in 40 buckets, two units each, so both edges
    // of the band land on a bucket boundary rather than between them.
    const { x, width } = bandBox(container);
    expect(x % 2).toBeCloseTo(0, 9);
    expect(width % 2).toBeCloseTo(0, 9);
    expect(x).toBeGreaterThan(0);
    expect(x + width).toBeLessThan(80);
  });

  it('fills the band with the row colour at low strength, full plot height', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={TWO_D6} color="#123456" view="pmf" height={24} />
      </Plain>,
    );
    const band = bandIn(container);
    expect(band).toHaveAttribute('fill', '#123456');
    expect(band).toHaveAttribute('fill-opacity', '0.1');
    expect(band).toHaveAttribute('y', '0');
    expect(band).toHaveAttribute('height', '23.5');
  });

  // SVG paints in document order, so the band must come before the curve to
  // sit under it rather than wash over the line.
  it('paints the band beneath the curve and its fill', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={TWO_D6} color="#000" view="pmf" />
      </Plain>,
    );
    const band = bandIn(container);
    const area = container.querySelector('path[fill-opacity="0.16"]');
    const stroke = container.querySelector('path[stroke="#000"]');
    if (band === null || area === null || stroke === null) {
      throw new Error('expected band, area and stroke to render');
    }
    expect(
      band.compareDocumentPosition(area) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      band.compareDocumentPosition(stroke) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('paints the band beneath a cumulative curve', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={TWO_D6} color="#000" view="cdf" />
      </Plain>,
    );
    const band = bandIn(container);
    const curve = container.querySelector('path[fill="none"]');
    if (band === null || curve === null) {
      throw new Error('expected band and curve to render');
    }
    expect(
      band.compareDocumentPosition(curve) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('leaves the hover zones untouched', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={TWO_D6} color="#000" view="pmf" />
      </Plain>,
    );
    expect(
      container.querySelectorAll('rect[fill="transparent"]'),
    ).toHaveLength(11);
  });
});
