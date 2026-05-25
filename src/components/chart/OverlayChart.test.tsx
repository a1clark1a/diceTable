import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { OverlayChart } from './OverlayChart';
import { ChartFallback } from './ChartFallback';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

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

interface SeededExpr {
  id: string;
  name: string;
  parts: { id: string; count: number; sides: number }[];
  flatModifier: number;
  rollMode: 'normal' | 'advantage' | 'disadvantage';
}

function seed(expressions: SeededExpr[], chartView: string = 'pmf') {
  const state = {
    version: 2,
    expressions,
    ui: {
      expandedId: null,
      chartView,
      target: { values: [] as number[], ruling: 'gte' as const },
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

function oneValidExpr(): SeededExpr[] {
  return [
    {
      id: 'e1',
      name: 'Seed',
      parts: [{ id: 'p1', count: 1, sides: 6 }],
      flatModifier: 0,
      rollMode: 'normal',
    },
  ];
}

function manyExprs(count: number): SeededExpr[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    name: `Row ${i}`,
    parts: [{ id: `p${i}`, count: 1, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal' as const,
  }));
}

describe('ChartFallback', () => {
  it('renders an accessible "loading chart" status for the overlay variant', () => {
    render(
      <Plain>
        <ChartFallback variant="overlay" />
      </Plain>,
    );
    expect(
      screen.getByRole('status', { name: /loading chart/i }),
    ).toBeInTheDocument();
  });

  it('renders an accessible "loading chart" status for the inspect variant', () => {
    render(
      <Plain>
        <ChartFallback variant="inspect" />
      </Plain>,
    );
    expect(
      screen.getByRole('status', { name: /loading chart/i }),
    ).toBeInTheDocument();
  });
});

describe('OverlayChart lazy loading', () => {
  it('lazy-loads the chart impl after rendering the fallback when at least one row is valid', async () => {
    seed(oneValidExpr());
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    expect(
      screen.getByRole('status', { name: /loading chart/i }),
    ).toBeInTheDocument();

    await waitForElementToBeRemoved(
      () => screen.queryByRole('status', { name: /loading chart/i }),
      { timeout: 10000 },
    );
  });

  it('shows the over-limit empty state and never mounts the chart impl past 20 rows', async () => {
    seed(manyExprs(21));
    const { container } = render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    expect(
      screen.getByText(/comparison chart is disabled past 20 rolls/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/currently 21/i)).toBeInTheDocument();

    expect(
      screen.queryByRole('status', { name: /loading chart/i }),
    ).toBeNull();
    expect(
      container.querySelector('.recharts-responsive-container'),
    ).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(
      screen.queryByRole('status', { name: /loading chart/i }),
    ).toBeNull();
    expect(
      container.querySelector('.recharts-responsive-container'),
    ).toBeNull();
  });
});
