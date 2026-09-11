import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { OverlayChart } from './OverlayChart';
import { rowColor } from './palette';
import type {
  ChartView,
  Distribution,
  Expression,
  ExpressionMode,
  TargetState,
} from '../../types';

interface ImplProps {
  expressions: Expression[];
  dists: Map<string, Distribution>;
  colors: Map<string, string>;
  effectiveView: ChartView;
  target: TargetState;
  unit?: 'totals' | 'successes';
}

// The impl is pure recharts; the panel split is entirely about what
// OverlayChart hands each instance, so the mock records exactly that.
vi.mock('./OverlayChartImpl', () => ({
  default: (props: ImplProps) => (
    <div
      data-testid="chart-impl"
      data-unit={props.unit ?? 'totals'}
      data-view={props.effectiveView}
      data-ids={props.expressions.map((e) => e.id).join(',')}
      data-colors={props.expressions
        .map((e) => props.colors.get(e.id) ?? 'missing')
        .join(',')}
      data-target={JSON.stringify(props.target)}
    />
  ),
}));

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

afterEach(() => {
  window.localStorage.clear();
});

interface SeedRow {
  id: string;
  name: string;
  mode: ExpressionMode;
}

interface SeedOptions {
  targetValues?: number[];
  poolTarget?: number;
  chartView?: ChartView;
}

