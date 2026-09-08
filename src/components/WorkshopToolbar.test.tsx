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

describe('WorkshopToolbar chart view', () => {
  it('renders PMF, CDF, and CCDF and hides TARGET when no target is set', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: 'PMF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CCDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'TARGET' })).toBeNull();
  });

  it('shows the TARGET button when a target value is set', () => {
    seedTable([{ rollMode: 'normal', mode: 'sum' }], { target: [10] });
    renderToolbar();
    expect(screen.getByRole('button', { name: 'TARGET' })).toBeInTheDocument();
  });

  it('marks PMF as pressed by default', () => {
    renderToolbar();
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
    renderToolbar();
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

  it('offers TARGET for a pool row even when no numeric target is set', () => {
    seedTable([{ rollMode: 'normal', mode: 'pool' }]);
    renderToolbar();
    expect(screen.getByRole('button', { name: 'TARGET' })).toBeInTheDocument();
  });

  it('hides TARGET when the table holds only sum rows and no numeric target', () => {
    seedTable([{ rollMode: 'normal', mode: 'sum' }]);
    renderToolbar();
    expect(screen.queryByRole('button', { name: 'TARGET' })).toBeNull();
  });

  it('keeps TARGET pressed on a pool-only table with no numeric target', () => {
    seedTable([{ rollMode: 'normal', mode: 'pool' }]);
    renderToolbar();
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

  it('shows TARGET active when a pool-only table is restored in target view', () => {
    seedTable([{ rollMode: 'normal', mode: 'pool' }], { chartView: 'target' });
    renderToolbar();
    expect(screen.getByRole('button', { name: 'TARGET' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('drops the chart chips and the chart jump on a view with no chart', () => {
    renderToolbar({ withChart: false });
    expect(screen.queryByRole('button', { name: 'PMF' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Jump to chart' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Scroll to top' }),
    ).toBeInTheDocument();
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

describe('WorkshopToolbar roll mode', () => {
  it('marks the shared roll mode as the active chip', () => {
    seedRows(['advantage', 'advantage']);
    renderToolbar();
    expect(screen.getByRole('button', { name: 'Advantage' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByText(/mixed/i)).toBeNull();
  });

  it('shows no active chip and a mixed label when rows differ', () => {
    seedRows(['normal', 'advantage']);
    renderToolbar();
    for (const name of ['Normal', 'Advantage', 'Disadvantage']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
    expect(screen.getByText(/mixed/i)).toBeInTheDocument();
  });

  it('ignores a pool row when deriving the shared mode from sum rows', () => {
    seedTable([
      { rollMode: 'normal', mode: 'sum' },
      { rollMode: 'advantage', mode: 'pool' },
    ]);
    renderToolbar();
    expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    expect(screen.queryByText(/mixed/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('falls back to the stored modes when every row is a pool row', () => {
    seedTable([
      { rollMode: 'advantage', mode: 'pool' },
      { rollMode: 'advantage', mode: 'pool' },
    ]);
    renderToolbar();
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
    renderToolbar();
    expect(screen.queryByText(/mixed/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('still shows mixed when sum rows differ alongside a pool row', () => {
    seedTable([
      { rollMode: 'normal', mode: 'sum' },
      { rollMode: 'advantage', mode: 'sum' },
      { rollMode: 'normal', mode: 'pool' },
    ]);
    renderToolbar();
    expect(screen.getByText(/mixed/i)).toBeInTheDocument();
  });

  it('rewrites every row and updates the active chip when a mode is clicked', () => {
    seedRows(['normal', 'advantage']);
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: 'Disadvantage' }));
    expect(screen.getByRole('button', { name: 'Disadvantage' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText(/mixed/i)).toBeNull();
  });

  it('hides the roll-mode chips and Clear on an empty table, keeping Add', () => {
    seedRows([]);
    renderToolbar();
    expect(screen.queryByText('Roll mode')).toBeNull();
    for (const name of ['Normal', 'Advantage', 'Disadvantage']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
    expect(
      screen.getByRole('button', { name: /add roll/i }),
    ).toBeInTheDocument();
  });
});

describe('WorkshopToolbar add and clear', () => {
  it('appends a row when Add roll is clicked', () => {
    seedRows(['normal', 'normal']);
    renderToolbar();
    expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: /add roll/i }));
    expect(screen.getByTestId('row-count')).toHaveTextContent('3');
  });

  it('disables Add roll at the 100-roll cap', () => {
    seedRows(Array.from({ length: 100 }, () => 'normal' as const));
    renderToolbar();
    expect(screen.getByTestId('row-count')).toHaveTextContent('100');
    expect(screen.getByRole('button', { name: /add roll/i })).toBeDisabled();
  });

  // The dialog machine opens a beat after the trigger click, so every test
  // waits on the alertdialog role appearing rather than querying synchronously.
  async function openClearDialog() {
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    return await screen.findByRole('alertdialog');
  }

  it('opens a confirmation dialog naming the roll count', async () => {
    seedRows(['normal', 'normal']);
    renderToolbar();
    await openClearDialog();
    expect(screen.getByText('Clear the table?')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear 2 rolls' }),
    ).toBeInTheDocument();
  });

  it('Cancel closes the dialog and keeps every roll', async () => {
    seedRows(['normal', 'normal']);
    renderToolbar();
    await openClearDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('confirming empties the table and hides the Clear button', async () => {
    seedRows(['normal', 'normal', 'normal']);
    renderToolbar();
    await openClearDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Clear 3 rolls' }));
    expect(screen.getByTestId('row-count')).toHaveTextContent('0');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });
});

describe('WorkshopToolbar below the desktop breakpoint', () => {
  it('collapses roll mode and the row actions into one overflow menu', () => {
    mockViewport(false);
    seedRows(['normal', 'normal']);
    renderToolbar();

    // The chart chips and both scroll buttons stay on the bar itself.
    expect(screen.getByRole('button', { name: 'PMF' })).toBeInTheDocument();
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
