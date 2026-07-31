import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { OverlayChart } from './OverlayChart';
import { rowColor } from './palette';
import type {
  Distribution,
  Expression,
  ExpressionMode,
  TargetState,
} from '../../types';

interface ImplProps {
  expressions: Expression[];
  dists: Map<string, Distribution>;
  colors: Map<string, string>;
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
  }));
  const state = {
    version: 3,
    expressions,
    ui: {
      expandedId: null,
      chartView: 'pmf',
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

  it('renders one unlabeled panel for an all-sum table', async () => {
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
    expect(screen.queryByText('Totals')).toBeNull();
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
});
