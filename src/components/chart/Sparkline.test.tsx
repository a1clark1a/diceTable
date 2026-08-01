import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { RowSparkline, Sparkline, ShapeHeaderLabel } from './Sparkline';
import { uniformDistribution } from '../../engine/distribution';
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
    const bars = container.querySelectorAll('rect[fill="#000"]');
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
    expect(container.querySelectorAll('rect[fill="#000"]')).toHaveLength(2);
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
      container.querySelectorAll('rect[fill="#000"][fill-opacity="0.55"]'),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll('rect[fill="#000"][fill-opacity="0.16"]'),
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
    expect(container.querySelectorAll('rect[fill="#000"]')).toHaveLength(0);
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
    expect(container.querySelectorAll('rect[fill="#000"]')).toHaveLength(6);
  });
});

describe('ShapeHeaderLabel', () => {
  function seed(chartView: string, targetValue: number | null = null) {
    const state = {
      version: 2,
      expressions: [
        {
          id: 'e1',
          name: 'Test',
          parts: [{ id: 'p1', count: 1, sides: 6 }],
          flatModifier: 0,
          rollMode: 'normal',
        },
      ],
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
});
