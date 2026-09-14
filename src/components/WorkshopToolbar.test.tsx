import * as React from 'react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../state/AppContext';
import { useApp } from '../state/useApp';
import { WorkshopToolbar } from './WorkshopToolbar';
import type { ChartView, ExpressionMode, RollMode } from '../types';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

function RowCount() {
  const { expressions } = useApp();
  return <div data-testid="row-count">{expressions.length}</div>;
}

// The table view is the only one that owns a chart, so the harness mirrors
// that split: with a ref for the chart-view chips, without one for the rest.
function Harness({ withChart = true }: { withChart?: boolean }) {
  const chartRef = useRef<HTMLDivElement>(null);
  return (
    <>
      {withChart ? <WorkshopToolbar chartRef={chartRef} /> : <WorkshopToolbar />}
      <div ref={chartRef} data-testid="chart" />
      <RowCount />
    </>
  );
}

function renderToolbar(opts: { withChart?: boolean } = {}) {
  render(
    <Providers>
      <Harness withChart={opts.withChart ?? true} />
    </Providers>,
  );
}

interface SeedRow {
  rollMode: RollMode;
  mode: ExpressionMode;
}

// Pool rows must carry a valid successThreshold and parts without keep/explode,
// or validatePersistedState rejects the whole payload and hydration silently
// falls back to the single-row initial seed table.
function seedTable(
  rows: SeedRow[],
  ui: { chartView?: ChartView; target?: number[]; poolTarget?: number } = {},
) {
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
      chartView: ui.chartView ?? 'pmf',
      target: { values: ui.target ?? [], ruling: 'gte' as const },
      poolTarget: ui.poolTarget ?? 1,
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

// jsdom has no matchMedia, so useIsDesktop defaults to the desktop branch.
// Emulate a viewport to exercise the collapsed mobile toolbar.
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

// jsdom gives portalled menu content no layout, so zag never highlights an
// item and its own keyboard/pointer selection path stays inert. A plain click
// is what both a tap and a keyboard Enter ultimately dispatch on the item.
function selectMenuItem(item: HTMLElement) {
  fireEvent.click(item);
}

afterEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('WorkshopToolbar scroll buttons', () => {
  it('swaps the chart jump for scroll-to-bottom on a view with no chart', () => {
    renderToolbar({ withChart: false });
    expect(screen.queryByRole('button', { name: 'Jump to chart' })).toBeNull();
    // The pair used to be half a pair here, which read as a missing button
    // rather than as a deliberate absence.
    expect(
      screen.getByRole('button', { name: 'Scroll to top' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Scroll to bottom' }),
    ).toBeInTheDocument();
  });

  it('keeps both buttons while the scroller is unmeasured', () => {
    // jsdom reports every height as 0 and stubs ResizeObserver, so a component
    // that read that as "nothing to scroll" would vanish from every test that
    // asserts it, and from any real layout that measures a frame late.
    renderToolbar({ withChart: false });
    expect(
      screen.getByRole('button', { name: 'Scroll to top' }),
    ).toBeInTheDocument();
  });

  it('sits out entirely when the scroller is measured with nowhere to go', () => {
    const main = document.createElement('main');
    document.body.appendChild(main);
    // Head-to-head caps at twelve rolls and fits a desktop window whole.
    Object.defineProperty(main, 'clientHeight', { value: 733, configurable: true });
    Object.defineProperty(main, 'scrollHeight', { value: 733, configurable: true });

    renderToolbar({ withChart: false });

    expect(screen.queryByRole('button', { name: 'Scroll to top' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll to bottom' })).toBeNull();
    main.remove();
  });

  it('exposes separate scroll-to-top and jump-to-chart buttons', () => {
    renderToolbar();
    expect(
      screen.getByRole('button', { name: 'Scroll to top' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Jump to chart' }),
    ).toBeInTheDocument();
  });
});

describe('WorkshopToolbar below the desktop breakpoint', () => {
  it('collapses roll mode and the row actions into one overflow menu', () => {
    mockViewport(false);
    seedRows(['normal', 'normal']);
    renderToolbar();

    // Both scroll buttons stay on the bar itself, and so does the chart view
    // control: on a phone the chart cards sit far below the rolls, so the only
    // place it stays reachable is the sticky bar.
    expect(
      screen.getByRole('button', { name: 'PMF' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Scroll to top' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Jump to chart' }),
    ).toBeInTheDocument();

    // Everything else is behind the overflow, not on the bar.
    for (const name of ['Normal', 'Advantage', 'Disadvantage']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.queryByRole('button', { name: /add roll/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Table actions' }),
    ).toBeInTheDocument();
  });

  it('offers roll mode with full words and the row actions inside the menu', async () => {
    mockViewport(false);
    seedRows(['advantage', 'advantage']);
    renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'Table actions' }));

    const advantage = await screen.findByRole('menuitemradio', {
      name: 'Advantage',
    });
    expect(advantage).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('menuitemradio', { name: 'Normal' }),
    ).toHaveAttribute('aria-checked', 'false');
    expect(
      screen.getByRole('menuitemradio', { name: 'Disadvantage' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /add roll/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /example rolls/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /clear all rolls/i }),
    ).toBeInTheDocument();
  });

  it('adds a roll from the overflow menu', async () => {
    mockViewport(false);
    seedRows(['normal']);
    renderToolbar();
    expect(screen.getByTestId('row-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByRole('button', { name: 'Table actions' }));
    selectMenuItem(await screen.findByRole('menuitem', { name: /add roll/i }));

    await waitFor(() =>
      expect(screen.getByTestId('row-count')).toHaveTextContent('2'),
    );
  });

  it('rewrites every row from the menu roll-mode group', async () => {
    mockViewport(false);
    seedRows(['normal', 'normal']);
    renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'Table actions' }));
    selectMenuItem(
      await screen.findByRole('menuitemradio', { name: 'Disadvantage' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Table actions' }));
    const reopened = await screen.findByRole('menuitemradio', {
      name: 'Disadvantage',
    });
    await waitFor(() =>
      expect(reopened).toHaveAttribute('aria-checked', 'true'),
    );
  });

  it('opens the clear confirmation from the overflow menu', async () => {
    mockViewport(false);
    seedRows(['normal', 'normal']);
    renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'Table actions' }));
    selectMenuItem(
      await screen.findByRole('menuitem', { name: /clear all rolls/i }),
    );

    await screen.findByRole('alertdialog');
    expect(
      screen.getByRole('button', { name: 'Clear 2 rolls' }),
    ).toBeInTheDocument();
  });

  it('hides the roll-mode group and destructive items on an empty table', async () => {
    mockViewport(false);
    seedRows([]);
    renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: 'Table actions' }));
    await screen.findByRole('menuitem', { name: /add roll/i });

    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(
      screen.queryByRole('menuitem', { name: /clear all rolls/i }),
    ).toBeNull();
  });
});
