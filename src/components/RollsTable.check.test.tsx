import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { AppProvider } from '../state/AppContext';
import { RollHistoryProvider } from '../state/RollHistoryContext';
import { RollsTable } from './RollsTable';
import { RollsCards } from './RollsCards';
import { TargetHitView } from './target/TargetHitView';
import { RollOffView } from './compare/RollOffView';
import { HeadToHeadView } from './compare/HeadToHeadView';

// Hand-computed fixtures.
//
// CHECK_ROW rolls 1d20+7 and succeeds on 15 or more, so faces 8..19 succeed
// (12/20) and face 20 crits (1/20): 13 of 20 faces land, i.e. 65%.
// Its distribution mixes 0 on a failure (0.35), 1d8+4 on a plain success
// (0.60, mean 8.5) and 2d8+4 on a crit (0.05, mean 13), so the row's average
// is 0.60 * 8.5 + 0.05 * 13 = 5.75 and its spread is 4.73.
//
// SUM_ROW rolls 2d6+3: average 10, spread sqrt(70/12) = 2.42.
// Against SUM_ROW as the baseline the check row is therefore 4.25 lower on
// average and 2.32 wider in spread.
//
// Against a target of 10 or more the check row lands 0.60 * 3/8 (the 10, 11
// and 12 faces of 1d8+4) + 0.05 * 54/64 (2d8 >= 6) = 26.7%, and the sum row
// lands 21/36 = 58.3%.
//
// Head to head the check row's effect beats 2d6+3 20.7% of the time and loses
// 72.7% of the time (they tie 6.6%), which is what the roll-off and the
// head-to-head grid print.
const CHECK_ROW = {
  id: 'check-row',
  name: 'Longsword',
  parts: [{ id: 'check-part', count: 1, sides: 20 }],
  flatModifier: 7,
  rollMode: 'normal',
  mode: 'check',
  check: {
    threshold: { direction: 'gte', value: 15 },
    effect: { parts: [{ id: 'effect-part', count: 1, sides: 8 }], flatModifier: 4 },
    onSuccess: 'full',
    onFailure: 'none',
    crit: { onFaces: [20], effect: 'doubleDice' },
  },
};

