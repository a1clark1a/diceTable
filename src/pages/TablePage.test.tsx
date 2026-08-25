import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';

// The overlay chart lazy-loads recharts, which needs browser APIs jsdom does
// not provide; the page-level seam under test is which sections render, not
// what the chart draws.
vi.mock('../components/chart/OverlayChart', () => ({
  OverlayChart: () => <div data-testid="overlay-chart" />,
}));

const { AppProvider } = await import('../state/AppContext');
const { RollHistoryProvider } = await import('../state/RollHistoryContext');
const TablePage = (await import('./TablePage')).default;

function renderPage() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <RollHistoryProvider>
          <TablePage />
        </RollHistoryProvider>
      </AppProvider>
    </ChakraProvider>,
  );
}

function seedOneRoll(view: 'table' | 'rolloff') {
  const state = {
    version: 3,
    expressions: [
      {
        id: 'e1',
        name: 'Longsword',
        parts: [{ id: 'p1', count: 1, sides: 8 }],
        flatModifier: 0,
        rollMode: 'normal',
        mode: 'sum',
      },
    ],
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [] as number[], ruling: 'gte' as const },
      view,
      poolTarget: 1,
      baselineId: null,
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

describe('TablePage first-run empty state', () => {
  it('shows the example panel instead of the workshop views on first run', () => {
    renderPage();
    expect(screen.getByText('Start with an example')).toBeInTheDocument();
    // Chrome that needs rows stays hidden; the view switcher and Add stay.
    expect(screen.queryByText('Roll mode')).toBeNull();
    expect(screen.queryByRole('button', { name: 'PMF' })).toBeNull();
    expect(screen.queryByTestId('overlay-chart')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Table & chart' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add roll/i }),
    ).toBeInTheDocument();
  });

  it('replaces every workshop view with the panel while empty', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Roll-off' }));
    expect(screen.getByText('Start with an example')).toBeInTheDocument();
    expect(screen.queryByText(/at least two rolls/i)).toBeNull();
  });

  it('leaves the panel and shows the table once an example is used', () => {
    renderPage();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Use this roll' })[0]!,
    );

    expect(screen.queryByText('Start with an example')).toBeNull();
    expect(screen.getByText('Roll mode')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Name' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('overlay-chart')).toBeInTheDocument();
  });

  it('renders the persisted workshop view, not the panel, when rows exist', () => {
    seedOneRoll('rolloff');
    renderPage();
    expect(screen.queryByText('Start with an example')).toBeNull();
    expect(screen.getByText(/at least two rolls/i)).toBeInTheDocument();
  });
});
