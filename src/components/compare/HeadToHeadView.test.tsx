import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { HeadToHeadView } from './HeadToHeadView';

// Hand-computed fixtures.
//   Strong 1d6+10 vs Weak 1d6: ranges never overlap, so the Strong row reads
//   100.0% against Weak, and the Weak row reads 0.0% back.
//   Twin A / Twin B (both 1d6): each beats the other 15/36 = 41.7%.
const STRONG = {
  id: 's1',
  name: 'Strong',
  parts: [{ id: 'sp', count: 1, sides: 6 }],
  flatModifier: 10,
  rollMode: 'normal',
  mode: 'sum',
};
const WEAK = {
  id: 'w1',
  name: 'Weak',
  parts: [{ id: 'wp', count: 1, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};
const TWIN_A = {
  id: 't1',
  name: 'Twin A',
  parts: [{ id: 'tp1', count: 1, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};
const TWIN_B = {
  id: 't2',
  name: 'Twin B',
  parts: [{ id: 'tp2', count: 1, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};
const POOL = {
  id: 'p1',
  name: 'Pool row',
  parts: [{ id: 'pp', count: 2, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'pool',
  successThreshold: { direction: 'gte', value: 4 },
};

function seedState(expressions: unknown[]) {
  const state = {
    version: 3,
    expressions,
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [], ruling: 'gte' },
      view: 'matrix',
      poolTarget: 2,
      baselineId: null,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

function renderView() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <HeadToHeadView />
      </AppProvider>
    </ChakraProvider>,
  );
}

function bodyRows() {
  return screen.getAllByRole('row').slice(1);
}

afterEach(() => {
  window.localStorage.clear();
});

describe('HeadToHeadView empty state', () => {
  it('prompts for more rolls when fewer than two have valid dice', () => {
    seedState([STRONG]);
    renderView();
    expect(
      screen.getByText(
        'Add at least two rolls with valid dice to compare head-to-head.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('HeadToHeadView matrix', () => {
  it('reads row-beats-column with exact percents and dashed diagonal', () => {
    seedState([STRONG, WEAK]);
    renderView();

    const [strongRow, weakRow] = bodyRows();
    const strongCells = within(strongRow!).getAllByRole('cell');
    expect(strongCells[0]).toHaveTextContent('Strong');
    expect(strongCells[1]).toHaveTextContent('—');
    expect(strongCells[2]).toHaveTextContent('100.0%');

    const weakCells = within(weakRow!).getAllByRole('cell');
    expect(weakCells[0]).toHaveTextContent('Weak');
    expect(weakCells[1]).toHaveTextContent('0.0%');
    expect(weakCells[2]).toHaveTextContent('—');
  });

  it('names every roll across the column headers', () => {
    seedState([STRONG, WEAK]);
    renderView();
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(3);
    expect(headers[1]).toHaveTextContent('Strong');
    expect(headers[2]).toHaveTextContent('Weak');
  });

  it('shows symmetric odds for identical rolls', () => {
    seedState([TWIN_A, TWIN_B]);
    renderView();
    expect(screen.getAllByText('41.7%')).toHaveLength(2);
  });
});

describe('HeadToHeadView mixed scales', () => {
  it('captions the pool-vs-sum comparison when both kinds are shown', () => {
    seedState([STRONG, POOL]);
    renderView();
    expect(
      screen.getByText(/Pool rows compare their success counts/),
    ).toBeInTheDocument();
  });

  it('omits the caption when every roll sums', () => {
    seedState([STRONG, WEAK]);
    renderView();
    expect(
      screen.queryByText(/Pool rows compare their success counts/),
    ).toBeNull();
  });
});
