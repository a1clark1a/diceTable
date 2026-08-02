import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { convolve, shift, uniformDistribution } from '../../engine/distribution';
import { hitProbability, max, min } from '../../engine/stats';
import type { TargetRuling, TargetState } from '../../types';
import { TargetCurves } from './TargetCurves';
import { hitSeries, type TargetRow } from './targetHitRows';

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
