import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { convolve, shift, uniformDistribution } from '../../engine/distribution';
import { hitProbability, hitSeries, max, min } from '../../engine/stats';
import type { TargetRuling, TargetState } from '../../types';
import { CURVE_PAGE, TargetCurves } from './TargetCurves';
import type { TargetRow } from './targetHitRows';

const RULINGS: readonly TargetRuling[] = ['gte', 'gt', 'lte', 'lt', 'eq'];

describe('hitSeries', () => {
  it('matches hitProbability at every value in range for all five rulings', () => {
    const dist = convolve(uniformDistribution(6), uniformDistribution(6));
    const lo = min(dist);
    const hi = max(dist);
    for (const ruling of RULINGS) {
      const series = hitSeries(dist, lo, hi, ruling);
      expect(series).toHaveLength(hi - lo + 1);
      for (let v = lo; v <= hi; v++) {
        expect(series[v - lo]).toBeCloseTo(hitProbability(dist, v, ruling), 12);
      }
    }
  });

  it('handles a single-value distribution', () => {
    const dist = new Map([[5, 1]]);
    expect(hitSeries(dist, 5, 5, 'gte')).toEqual([1]);
    expect(hitSeries(dist, 5, 5, 'gt')).toEqual([0]);
    expect(hitSeries(dist, 5, 5, 'eq')).toEqual([1]);
  });
});

// Chart geometry constants mirrored from TargetCurves: viewBox 640×210,
// x maps [lo..hi] onto [48, 632], y maps [0..1] onto [202, 8].
const W = 640;
const H = 210;

function pathPoints(d: string): { x: number; y: number }[] {
  return d
    .replace(/^M/, '')
    .split(' L')
    .map((pair) => {
      const [x, y] = pair.split(',');
      return { x: Number(x), y: Number(y) };
    });
}

function renderCurves(rows: TargetRow[], target: TargetState) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <TargetCurves rows={rows} target={target} />
    </ChakraProvider>,
  );
}

// 1d20+5: range 6–25, flat PMF, so hit curves are clean staircases.
function spearRow(): TargetRow {
  const dist = shift(uniformDistribution(20), 5);
  return {
    id: 'r1',
    name: 'Spear',
    slot: 0,
    color: '#2563eb',
    isPool: false,
    dist,
    min: min(dist),
    max: max(dist),
  };
}

describe('TargetCurves rendering', () => {
  it('draws a falling curve under a ≥ ruling that matches hitProbability at each target', () => {
    const row = spearRow();
    const target: TargetState = { values: [10, 15, 20], ruling: 'gte' };
    const { container } = renderCurves([row], target);

    const d = container.querySelector('path')?.getAttribute('d');
    expect(d).toBeTruthy();
    const pts = pathPoints(d!);
    expect(pts).toHaveLength(row.max - row.min + 1);

    // Chance falls as the target rises, so SVG y (down = less likely) never
    // decreases left to right.
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]!.y).toBeGreaterThanOrEqual(pts[i - 1]!.y);
    }

    const lo = row.min;
    const span = row.max - lo;
    for (const tv of target.values) {
      const x = ((tv - lo) / span) * (W - 56) + 48;
      const pt = pts.find((p) => Math.abs(p.x - x) < 0.06);
      expect(pt).toBeDefined();
      const expectedY = H - 8 - hitProbability(row.dist, tv, 'gte') * (H - 16);
      expect(pt!.y).toBeCloseTo(expectedY, 1);
    }
  });

  it('draws a rising curve under a ≤ ruling', () => {
    const row = spearRow();
    const { container } = renderCurves([row], { values: [10], ruling: 'lte' });

    const pts = pathPoints(
      container.querySelector('path')!.getAttribute('d')!,
    );
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]!.y).toBeLessThanOrEqual(pts[i - 1]!.y);
    }
  });

  it('extends the axis and holds the curve flat when a target sits outside the range', () => {
    const row = spearRow();
    const { container } = renderCurves([row], { values: [40], ruling: 'gte' });

    // Axis runs 6 to 40; the curve keeps its per-value points plus the two
    // constant-tail points rather than sampling out to the target. "40"
    // appears twice: the marker chip and the axis max label.
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getAllByText('40')).toHaveLength(2);
    const pts = pathPoints(
      container.querySelector('path')!.getAttribute('d')!,
    );
    expect(pts).toHaveLength(row.max - row.min + 1 + 2);
    const last = pts[pts.length - 1]!;
    expect(last.y).toBeCloseTo(H - 8, 1);
  });
});