function seed(rows: SeedRow[], opts: SeedOptions = {}) {
  const expressions = rows.map((row) => ({
    id: row.id,
    name: row.name,
    parts: [{ id: `p-${row.id}`, count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal' as const,
    mode: row.mode,
    ...(row.mode === 'pool'
      ? { successThreshold: { direction: 'gte' as const, value: 5 } }
      : {}),
    ...(row.mode === 'check'
      ? {
          check: {
            threshold: { direction: 'gte' as const, value: 5 },
            effect: {
              parts: [{ id: `e-${row.id}`, count: 1, sides: 6 }],
              flatModifier: 0,
            },
            onSuccess: 'full' as const,
            onFailure: 'none' as const,
          },
        }
      : {}),
  }));
  const state = {
    version: 3,
    expressions,
    ui: {
      expandedId: null,
      chartView: opts.chartView ?? 'pmf',
      target: { values: opts.targetValues ?? [], ruling: 'gte' as const },
      view: 'table',
      poolTarget: opts.poolTarget ?? 1,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

async function findImpls(): Promise<Map<string, HTMLElement>> {
  const impls = await screen.findAllByTestId('chart-impl');
  return new Map(impls.map((el) => [el.getAttribute('data-unit') ?? '', el]));
}

describe('OverlayChart panel split', () => {
  it('renders a titled Totals and Successes panel for a mixed table, each with its own rows', async () => {
    seed([
      { id: 'e1', name: 'Sword', mode: 'sum' },
      { id: 'e2', name: 'Pool A', mode: 'pool' },
    ]);
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    expect(screen.getByText('Totals')).toBeInTheDocument();
    expect(screen.getByText('Successes')).toBeInTheDocument();

    const byUnit = await findImpls();
    expect(byUnit.size).toBe(2);
    expect(byUnit.get('totals')?.getAttribute('data-ids')).toBe('e1');
    expect(byUnit.get('successes')?.getAttribute('data-ids')).toBe('e2');
  });

  it('renders one labeled Totals panel for an all-sum table', async () => {
    seed([
      { id: 'e1', name: 'Sword', mode: 'sum' },
      { id: 'e2', name: 'Axe', mode: 'sum' },
    ]);
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    const byUnit = await findImpls();
    expect(byUnit.size).toBe(1);
    expect(byUnit.get('totals')?.getAttribute('data-ids')).toBe('e1,e2');
    expect(screen.getByText('Totals')).toBeInTheDocument();
    expect(screen.queryByText('Successes')).toBeNull();
  });

  it('renders one labeled Successes panel for an all-pool table', async () => {
    seed([
      { id: 'e1', name: 'Pool A', mode: 'pool' },
      { id: 'e2', name: 'Pool B', mode: 'pool' },
    ]);
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    const byUnit = await findImpls();
    expect(byUnit.size).toBe(1);
    expect(byUnit.get('successes')?.getAttribute('data-ids')).toBe('e1,e2');
    expect(screen.getByText('Successes')).toBeInTheDocument();
    expect(screen.queryByText('Totals')).toBeNull();
  });

  it('keys series colors by global row position, not panel-local position', async () => {
    seed([
      { id: 'e1', name: 'Sword', mode: 'sum' },
      { id: 'e2', name: 'Pool A', mode: 'pool' },
      { id: 'e3', name: 'Axe', mode: 'sum' },
    ]);
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    const byUnit = await findImpls();
    expect(byUnit.get('totals')?.getAttribute('data-colors')).toBe(
      `${rowColor(0)},${rowColor(2)}`,
    );
    expect(byUnit.get('successes')?.getAttribute('data-colors')).toBe(
      rowColor(1),
    );
  });

  it('gives the Successes panel the shared pool target and the Totals panel the numeric targets', async () => {
    seed(
      [
        { id: 'e1', name: 'Sword', mode: 'sum' },
        { id: 'e2', name: 'Pool A', mode: 'pool' },
      ],
      { targetValues: [10, 15], poolTarget: 4 },
    );
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    const byUnit = await findImpls();
    expect(
      JSON.parse(byUnit.get('totals')?.getAttribute('data-target') ?? '{}'),
    ).toEqual({ values: [10, 15], ruling: 'gte' });
    expect(
      JSON.parse(byUnit.get('successes')?.getAttribute('data-target') ?? '{}'),
    ).toEqual({ values: [4], ruling: 'gte' });
  });

  it('keeps the row limit as one global gate across both modes', async () => {
    seed([
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `s${i}`,
        name: `Row ${i}`,
        mode: 'sum' as const,
      })),
      { id: 'pool1', name: 'Pool A', mode: 'pool' as const },
    ]);
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    expect(
      screen.getByText(/comparison chart is disabled past 20 rolls/i),
    ).toBeInTheDocument();
    expect(screen.queryAllByTestId('chart-impl')).toHaveLength(0);
    expect(screen.queryByText('Successes')).toBeNull();
  });

  it('keeps the Successes panel in target mode for a pool-only table with no numeric targets', async () => {
    seed(
      [
        { id: 'e1', name: 'Pool A', mode: 'pool' },
        { id: 'e2', name: 'Pool B', mode: 'pool' },
      ],
      { chartView: 'target', poolTarget: 2 },
    );
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    const byUnit = await findImpls();
    expect(byUnit.get('successes')?.getAttribute('data-view')).toBe('target');
    expect(
      JSON.parse(byUnit.get('successes')?.getAttribute('data-target') ?? '{}'),
    ).toEqual({ values: [2], ruling: 'gte' });
  });

  it('falls back to PMF on Totals but keeps Successes in target mode when a mixed table has no numeric targets', async () => {
    seed(
      [
        { id: 'e1', name: 'Sword', mode: 'sum' },
        { id: 'e2', name: 'Pool A', mode: 'pool' },
      ],
      { chartView: 'target' },
    );
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    expect(screen.getByText('Totals')).toBeInTheDocument();
    expect(screen.getByText('Successes')).toBeInTheDocument();

    const byUnit = await findImpls();
    expect(byUnit.size).toBe(2);
    expect(byUnit.get('totals')?.getAttribute('data-view')).toBe('pmf');
    expect(byUnit.get('successes')?.getAttribute('data-view')).toBe('target');
  });

  it('leaves a check row on the Totals panel, which still needs a numeric target to reach the target view', async () => {
    seed(
      [
        { id: 'e1', name: 'Save', mode: 'check' },
        { id: 'e2', name: 'Pool A', mode: 'pool' },
      ],
      { chartView: 'target', poolTarget: 2 },
    );
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    const byUnit = await findImpls();
    expect(byUnit.get('totals')?.getAttribute('data-ids')).toBe('e1');
    expect(byUnit.get('totals')?.getAttribute('data-view')).toBe('pmf');
    expect(byUnit.get('successes')?.getAttribute('data-ids')).toBe('e2');
    expect(byUnit.get('successes')?.getAttribute('data-view')).toBe('target');
  });

  it('keeps an all-sum table off the target view when no numeric target is set', async () => {
    seed(
      [
        { id: 'e1', name: 'Sword', mode: 'sum' },
        { id: 'e2', name: 'Axe', mode: 'sum' },
      ],
      { chartView: 'target' },
    );
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    const byUnit = await findImpls();
    expect(byUnit.size).toBe(1);
    expect(byUnit.get('totals')?.getAttribute('data-view')).toBe('pmf');
  });
});

describe('chart view control in the card header', () => {
  function renderChart() {
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );
  }

  it('renders PMF, CDF and CCDF and hides TARGET when no target is set', async () => {
    seed([{ id: 'e1', name: 'Sword', mode: 'sum' }]);
    renderChart();
    await findImpls();
    expect(screen.getByRole('button', { name: 'PMF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CCDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'TARGET' })).toBeNull();
  });

  it('shows TARGET when a target value is set', async () => {
    seed([{ id: 'e1', name: 'Sword', mode: 'sum' }], { targetValues: [7] });
    renderChart();
    await findImpls();
    expect(screen.getByRole('button', { name: 'TARGET' })).toBeInTheDocument();
  });

  it('marks PMF as pressed by default', async () => {
    seed([{ id: 'e1', name: 'Sword', mode: 'sum' }]);
    renderChart();
    await findImpls();
    expect(screen.getByRole('button', { name: 'PMF' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'CDF' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('flips aria-pressed onto the clicked view button', async () => {
    seed([{ id: 'e1', name: 'Sword', mode: 'sum' }]);
    renderChart();
    await findImpls();
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

  it('offers TARGET on a pool card even with no numeric target', async () => {
    seed([{ id: 'e1', name: 'Pool', mode: 'pool' }]);
    renderChart();
    await findImpls();
    expect(screen.getByRole('button', { name: 'TARGET' })).toBeInTheDocument();
  });

  it('keeps TARGET pressed on a pool-only table with no numeric target', async () => {
    seed([{ id: 'e1', name: 'Pool', mode: 'pool' }]);
    renderChart();
    await findImpls();
    fireEvent.click(screen.getByRole('button', { name: 'TARGET' }));
    expect(screen.getByRole('button', { name: 'TARGET' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows TARGET active when a pool-only table is restored in target view', async () => {
    seed([{ id: 'e1', name: 'Pool', mode: 'pool' }], { chartView: 'target' });
    renderChart();
    await findImpls();
    expect(screen.getByRole('button', { name: 'TARGET' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('gives a mixed table its own control per card, TARGET only on the pool one', async () => {
    seed([
      { id: 'e1', name: 'Sword', mode: 'sum' },
      { id: 'e2', name: 'Pool', mode: 'pool' },
    ]);
    renderChart();
    await findImpls();
    expect(screen.getAllByRole('button', { name: 'PMF' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'TARGET' })).toHaveLength(1);
  });
});
