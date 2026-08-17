import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { RollOffView } from './RollOffView';

// Hand-computed fixtures.
//   Strong 1d6+10 vs Weak 1d6: ranges never overlap, so Strong wins 100.0%
//   with no ties. Twin A / Twin B (both 1d6): each wins 15/36 = 41.7% and
//   ties 6/36 = 16.7%, a coin flip.
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
      view: 'rolloff',
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
        <RollOffView />
      </AppProvider>
    </ChakraProvider>,
  );
}

function shownNames(): string[] {
  return screen
    .getAllByText(/^(Strong|Weak|Twin A|Twin B|Pool row)$/)
    .map((el) => el.textContent ?? '');
}

afterEach(() => {
  window.localStorage.clear();
});

describe('RollOffView empty state', () => {
  it('prompts for more rolls when fewer than two have valid dice', () => {
    seedState([STRONG]);
    renderView();
    expect(
      screen.getByText(
        'Add at least two rolls with valid dice to start the roll-off.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Win chance' })).toBeNull();
  });
});

describe('RollOffView results', () => {
  it('names the favorite in the headline and shows exact win chances', () => {
    seedState([WEAK, STRONG]);
    renderView();
    expect(
      screen.getByText('Strong is most likely to come out on top.'),
    ).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('calls a near-even race a coin flip', () => {
    seedState([TWIN_A, TWIN_B]);
    renderView();
    expect(
      screen.getByText('It’s nearly a coin flip between Twin A and Twin B.'),
    ).toBeInTheDocument();
  });

  it('notes ties per roll and explains them when they can happen', () => {
    seedState([TWIN_A, TWIN_B]);
    renderView();
    expect(screen.getAllByText('ties 16.7%')).toHaveLength(2);
    expect(
      screen.getByText(
        'Ties happen when two or more rolls land the same top number. Nobody wins those outright.',
      ),
    ).toBeInTheDocument();
  });

  it('omits the tie note when rolls can never tie', () => {
    seedState([WEAK, STRONG]);
    renderView();
    expect(screen.queryByText(/Ties happen/)).toBeNull();
  });
});

describe('RollOffView sorting', () => {
  it('sorts by win chance by default and restores table order on toggle', () => {
    seedState([WEAK, STRONG]);
    renderView();
    expect(shownNames()).toEqual(['Strong', 'Weak']);

    fireEvent.click(screen.getByRole('button', { name: 'Table order' }));
    expect(shownNames()).toEqual(['Weak', 'Strong']);

    fireEvent.click(screen.getByRole('button', { name: 'Win chance' }));
    expect(shownNames()).toEqual(['Strong', 'Weak']);
  });
});

describe('RollOffView mixed scales', () => {
  it('captions the pool-vs-sum comparison when both kinds are shown', () => {
    seedState([STRONG, POOL]);
    renderView();
    expect(
      screen.getByText(/Pool rows compare their success counts/),
    ).toBeInTheDocument();
  });

  it('omits the caption when every roll sums', () => {
    seedState([WEAK, STRONG]);
    renderView();
    expect(
      screen.queryByText(/Pool rows compare their success counts/),
    ).toBeNull();
  });
});
