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
// Big pool 3d6 (success on 4+, per-die p = 0.5): P(≥2 successes) = 4/8 = 50.0%
const BIG_POOL = {
  id: 'p2',
  name: 'Big pool',
  parts: [{ id: 'bpp', count: 3, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'pool',
  successThreshold: { direction: 'gte', value: 4 },
};
// Huge pool 4d6 (success on 4+, per-die p = 0.5):
// P(≥2 successes) = 1 - (1 + 4)/16 = 11/16 = 68.8%
const HUGE_POOL = {
  id: 'p3',
  name: 'Huge pool',
  parts: [{ id: 'hpp', count: 4, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'pool',
  successThreshold: { direction: 'gte', value: 4 },
};

// A pool of 500 dice. poolComplexity is 500 * 500 = 250,000, past the engine's
// MAX_COMPLEXITY of 1e5, so toTargetRows drops the row as unchartable. It is
// still mode 'pool', which is what the toolbar and the Hit % column go by.
const OVERSIZED_POOL = {
  id: 'p4',
  name: 'Oversized pool',
  parts: [{ id: 'opp', count: 500, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'pool',
  successThreshold: { direction: 'gte', value: 4 },
};

// Writes the legacy scalar by default so the migration stays exercised, and the
// list when a test asks for one.
function seedState(opts: {
  expressions: unknown[];
  targetValues: number[];
  poolTarget?: number;
  poolTargets?: number[];
}) {
  const state = {
    version: 3,
    expressions: opts.expressions,
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: opts.targetValues, ruling: 'gte' },
      view: 'target',
      ...(opts.poolTargets === undefined
        ? { poolTarget: opts.poolTarget ?? 2 }
        : { poolTargets: opts.poolTargets }),
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

function cellsFor(name: string): HTMLElement[] {
  const row = screen
    .getAllByRole('row')
    .find((r) => r.textContent?.includes(name));
  return within(row!).getAllByRole('cell');
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

  it('blames the dice, not the missing target, when the only pool row is unchartable', () => {
    seedState({ expressions: [OVERSIZED_POOL], targetValues: [] });
    renderView();
    expect(
      screen.getByText(
        'Add a roll with valid dice to see hit chances against your targets.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Add a target above to see how likely each roll is to hit it.',
      ),
    ).toBeNull();
  });

  it('asks an empty table for a roll rather than for a target', () => {
    seedState({ expressions: [], targetValues: [] });
    renderView();
    expect(
      screen.getByText(
        'Add a roll with valid dice to see hit chances against your targets.',
      ),
    ).toBeInTheDocument();
  });

  it('still asks for a target once a chartable roll exists', () => {
    seedState({ expressions: [ALPHA, OVERSIZED_POOL], targetValues: [] });
    renderView();
    expect(
      screen.getByText(
        'Add a target above to see how likely each roll is to hit it.',
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

  it('gives each scale its own columns, leaving the other kind blank', () => {
    seedState({
      expressions: [ALPHA, POOL],
      targetValues: [7, 10],
      poolTarget: 2,
    });
    renderView();

    const headers = screen
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toHaveLength(4);
    expect(headers[3]).toContain('≥2 successes');

    const poolCells = cellsFor('Pool row');
    expect(poolCells[1]).toHaveTextContent(/^$/);
    expect(poolCells[2]).toHaveTextContent(/^$/);
    expect(poolCells[3]).toHaveTextContent(/^25\.0%$/);

    const sumCells = cellsFor('Alpha');
    expect(sumCells[1]).toHaveTextContent(/^58\.3%$/);
    expect(sumCells[2]).toHaveTextContent(/^16\.7%$/);
    expect(sumCells[3]).toHaveTextContent(/^$/);

    expect(screen.queryByText(/pool rows use the pool target/)).toBeNull();
  });

  it('gives every pool target its own column', () => {
    seedState({
      expressions: [ALPHA, POOL],
      targetValues: [7],
      poolTargets: [1, 2],
    });
    renderView();

    const headers = screen
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toHaveLength(4);
    expect(headers[2]).toContain('≥1 successes');
    expect(headers[3]).toContain('≥2 successes');

    const poolCells = cellsFor('Pool row');
    expect(poolCells[2]).toHaveTextContent(/^75\.0%$/);
    expect(poolCells[3]).toHaveTextContent(/^25\.0%$/);
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

  it('gives the pool targets their own panels beside the numeric ones', () => {
    seedState({
      expressions: [ALPHA, POOL],
      targetValues: [7, 10],
      poolTargets: [1, 2],
    });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Bars' }));

    expect(screen.getByText('Target 7')).toBeInTheDocument();
    expect(screen.getByText('Target 10')).toBeInTheDocument();
    expect(screen.getByText('Pool target ≥1 successes')).toBeInTheDocument();
    expect(screen.getByText('Pool target ≥2 successes')).toBeInTheDocument();
    // One bar per pool panel, and none under the numeric ones.
    expect(screen.getAllByText('Pool row')).toHaveLength(2);
    expect(screen.getAllByText('Alpha')).toHaveLength(2);
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

describe('TargetHitView pool-only columns', () => {
  it('measures a pool table against the pool target when no numeric target is set', () => {
    seedState({ expressions: [POOL], targetValues: [], poolTarget: 2 });
    renderView();

    expect(
      screen.queryByText(
        'Add a target above to see how likely each roll is to hit it.',
      ),
    ).toBeNull();
    expect(
      screen.getByRole('columnheader', { name: /≥2 successes/ }),
    ).toBeInTheDocument();
    // Name plus the pool target, and no numeric column invented alongside it.
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });

  it('shows the pool row hit chance under the pool column', () => {
    seedState({ expressions: [POOL], targetValues: [], poolTarget: 2 });
    renderView();
    expect(cellsFor('Pool row')[1]).toHaveTextContent(/^25\.0%$/);
  });

  it('re-reads the column and the percent when the pool target asks for fewer successes', () => {
    seedState({ expressions: [POOL], targetValues: [], poolTarget: 1 });
    renderView();

    expect(
      screen.getByRole('columnheader', { name: /≥1 successes/ }),
    ).toBeInTheDocument();
    expect(cellsFor('Pool row')[1]).toHaveTextContent(/^75\.0%$/);
  });

  it('leaves every sum row blank under a pool column', () => {
    seedState({
      expressions: [ALPHA, BETA, POOL],
      targetValues: [],
      poolTarget: 2,
    });
    renderView();
    expect(gridRowNames()).toEqual(['Alpha', 'Beta', 'Pool row']);

    const hits = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1]?.textContent ?? '');
    expect(hits).toEqual(['', '', '25.0%']);
  });

  it('drops the pool star and its footnote when the only column is the pool target', () => {
    seedState({ expressions: [ALPHA, POOL], targetValues: [], poolTarget: 2 });
    renderView();

    expect(cellsFor('Pool row')[1]).toHaveTextContent(/^25\.0%$/);
    expect(
      screen.getByText(
        'Click a target column to sort. Green is reliable, red is a long shot.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/pool rows use the pool target/)).toBeNull();
  });

  it('labels the bars panel with the pool target when it is the only column', () => {
    seedState({ expressions: [POOL], targetValues: [], poolTarget: 2 });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Bars' }));

    expect(screen.getByText('Pool target ≥2 successes')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('cycles the sort from the pool column header', () => {
    // Seeded out of hit order (50.0%, 25.0%, 68.8%) so each of the three sort
    // states reads as a different row order, not just a different aria-sort.
    seedState({
      expressions: [BIG_POOL, POOL, HUGE_POOL],
      targetValues: [],
      poolTarget: 2,
    });
    renderView();
    expect(gridRowNames()).toEqual(['Big pool', 'Pool row', 'Huge pool']);

    fireEvent.click(screen.getByRole('button', { name: /successes/ }));
    expect(gridRowNames()).toEqual(['Huge pool', 'Big pool', 'Pool row']);
    expect(
      screen.getByRole('columnheader', { name: /successes/ }),
    ).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(screen.getByRole('button', { name: /successes/ }));
    expect(gridRowNames()).toEqual(['Pool row', 'Big pool', 'Huge pool']);
    expect(
      screen.getByRole('columnheader', { name: /successes/ }),
    ).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(screen.getByRole('button', { name: /successes/ }));
    expect(gridRowNames()).toEqual(['Big pool', 'Pool row', 'Huge pool']);
    expect(
      screen.getByRole('columnheader', { name: /successes/ }),
    ).not.toHaveAttribute('aria-sort');
  });
});
