import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { InspectChart, InspectChartBody } from './InspectChart';
import { uniformDistribution } from '../../engine/distribution';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

afterEach(() => {
  window.localStorage.clear();
});

function seed(chartView: string = 'pmf', targetValue: number | null = null) {
  const state = {
    version: 2,
    expressions: [
      {
        id: 'e1',
        name: 'Seed',
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

describe('InspectChart trigger', () => {
  it('renders a trigger button with an accessible name including the row name', () => {
    seed();
    render(
      <AllProviders>
        <InspectChart
          exprName="Greatsword"
          dist={uniformDistribution(6)}
          color="#000"
        >
          <span>sparkline-trigger</span>
        </InspectChart>
      </AllProviders>,
    );
    expect(
      screen.getByRole('button', { name: /inspect chart for greatsword/i }),
    ).toBeInTheDocument();
  });

  it('does not mount the dialog content before the trigger is activated', () => {
    seed();
    render(
      <AllProviders>
        <InspectChart
          exprName="Greatsword"
          dist={uniformDistribution(6)}
          color="#000"
        >
          <span>sparkline-trigger</span>
        </InspectChart>
      </AllProviders>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('InspectChartBody view label', () => {
  it('shows PMF when chartView is pmf', () => {
    seed('pmf');
    render(
      <AllProviders>
        <InspectChartBody dist={uniformDistribution(6)} color="#000" />
      </AllProviders>,
    );
    expect(screen.getByText('PMF')).toBeInTheDocument();
  });

  it('shows CDF when chartView is cdf', () => {
    seed('cdf');
    render(
      <AllProviders>
        <InspectChartBody dist={uniformDistribution(6)} color="#000" />
      </AllProviders>,
    );
    expect(screen.getByText('CDF')).toBeInTheDocument();
  });

  it('shows Target when chartView is target and a target value is set', () => {
    seed('target', 4);
    render(
      <AllProviders>
        <InspectChartBody dist={uniformDistribution(6)} color="#000" />
      </AllProviders>,
    );
    expect(screen.getByText('Target')).toBeInTheDocument();
  });

  it('falls back to PMF when chartView is target but no target value is set', () => {
    seed('target', null);
    render(
      <AllProviders>
        <InspectChartBody dist={uniformDistribution(6)} color="#000" />
      </AllProviders>,
    );
    expect(screen.getByText('PMF')).toBeInTheDocument();
  });
});

describe('InspectChartBody top results', () => {
  it('shows the "Most likely results" heading', () => {
    seed('pmf');
    render(
      <AllProviders>
        <InspectChartBody dist={uniformDistribution(6)} color="#000" />
      </AllProviders>,
    );
    expect(screen.getByText(/most likely results/i)).toBeInTheDocument();
  });

  it('lists every result when the distribution has fewer than 10 values', () => {
    seed('pmf');
    render(
      <AllProviders>
        <InspectChartBody dist={uniformDistribution(6)} color="#000" />
      </AllProviders>,
    );
    // Each entry renders a "16.7%" percent (1/6 ≈ 0.1667). Axis ticks use
    // formatPctTick which rounds to integer ("17%"), so these strings are
    // unique to the top-results list.
    expect(screen.getAllByText('16.7%')).toHaveLength(6);
  });

  it('caps the list at 10 entries for distributions with more than 10 values', () => {
    seed('pmf');
    render(
      <AllProviders>
        <InspectChartBody dist={uniformDistribution(20)} color="#000" />
      </AllProviders>,
    );
    // 1d20 → all values at 5% (formatted "5.0%"). Top 10 shown.
    expect(screen.getAllByText('5.0%')).toHaveLength(10);
  });

  it('orders entries by probability descending and breaks ties by value ascending', () => {
    // Hand-built distribution where two pairs are tied:
    //   1: 0.5 (highest)
    //   2: 0.2
    //   3: 0.2 (tied with 2 → after it because value > 2)
    //   4: 0.1
    seed('pmf');
    const dist = new Map<number, number>([
      [1, 0.5],
      [2, 0.2],
      [3, 0.2],
      [4, 0.1],
    ]);
    const { container } = render(
      <AllProviders>
        <InspectChartBody dist={dist} color="#000" />
      </AllProviders>,
    );
    // Find the "Most likely results" panel and read the value column in order.
    // Each row is an HStack with two children; the first child is the dice value.
    const heading = screen.getByText(/most likely results/i);
    const panel = heading.parentElement;
    if (panel === null) throw new Error('panel not found');
    const valueTexts = Array.from(panel.querySelectorAll('p'))
      .map((el) => el.textContent ?? '')
      .filter((text) => /^\d+$/.test(text));
    expect(valueTexts).toEqual(['1', '2', '3', '4']);
    // sanity: container has the rendered tree
    expect(container).toBeTruthy();
  });
});