// A 100d100 keep-highest effect blows the complexity guard, so the row's odds
// are not computable; the chip must say so rather than claim a confident 0%.
const HEAVY_CHECK_ROW = {
  id: 'heavy-check-row',
  name: 'Heavy check',
  parts: [{ id: 'heavy-check-part', count: 1, sides: 20 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'check',
  check: {
    threshold: { direction: 'gte', value: 10 },
    effect: {
      parts: [
        {
          id: 'heavy-effect-part',
          count: 100,
          sides: 100,
          keep: { type: 'highest', n: 1 },
        },
      ],
      flatModifier: 0,
    },
    onSuccess: 'full',
    onFailure: 'none',
  },
};

// 3d6 needing 4 or more misses only on triple 1 (1/216), so a whole-percent
// readout has to hedge to >99% rather than round the miss out of existence.
const NEAR_CERTAIN_CHECK_ROW = {
  id: 'near-certain-row',
  name: 'Nearly sure',
  parts: [{ id: 'near-certain-part', count: 3, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'check',
  check: {
    threshold: { direction: 'gte', value: 4 },
    effect: { parts: [{ id: 'near-certain-effect', count: 1, sides: 6 }], flatModifier: 0 },
    onSuccess: 'full',
    onFailure: 'none',
  },
};

const SUM_ROW = {
  id: 'sum-row',
  name: 'Greatclub',
  parts: [{ id: 'sum-part', count: 2, sides: 6 }],
  flatModifier: 3,
  rollMode: 'normal',
  mode: 'sum',
};

const POOL_ROW = {
  id: 'pool-row',
  name: 'Dice pool',
  parts: [{ id: 'pool-part', count: 2, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'pool',
  successThreshold: { direction: 'gte', value: 4 },
};

interface SeedUi {
  targetValues?: number[];
  baselineId?: string;
}

function seed(expressions: unknown[], ui: SeedUi = {}): void {
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({
      version: 2,
      value: {
        version: 4,
        expressions,
        ui: {
          expandedId: null,
          chartView: 'pmf',
          target: { values: ui.targetValues ?? [], ruling: 'gte' },
          view: 'table',
          poolTarget: 1,
          baselineId: ui.baselineId ?? null,
        },
      },
    }),
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <RollHistoryProvider>{children}</RollHistoryProvider>
      </AppProvider>
    </ChakraProvider>
  );
}

function renderIn(node: ReactNode) {
  return render(<Wrapper>{node}</Wrapper>);
}

// "Check" also labels the mode toggle's third chip, so the badge is the one
// reading that is not itself a control.
function checkBadges(): HTMLElement[] {
  return screen
    .queryAllByText('Check')
    .filter((el) => el.closest('button') === null);
}

const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  errorSpy.mockClear();
});

afterEach(() => {
  window.localStorage.clear();
});

afterAll(() => {
  errorSpy.mockRestore();
});

describe('RollsTable check row', () => {
  it('renders a Check badge on a check row', () => {
    seed([CHECK_ROW]);
    renderIn(<RollsTable />);
    expect(checkBadges()).toHaveLength(1);
  });

  it('renders a succeeds chip carrying the chance the check lands', () => {
    seed([CHECK_ROW]);
    renderIn(<RollsTable />);
    expect(screen.getByText('succeeds 65%')).toBeInTheDocument();
  });

  it('renders no Check badge on a sum row', () => {
    seed([SUM_ROW]);
    renderIn(<RollsTable />);
    expect(screen.getByDisplayValue('Greatclub')).toBeInTheDocument();
    expect(checkBadges()).toHaveLength(0);
  });

  it('renders no succeeds chip on a sum row', () => {
    seed([SUM_ROW]);
    renderIn(<RollsTable />);
    expect(screen.getByDisplayValue('Greatclub')).toBeInTheDocument();
    expect(screen.queryByText(/^succeeds/)).toBeNull();
  });

  it('shows the honest too-complex marker instead of succeeds 0% on a guarded row', () => {
    seed([HEAVY_CHECK_ROW]);
    renderIn(<RollsTable />);
    expect(screen.queryByText(/^succeeds/)).toBeNull();
    // One marker beside the formula, one where the chip would sit.
    expect(screen.getAllByText('(too complex)')).toHaveLength(2);
  });

  it('hedges a near-certain check to >99% instead of rounding to 100%', () => {
    seed([NEAR_CERTAIN_CHECK_ROW]);
    renderIn(<RollsTable />);
    expect(screen.getByText('succeeds >99%')).toBeInTheDocument();
  });

  it('measures a check row against the numeric target the same way a sum row is measured', () => {
    seed([CHECK_ROW, SUM_ROW], { targetValues: [10] });
    renderIn(<RollsTable />);
    expect(screen.getByText('26.7%')).toBeInTheDocument();
    expect(screen.getByText('58.3%')).toBeInTheDocument();
  });
});

describe('RollsCards check row', () => {
  it('renders a Check badge on a check card', () => {
    seed([CHECK_ROW]);
    renderIn(<RollsCards />);
    expect(checkBadges()).toHaveLength(1);
  });

  it('renders a succeeds chip carrying the chance the check lands', () => {
    seed([CHECK_ROW]);
    renderIn(<RollsCards />);
    expect(screen.getByText('succeeds 65%')).toBeInTheDocument();
  });

  it('renders no Check badge on a sum card', () => {
    seed([SUM_ROW]);
    renderIn(<RollsCards />);
    expect(screen.getByDisplayValue('Greatclub')).toBeInTheDocument();
    expect(checkBadges()).toHaveLength(0);
  });

  it('renders no succeeds chip on a sum card', () => {
    seed([SUM_ROW]);
    renderIn(<RollsCards />);
    expect(screen.getByDisplayValue('Greatclub')).toBeInTheDocument();
    expect(screen.queryByText(/^succeeds/)).toBeNull();
  });
});

describe('roll style toggle inside a row', () => {
  it('marks exactly one chip pressed on a check row', () => {
    seed([CHECK_ROW]);
    renderIn(<RollsTable />);
    const group = screen.getByRole('group', { name: 'Roll style' });
    const pressed = within(group)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent('Check');
  });

  it('marks exactly one chip pressed on a sum row', () => {
    seed([SUM_ROW]);
    renderIn(<RollsTable />);
    const group = screen.getByRole('group', { name: 'Roll style' });
    const pressed = within(group)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent('Sum');
  });

  it('moves the pressed chip to Check when Check is clicked on a sum row', () => {
    seed([SUM_ROW]);
    renderIn(<RollsTable />);
    const group = screen.getByRole('group', { name: 'Roll style' });
    fireEvent.click(within(group).getByRole('button', { name: 'Check' }));
    expect(within(group).getByRole('button', { name: 'Check' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'Sum' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('gives the row a Check badge once Check is clicked', () => {
    seed([SUM_ROW]);
    renderIn(<RollsTable />);
    const group = screen.getByRole('group', { name: 'Roll style' });
    fireEvent.click(within(group).getByRole('button', { name: 'Check' }));
    expect(checkBadges()).toHaveLength(1);
  });

  it('computes the succeeds chip from the seeded check after Check is clicked', () => {
    // A switched 2d6+3 row seeds a threshold of 6, which 2d6+3 misses only on
    // a double 1: 35/36 = 97%.
    seed([SUM_ROW]);
    renderIn(<RollsTable />);
    const group = screen.getByRole('group', { name: 'Roll style' });
    fireEvent.click(within(group).getByRole('button', { name: 'Check' }));
    expect(screen.getByText('succeeds 97%')).toBeInTheDocument();
  });

  it('moves the pressed chip back to Sum when Sum is clicked on a check row', () => {
    seed([CHECK_ROW]);
    renderIn(<RollsTable />);
    const group = screen.getByRole('group', { name: 'Roll style' });
    fireEvent.click(within(group).getByRole('button', { name: 'Sum' }));
    expect(within(group).getByRole('button', { name: 'Sum' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(checkBadges()).toHaveLength(0);
    expect(screen.queryByText(/^succeeds/)).toBeNull();
  });

  it('marks exactly one chip pressed on a check card', () => {
    seed([CHECK_ROW]);
    renderIn(<RollsCards />);
    const group = screen.getByRole('group', { name: 'Roll style' });
    const pressed = within(group)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent('Check');
  });
});

describe('baseline deltas treat a check row as sum scale', () => {
  it('shows the average delta on a check row pinned against a sum baseline', () => {
    seed([SUM_ROW, CHECK_ROW], { baselineId: 'sum-row' });
    renderIn(<RollsTable />);
    expect(screen.getByLabelText('4.25 lower than baseline')).toBeInTheDocument();
  });

  it('shows the spread delta on a check row pinned against a sum baseline', () => {
    seed([SUM_ROW, CHECK_ROW], { baselineId: 'sum-row' });
    renderIn(<RollsTable />);
    expect(
      screen.getByLabelText('2.32 more spread than baseline'),
    ).toBeInTheDocument();
  });

  it('never calls a check row a different scale from a sum baseline', () => {
    seed([SUM_ROW, CHECK_ROW], { baselineId: 'sum-row' });
    renderIn(<RollsTable />);
    expect(checkBadges()).toHaveLength(1);
    expect(screen.queryByText(/different scale/)).toBeNull();
  });

  it('shows the average delta on a check card pinned against a sum baseline', () => {
    seed([SUM_ROW, CHECK_ROW], { baselineId: 'sum-row' });
    renderIn(<RollsCards />);
    expect(screen.getByLabelText('4.25 lower than baseline')).toBeInTheDocument();
  });

  it('lets a check row serve as the baseline a sum row compares against', () => {
    seed([SUM_ROW, CHECK_ROW], { baselineId: 'check-row' });
    renderIn(<RollsTable />);
    expect(screen.getByLabelText('4.25 higher than baseline')).toBeInTheDocument();
    expect(
      screen.getByLabelText('2.32 less spread than baseline'),
    ).toBeInTheDocument();
  });

  it('shows a check row its own mean and spread while it is the baseline', () => {
    seed([CHECK_ROW, SUM_ROW], { baselineId: 'check-row' });
    renderIn(<RollsTable />);
    expect(screen.getByText('5.75')).toBeInTheDocument();
    expect(screen.getByText('4.73')).toBeInTheDocument();
  });

  it('calls a check row a different scale from a pool baseline', () => {
    seed([POOL_ROW, CHECK_ROW], { baselineId: 'pool-row' });
    renderIn(<RollsTable />);
    expect(
      screen.getByText('different scale'),
    ).toBeInTheDocument();
  });
});

describe('other workshop views with a check row', () => {
  it('scores a check row in the target hit view off its effect, not its d20', () => {
    seed([CHECK_ROW, SUM_ROW], { targetValues: [10] });
    renderIn(<TargetHitView />);
    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.getByText('26.7%')).toBeInTheDocument();
    expect(screen.getByText('58.3%')).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('rolls a check row off against a sum row on its effect scale', () => {
    seed([CHECK_ROW, SUM_ROW]);
    renderIn(<RollOffView />);
    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.getByText('20.7%')).toBeInTheDocument();
    expect(screen.getByText('72.7%')).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('matches a check row against a sum row in the head-to-head grid', () => {
    seed([CHECK_ROW, SUM_ROW]);
    renderIn(<HeadToHeadView />);
    expect(screen.getAllByText('Longsword')).toHaveLength(2);
    expect(screen.getByText('20.7%')).toBeInTheDocument();
    expect(screen.getByText('72.7%')).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('renders the desktop table with a check row and no console errors', () => {
    seed([CHECK_ROW, SUM_ROW], { targetValues: [10] });
    renderIn(<RollsTable />);
    expect(screen.getByDisplayValue('Longsword')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Greatclub')).toBeInTheDocument();
    expect(screen.getByText('succeeds 65%')).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('renders the mobile cards with a check row and no console errors', () => {
    seed([CHECK_ROW, SUM_ROW], { targetValues: [10] });
    renderIn(<RollsCards />);
    expect(screen.getByDisplayValue('Longsword')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Greatclub')).toBeInTheDocument();
    expect(screen.getByText('succeeds 65%')).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
