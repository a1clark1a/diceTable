import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { TargetHitView } from './TargetHitView';

// Hand-computed fixtures (ruling ≥). The validator sorts target values
// ascending on hydration, so seeding [7, 10] yields columns 7 then 10.
//   Alpha 2d6:  P(≥7) = 21/36 = 58.3%   P(≥10) = 6/36 = 16.7%
//   Beta 1d12:  P(≥7) =  6/12 = 50.0%   P(≥10) = 3/12 = 25.0%
//   Gamma 1d8:  P(≥7) =  2/8  = 25.0%   P(≥10) =  0/8 =  0.0%
//   Pool 2d6 (success on 4+, per-die p = 0.5): P(≥2 successes) = 25.0%
const ALPHA = {
  id: 'a1',
  name: 'Alpha',
  parts: [{ id: 'ap', count: 2, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};
const BETA = {
  id: 'b1',
  name: 'Beta',
  parts: [{ id: 'bp', count: 1, sides: 12 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};
const GAMMA = {
  id: 'g1',
  name: 'Gamma',
  parts: [{ id: 'gp', count: 1, sides: 8 }],
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

function seedState(opts: {
  expressions: unknown[];
  targetValues: number[];
  poolTarget?: number;
}) {
  const state = {
    version: 3,
    expressions: opts.expressions,
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: opts.targetValues, ruling: 'gte' },
      view: 'target',
      poolTarget: opts.poolTarget ?? 2,
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
        <TargetHitView />
      </AppProvider>
    </ChakraProvider>,
  );
}

function gridRowNames(): string[] {
  const rows = screen.getAllByRole('row').slice(1);
  return rows.map(
    (row) => within(row).getAllByRole('cell')[0]?.textContent ?? '',
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('TargetHitView empty states', () => {
  it('prompts for a target when none is set', () => {
    seedState({ expressions: [ALPHA], targetValues: [] });
    renderView();
    expect(
      screen.getByText(
        'Add a target above to see how likely each roll is to hit it.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grid' })).toBeNull();
  });

  it('prompts for a roll when targets exist but no roll has a distribution', () => {
    seedState({ expressions: [], targetValues: [10] });
    renderView();
    expect(
      screen.getByText(
        'Add a roll with valid dice to see hit chances against your targets.',
      ),
    ).toBeInTheDocument();
  });
});

describe('TargetHitView grid', () => {
  it('shows one cell per roll and target with exact percents', () => {
    seedState({ expressions: [ALPHA, BETA], targetValues: [7, 10] });
    renderView();
    expect(screen.getByText('58.3%')).toBeInTheDocument();
    expect(screen.getByText('16.7%')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('cycles a target column through desc, asc, and cleared', () => {
    seedState({ expressions: [ALPHA, BETA, GAMMA], targetValues: [7, 10] });
    renderView();
    expect(gridRowNames()).toEqual(['Alpha', 'Beta', 'Gamma']);

    fireEvent.click(screen.getByRole('button', { name: /≥ 10/ }));
    expect(gridRowNames()).toEqual(['Beta', 'Alpha', 'Gamma']);
    expect(
      screen.getByRole('columnheader', { name: /≥ 10/ }),
    ).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(screen.getByRole('button', { name: /≥ 10/ }));
    expect(gridRowNames()).toEqual(['Gamma', 'Alpha', 'Beta']);
    expect(
      screen.getByRole('columnheader', { name: /≥ 10/ }),
    ).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(screen.getByRole('button', { name: /≥ 10/ }));
    expect(gridRowNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(
      screen.getByRole('columnheader', { name: /≥ 10/ }),
    ).not.toHaveAttribute('aria-sort');
  });

  it('clears an active sort from the Name header', () => {
    seedState({ expressions: [ALPHA, BETA, GAMMA], targetValues: [7, 10] });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: /≥ 10/ }));
    expect(gridRowNames()).toEqual(['Beta', 'Alpha', 'Gamma']);

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(gridRowNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('shows a pool row under the first target only, starred against the pool target', () => {
    seedState({
      expressions: [ALPHA, POOL],
      targetValues: [7, 10],
      poolTarget: 2,
    });
    renderView();

    const poolRow = screen
      .getAllByRole('row')
      .find((row) => row.textContent?.includes('Pool row'));
    expect(poolRow).toBeDefined();
    const cells = within(poolRow!).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('25.0%*');
    expect(cells[2]).toHaveTextContent(/^$/);

    expect(
      screen.getByText(/\* pool rows use the pool target\./),
    ).toBeInTheDocument();
  });

  it('omits the pool footnote when every roll sums', () => {
    seedState({ expressions: [ALPHA, BETA], targetValues: [7] });
    renderView();
    expect(screen.queryByText(/pool rows use the pool target/)).toBeNull();
  });
});

describe('TargetHitView kind filter', () => {
  it('hides the filter chips when only sum rolls exist', () => {
    seedState({ expressions: [ALPHA, BETA], targetValues: [7] });
    renderView();
    expect(screen.queryByRole('button', { name: 'Pools' })).toBeNull();
  });

  it('narrows the grid to sum or pool rolls', () => {
    seedState({ expressions: [ALPHA, POOL], targetValues: [7] });
    renderView();
    expect(gridRowNames()).toEqual(['Alpha', 'Pool row']);

    fireEvent.click(screen.getByRole('button', { name: 'Sum' }));
    expect(gridRowNames()).toEqual(['Alpha']);

    fireEvent.click(screen.getByRole('button', { name: 'Pools' }));
    expect(gridRowNames()).toEqual(['Pool row']);

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(gridRowNames()).toEqual(['Alpha', 'Pool row']);
  });
});

describe('TargetHitView bars', () => {
  it('renders one panel per target with rolls sorted by hit chance', () => {
    seedState({ expressions: [ALPHA, BETA], targetValues: [7, 10] });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Bars' }));

    expect(screen.getByText('Target 7')).toBeInTheDocument();
    expect(screen.getByText('Target 10')).toBeInTheDocument();
    expect(screen.getByText('58.3%')).toBeInTheDocument();
    expect(screen.getByText('16.7%')).toBeInTheDocument();

    // Document order: Target 7 panel sorts Alpha (58.3%) over Beta (50.0%);
    // Target 10 flips them (25.0% over 16.7%).
    const names = screen
      .getAllByText(/^(Alpha|Beta)$/)
      .map((el) => el.textContent);
    expect(names).toEqual(['Alpha', 'Beta', 'Beta', 'Alpha']);
  });

  it('labels the first panel with the pool target and keeps pools out of the rest', () => {
    seedState({
      expressions: [ALPHA, POOL],
      targetValues: [7, 10],
      poolTarget: 2,
    });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Bars' }));

    expect(
      screen.getByText('Target 7 (pools: ≥2 successes)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Target 10')).toBeInTheDocument();
    expect(screen.getAllByText('Pool row')).toHaveLength(1);
  });
});

describe('TargetHitView curves wiring', () => {
  it('plots sum rolls only and marks each current target', () => {
    seedState({ expressions: [ALPHA, POOL], targetValues: [7, 10] });
    const { container } = renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Curves' }));

    expect(screen.getByText('Hit chance by target')).toBeInTheDocument();
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(screen.queryByText('Pool row')).toBeNull();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('explains itself when only pool rolls exist', () => {
    seedState({ expressions: [POOL], targetValues: [7] });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Curves' }));
    expect(
      screen.getByText(
        'Curves compare rolls that add into a total. Switch a roll to Sum to see it here.',
      ),
    ).toBeInTheDocument();
  });
});
