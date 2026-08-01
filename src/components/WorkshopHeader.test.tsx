import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../state/AppContext';
import { useApp } from '../state/useApp';
import { WorkshopHeader } from './WorkshopHeader';
import type { WorkshopViewChip } from './WorkshopViewSwitcher';
import type { ExpressionMode, RollMode } from '../types';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

const VIEWS: WorkshopViewChip[] = [
  { id: 'table', label: 'Table & chart', mobileLabel: 'Rolls' },
];

interface SeedRow {
  rollMode: RollMode;
  mode: ExpressionMode;
}

// Pool rows must carry a valid successThreshold and parts without keep/explode,
// or validatePersistedState rejects the whole payload and hydration silently
// falls back to the single-row initial seed table.
function seedTable(rows: SeedRow[]) {
  const state = {
    version: 2,
    expressions: rows.map((row, i) => ({
      id: `e${i}`,
      name: `Row ${i}`,
      parts: [{ id: `p${i}`, count: 1, sides: 6 }],
      flatModifier: 0,
      rollMode: row.rollMode,
      mode: row.mode,
      ...(row.mode === 'pool'
        ? { successThreshold: { direction: 'gte', value: 4 } }
        : {}),
    })),
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [] as number[], ruling: 'gte' as const },
      view: 'table' as const,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

function seedRows(modes: RollMode[]) {
  seedTable(modes.map((rollMode): SeedRow => ({ rollMode, mode: 'sum' })));
}

function RowCount() {
  const { expressions } = useApp();
  return <div data-testid="row-count">{expressions.length}</div>;
}

function renderHeader(
  props: Partial<React.ComponentProps<typeof WorkshopHeader>> = {},
) {
  const onSelectView = props.onSelectView ?? vi.fn();
  render(
    <Providers>
      <WorkshopHeader
        views={props.views ?? VIEWS}
        activeView={props.activeView ?? 'table'}
        onSelectView={onSelectView}
      />
      <RowCount />
    </Providers>,
  );
  return { onSelectView };
}

// jsdom has no matchMedia, so useIsDesktop defaults to the desktop branch.
// Emulate a viewport to exercise the responsive Add-button label.
function mockViewport(isDesktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isDesktop,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('WorkshopHeader', () => {
  it('renders the view switcher, roll-mode chips, and an Add button', () => {
    seedRows(['normal']);
    renderHeader();
    expect(
      screen.getByRole('button', { name: 'Table & chart' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Normal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advantage' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Disadvantage' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add roll/i }),
    ).toBeInTheDocument();
  });

  it('marks the shared roll mode as the active chip', () => {
    seedRows(['advantage', 'advantage']);
    renderHeader();
    expect(screen.getByRole('button', { name: 'Advantage' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      screen.getByRole('button', { name: 'Disadvantage' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/mixed/i)).toBeNull();
  });

  it('shows no active chip and a mixed label when rows differ', () => {
    seedRows(['normal', 'advantage']);
    renderHeader();
    for (const name of ['Normal', 'Advantage', 'Disadvantage']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
    expect(screen.getByText(/mixed/i)).toBeInTheDocument();
  });

  it('ignores a pool row when deriving the shared roll mode from sum rows', () => {
    seedTable([
      { rollMode: 'normal', mode: 'sum' },
      { rollMode: 'advantage', mode: 'pool' },
    ]);
    renderHeader();
    expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    expect(screen.queryByText(/mixed/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Advantage' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('falls back to the stored modes when every row is a pool row', () => {
    seedTable([
      { rollMode: 'advantage', mode: 'pool' },
      { rollMode: 'advantage', mode: 'pool' },
    ]);
    renderHeader();
    expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    expect(screen.queryByText(/mixed/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Advantage' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it("marks the first row's stored mode when an all-pool table disagrees", () => {
    seedTable([
      { rollMode: 'normal', mode: 'pool' },
      { rollMode: 'advantage', mode: 'pool' },
    ]);
    renderHeader();
    expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    expect(screen.queryByText(/mixed/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('still shows the mixed label when sum rows differ alongside a pool row', () => {
    seedTable([
      { rollMode: 'normal', mode: 'sum' },
      { rollMode: 'advantage', mode: 'sum' },
      { rollMode: 'normal', mode: 'pool' },
    ]);
    renderHeader();
    expect(screen.getByTestId('row-count')).toHaveTextContent('3');
    expect(screen.getByText(/mixed/i)).toBeInTheDocument();
    for (const name of ['Normal', 'Advantage', 'Disadvantage']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  });

  it('rewrites every row and updates the active chip when a mode is clicked', () => {
    seedRows(['normal', 'advantage']);
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Disadvantage' }));
    expect(
      screen.getByRole('button', { name: 'Disadvantage' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/mixed/i)).toBeNull();
  });

  it('keeps a plain "Roll mode" label with no active chip on an empty table', () => {
    seedRows([]);
    renderHeader();
    expect(screen.getByText('Roll mode')).toBeInTheDocument();
    expect(screen.queryByText(/mixed/i)).toBeNull();
    for (const name of ['Normal', 'Advantage', 'Disadvantage']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  });

  it('appends a row when Add is clicked', () => {
    seedRows(['normal', 'normal']);
    renderHeader();
    expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: /add roll/i }));
    expect(screen.getByTestId('row-count')).toHaveTextContent('3');
  });

  it('forwards view selection to onSelectView', () => {
    seedRows(['normal']);
    const views: WorkshopViewChip[] = [
      { id: 'table', label: 'Table & chart', mobileLabel: 'Rolls' },
      { id: 'target', label: 'Target hit' },
    ];
    const { onSelectView } = renderHeader({ views, activeView: 'table' });
    fireEvent.click(screen.getByRole('button', { name: 'Target hit' }));
    expect(onSelectView).toHaveBeenCalledWith('target');
  });

  it('labels the Add button "Add" below the desktop breakpoint', () => {
    mockViewport(false);
    seedRows(['normal']);
    renderHeader();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add roll/i })).toBeNull();
  });
});
