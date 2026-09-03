import * as React from 'react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../state/AppContext';
import { ViewBar } from './ViewBar';
import type { ChartView, ExpressionMode } from '../types';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

function Harness() {
  const chartRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <ViewBar chartRef={chartRef} />
      <div ref={chartRef} data-testid="chart" />
    </>
  );
}

interface SeedOptions {
  mode?: ExpressionMode;
  poolTarget?: number;
  chartView?: ChartView;
}

function seedTarget(values: number[], opts: SeedOptions = {}) {
  const pool = opts.mode === 'pool';
  const state = {
    version: 2,
    expressions: [
      {
        id: 'seed',
        name: 'Seed',
        parts: [{ id: 'p1', count: 1, sides: 6 }],
        flatModifier: 0,
        rollMode: 'normal',
        ...(pool
          ? {
              mode: 'pool' as const,
              successThreshold: { direction: 'gte' as const, value: 4 },
            }
          : {}),
      },
    ],
    ui: {
      expandedId: null,
      chartView: opts.chartView ?? 'pmf',
      target: { values, ruling: 'gte' as const },
      poolTarget: opts.poolTarget ?? 1,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('ViewBar', () => {
  it('renders PMF, CDF, and CCDF buttons by default and hides TARGET when no target is set', () => {
    render(
      <Providers>
        <Harness />
      </Providers>,
    );
    expect(screen.getByRole('button', { name: 'PMF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CCDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'TARGET' })).toBeNull();
  });

  it('shows the TARGET button when a target value is set', () => {
    seedTarget([10]);
    render(
      <Providers>
        <Harness />
      </Providers>,
    );
    expect(screen.getByRole('button', { name: 'TARGET' })).toBeInTheDocument();
  });

  it('marks PMF as pressed by default', () => {
    render(
      <Providers>
        <Harness />
      </Providers>,
    );
    expect(screen.getByRole('button', { name: 'PMF' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'CDF' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('flips aria-pressed onto the clicked view button', () => {
    render(
      <Providers>
        <Harness />
      </Providers>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'CDF' }));
    expect(screen.getByRole('button', { name: 'CDF' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'PMF' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('exposes separate scroll-to-top and jump-to-chart buttons', () => {
    render(
      <Providers>
        <Harness />
      </Providers>,
    );
    expect(
      screen.getByRole('button', { name: 'Scroll to top' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Jump to chart' }),
    ).toBeInTheDocument();
  });

  it('offers the TARGET button for a pool row even when no numeric target is set', () => {
    seedTarget([], { mode: 'pool' });
    render(
      <Providers>
        <Harness />
      </Providers>,
    );
    expect(screen.getByRole('button', { name: 'TARGET' })).toBeInTheDocument();
  });

  it('hides the TARGET button when the table holds only sum rows and no numeric target', () => {
    seedTarget([]);
    render(
      <Providers>
        <Harness />
      </Providers>,
    );
    expect(screen.queryByRole('button', { name: 'TARGET' })).toBeNull();
  });

  it('keeps TARGET pressed after clicking it on a pool-only table with no numeric target', () => {
    seedTarget([], { mode: 'pool' });
    render(
      <Providers>
        <Harness />
      </Providers>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'TARGET' }));
    expect(screen.getByRole('button', { name: 'TARGET' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'PMF' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows TARGET as the active view when a pool-only table is restored in target view', () => {
    seedTarget([], { mode: 'pool', chartView: 'target' });
    render(
      <Providers>
        <Harness />
      </Providers>,
    );
    expect(screen.getByRole('button', { name: 'TARGET' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'PMF' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