// Distinct ranges per row, so a page that drops rows would visibly shrink the
// axis if the axis were built from the drawn rows instead of the whole table.
function manyRows(n: number): TargetRow[] {
  return Array.from({ length: n }, (_, i) => {
    const dist = shift(uniformDistribution(20), i);
    return {
      id: `r${i}`,
      name: `Roll ${i}`,
      slot: i % 8,
      color: '#2563eb',
      isPool: false,
      dist,
      min: min(dist),
      max: max(dist),
    };
  });
}

function curvePaths(container: HTMLElement): NodeListOf<SVGPathElement> {
  return container.querySelectorAll('svg[role="img"] path');
}

describe('TargetCurves paging', () => {
  const target: TargetState = { values: [10], ruling: 'gte' };

  it('draws every roll and offers no pager below the page size', () => {
    const { container } = renderCurves(manyRows(CURVE_PAGE), target);

    expect(curvePaths(container)).toHaveLength(CURVE_PAGE);
    expect(screen.queryByRole('button', { name: /at a time/i })).toBeNull();
    expect(screen.queryByText(/showing 1 to/i)).toBeNull();
  });

  it('still draws every roll above the page size until the option is on', () => {
    const { container } = renderCurves(manyRows(50), target);

    expect(curvePaths(container)).toHaveLength(50);
    const toggle = screen.getByRole('button', { name: /at a time/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/showing 1 to/i)).toBeNull();
  });

  it('cuts to one page and pages through the rest', () => {
    const { container } = renderCurves(manyRows(50), target);

    fireEvent.click(screen.getByRole('button', { name: /at a time/i }));
    expect(curvePaths(container)).toHaveLength(CURVE_PAGE);
    expect(screen.getByText(/showing 1 to 20 of 50 rolls/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /previous rolls on the target curves/i }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: /more rolls on the target curves/i }),
    );
    expect(screen.getByText(/showing 21 to 40 of 50 rolls/i)).toBeInTheDocument();

    // The last page is short, and says so rather than padding itself out.
    fireEvent.click(
      screen.getByRole('button', { name: /more rolls on the target curves/i }),
    );
    expect(screen.getByText(/showing 41 to 50 of 50 rolls/i)).toBeInTheDocument();
    expect(curvePaths(container)).toHaveLength(10);
    expect(
      screen.getByRole('button', { name: /more rolls on the target curves/i }),
    ).toBeDisabled();
  });

  it('keeps the axis on the whole table so pages stay comparable', () => {
    const rows = manyRows(50);
    const { container } = renderCurves(rows, target);
    const whole = curvePaths(container)[0]!.getAttribute('d')!;

    fireEvent.click(screen.getByRole('button', { name: /at a time/i }));
    // Row 0 is on the first page either way, and its geometry is unchanged:
    // an axis rebuilt from the page's rows would have moved it.
    expect(curvePaths(container)[0]!.getAttribute('d')).toBe(whole);

    // The axis labels name the whole table's range on every page.
    fireEvent.click(
      screen.getByRole('button', { name: /more rolls on the target curves/i }),
    );
    expect(screen.getByText(String(rows[0]!.min))).toBeInTheDocument();
    expect(
      screen.getByText(String(rows[rows.length - 1]!.max)),
    ).toBeInTheDocument();
  });

  it('falls back to the last page when rows are deleted out from under it', () => {
    const rows = manyRows(50);
    const { container, rerender } = renderCurves(rows, target);

    fireEvent.click(screen.getByRole('button', { name: /at a time/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /more rolls on the target curves/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /more rolls on the target curves/i }),
    );
    expect(screen.getByText(/showing 41 to 50 of 50 rolls/i)).toBeInTheDocument();

    rerender(
      <ChakraProvider value={defaultSystem}>
        <TargetCurves rows={rows.slice(0, 25)} target={target} />
      </ChakraProvider>,
    );
    expect(screen.getByText(/showing 21 to 25 of 25 rolls/i)).toBeInTheDocument();
    expect(curvePaths(container)).toHaveLength(5);
  });

  it('names every line on a page instead of trimming the legend', () => {
    renderCurves(manyRows(50), target);

    expect(screen.getByText('+38 more')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /at a time/i }));
    expect(screen.queryByText(/more$/)).toBeNull();
    expect(screen.getByText('Roll 19')).toBeInTheDocument();
  });
});
