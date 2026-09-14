import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../state/AppContext';
import { openParams } from '../test/params';
import { RollHistoryProvider } from '../state/RollHistoryContext';
import { RollsCards } from './RollsCards';
import { TargetToolbar } from './TargetToolbar';
// The inspect dialog renders its body behind React.lazy. Loading that module
// here puts it in the registry before any test runs, so the dynamic import
// resolves from cache instead of racing a cold recharts transform against the
// query timeout while the rest of the suite saturates the machine.
import './inspect/InspectChartBody';

function seedState(opts: {
  targetValues: number[];
  poolTarget: number;
  /** Seeds the list instead of the legacy scalar the other cases migrate. */
  poolTargets?: number[];
  /** Drops the sum card so the list holds nothing but the pool roll. */
  poolOnly?: boolean;
  /** Seeded chart view; each card resolves its own Shape label from it. */
  chartView?: 'pmf' | 'target';
}) {
  const sumRow = {
    id: 'sum1',
    name: 'Sum row',
    parts: [{ id: 'sp1', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
  const poolRow = {
    id: 'pool1',
    name: 'Pool row',
    parts: [{ id: 'pp1', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 4 },
  };
  const state = {
    version: 3,
    expressions: opts.poolOnly === true ? [poolRow] : [sumRow, poolRow],
    ui: {
      expandedId: null,
      chartView: opts.chartView ?? 'pmf',
      target: { values: opts.targetValues, ruling: 'gte' },
      view: 'table',
      ...(opts.poolTargets === undefined
        ? { poolTarget: opts.poolTarget }
        : { poolTargets: opts.poolTargets }),
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

// The toolbar renders alongside the cards (TablePage hoists it to the page
// level), and the pool Hit % tests drive the pool-target input it owns.
function renderCards() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <RollHistoryProvider>
          <TargetToolbar />
          <RollsCards />
        </RollHistoryProvider>
      </AppProvider>
    </ChakraProvider>,
  );
}

// Smallest ancestor holding both the hit value and its "Hit %" pill label:
// walking up from the unique percent text lands on the StatPill root without
// depending on Chakra's intermediate wrapper structure.
function hitPillAround(valueText: string): HTMLElement {
  let el: HTMLElement | null = screen.getByText(valueText);
  while (el !== null && !(el.textContent ?? '').includes('Hit %')) {
    el = el.parentElement;
  }
  if (el === null) throw new Error(`no Hit % pill found around ${valueText}`);
  return el;
}

// The card that owns a named roll: the smallest ancestor of the name field
// that also holds the card's stats grid, identified by its "Range" pill.
function cardFor(rollName: string): HTMLElement {
  let el: HTMLElement | null = screen.getByDisplayValue(rollName);
  while (el !== null && !(el.textContent ?? '').includes('Range')) {
    el = el.parentElement;
  }
  if (el === null) throw new Error(`no card found for ${rollName}`);
  return el;
}

// A rendered hit chance, e.g. "25.0%". The "Hit %" pill label is not a value
// and never matches, so a card holding one of these is showing a real chance.
const HIT_VALUE = /^\d+\.\d%$/;

afterEach(() => {
  window.localStorage.clear();
});

describe('RollsCards pool Hit %', () => {
  it('shows the ≥2 pool label with 25.0% on the pool card and 16.7% on the sum card', async () => {
    seedState({ targetValues: [10], poolTarget: 2 });
    renderCards();

    const poolLabel = screen.getByText('≥2');
    const poolValueRow = poolLabel.closest('div')!;
    expect(within(poolValueRow).getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText('16.7%')).toBeInTheDocument();
  });

  it('renders the ruling glyph accessory on the sum card pill only, never on the pool card', async () => {
    seedState({ targetValues: [10], poolTarget: 2 });
    renderCards();

    const sumPill = hitPillAround('16.7%');
    const poolPill = hitPillAround('25.0%');

    // Leaf filter: the glyph text node lives in exactly one childless span;
    // wrapper elements around it repeat the same textContent and would
    // double-count the single visible symbol.
    const glyphsIn = (pill: HTMLElement) =>
      within(pill)
        .queryAllByText('≥')
        .filter((el) => el.children.length === 0);

    expect(glyphsIn(sumPill)).toHaveLength(1);
    expect(glyphsIn(poolPill)).toHaveLength(0);
  });

  it('adding pool target 1 with Enter stacks a second percentage on the pool card', async () => {
    seedState({ targetValues: [10], poolTarget: 2 });
    renderCards();

    await openParams('Edit pool targets');
    const input = screen.getByLabelText('Add pool target');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const lowerBar = screen.getByText('≥1').closest('div')!;
    expect(within(lowerBar).getByText('75.0%')).toBeInTheDocument();
    const higherBar = screen.getByText('≥2').closest('div')!;
    expect(within(higherBar).getByText('25.0%')).toBeInTheDocument();
  });

  it('removing a pool target chip takes its percentage off the pool card', async () => {
    seedState({ targetValues: [10], poolTarget: 2, poolTargets: [1, 2] });
    renderCards();
    await openParams('Edit pool targets');

    expect(screen.getByText('≥1')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove pool target ≥ 1' }),
    );
    expect(screen.queryByText('≥1')).toBeNull();
    expect(screen.getByText('≥2')).toBeInTheDocument();
  });

  it('keeps the pool Hit % pill when no numeric target is set', async () => {
    seedState({ targetValues: [], poolTarget: 2 });
    renderCards();

    const poolLabel = screen.getByText('≥2');
    const poolValueRow = poolLabel.closest('div')!;
    expect(within(poolValueRow).getByText('25.0%')).toBeInTheDocument();
    // The sum card keeps its pill in the grid but has no target to measure.
    expect(screen.queryByText('16.7%')).toBeNull();
  });

  it('keeps the Hit % pill on a card list of only pool rolls with no numeric target', async () => {
    seedState({ targetValues: [], poolTarget: 2, poolOnly: true });
    renderCards();

    expect(screen.getByText('Hit %')).toBeInTheDocument();
    const poolLabel = screen.getByText('≥2');
    const poolValueRow = poolLabel.closest('div')!;
    expect(within(poolValueRow).getByText('25.0%')).toBeInTheDocument();
  });

  it('keeps the sum card Hit % pill empty while the pool card keeps its percentage', async () => {
    seedState({ targetValues: [], poolTarget: 2 });
    renderCards();

    const sumCard = cardFor('Sum row');
    // The pill stays in the sum card's grid so both cards keep the same
    // shape, but a sum row with no numeric target has nothing to measure.
    expect(within(sumCard).getByText('Hit %')).toBeInTheDocument();
    expect(within(sumCard).queryByText(HIT_VALUE)).toBeNull();
    expect(within(cardFor('Pool row')).getByText('25.0%')).toBeInTheDocument();
  });

  it('opens the Hit % pill when a sum card is switched to pool with no numeric target', async () => {
    seedTwoSumCards([]);
    renderCards();
    expect(screen.queryByText('Hit %')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Pool' })[0]!);

    // The pill is a list-wide column, so both cards gain it together.
    expect(screen.getAllByText('Hit %')).toHaveLength(2);
  });

  it('labels the pool card Shape as Target and the sum card as PMF with no numeric target', async () => {
    seedState({ targetValues: [], poolTarget: 2, chartView: 'target' });
    renderCards();

    // A pool card measures the pool target, so target view stays available to
    // it; the sum card has nothing to highlight and falls back to PMF.
    expect(within(cardFor('Pool row')).getByText('Target')).toBeInTheDocument();
    expect(within(cardFor('Sum row')).getByText('PMF')).toBeInTheDocument();
  });
});

// Two sum rows with hand-computed stats: 2d6 → mean 7.00; 1d6+5 → mean 8.50.
// Deltas vs the 2d6 baseline: avg +1.50, spread −0.71, hit (target 10, gte)
// 33.3% − 16.7% → +16.7%.
function seedTwoSumCards(targetValues: number[] = [10]) {
  const state = {
    version: 3,
    expressions: [
      {
        id: 'sum1',
        name: 'Sum row',
        parts: [{ id: 'sp1', count: 2, sides: 6 }],
        flatModifier: 0,
        rollMode: 'normal',
        mode: 'sum',
      },
      {
        id: 'sum2',
        name: 'Bonus row',
        parts: [{ id: 'sp2', count: 1, sides: 6 }],
        flatModifier: 5,
        rollMode: 'normal',
        mode: 'sum',
      },
    ],
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: targetValues, ruling: 'gte' },
      view: 'table',
      poolTarget: 1,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

describe('RollsCards baseline pin round trip', () => {
  it('pinning swaps the sibling card to a delta pill and unpinning restores it', async () => {
    seedTwoSumCards();
    renderCards();

    expect(screen.getByText('8.50')).toBeInTheDocument();
    expect(screen.queryByText('Avg')).toBeNull();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );

    // Baseline card: badge plus untouched absolute stats.
    expect(screen.getAllByRole('button', { name: 'Clear baseline' })).toHaveLength(1);
    expect(screen.getByText('7.00')).toBeInTheDocument();
    expect(screen.getByText('16.7%')).toBeInTheDocument();

    // Sibling card: the Mean ± σ pill becomes a delta pill.
    expect(screen.getByText('Avg')).toBeInTheDocument();
    expect(screen.getByText('Spread')).toBeInTheDocument();
    expect(screen.getByText('+1.50')).toBeInTheDocument();
    expect(screen.getByText('−0.71')).toBeInTheDocument();
    expect(screen.getByText('+16.7%')).toBeInTheDocument();
    expect(screen.queryByText('8.50')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear baseline' }));

    expect(screen.queryByText('Avg')).toBeNull();
    expect(screen.queryAllByRole('button', { name: 'Clear baseline' })).toHaveLength(0);
    expect(screen.getByText('8.50')).toBeInTheDocument();
  });

  it('names the compare pill with the verdict', async () => {
    seedTwoSumCards();
    renderCards();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );

    // The sentence is the trigger's accessible name rather than free-flowing
    // prose: a line that appears on pin used to grow every sibling card.
    expect(
      screen.getByRole('button', {
        name: 'Compare with Sum row: Averages 1.5 higher, steadier, hits 17% more often',
      }),
    ).toBeInTheDocument();
  });
});

// InspectChartBody pulls in recharts' ResponsiveContainer, which needs a
// ResizeObserver that jsdom does not provide.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

describe('RollsCards inspect modal target', () => {
  it('opens the pool card inspect chart on the Target view with no numeric target', async () => {
    seedState({ targetValues: [], poolTarget: 2, chartView: 'target' });
    renderCards();

    fireEvent.click(
      screen.getByRole('button', { name: 'Inspect chart for Pool row' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Target')).toBeInTheDocument();
  });

  it('opens the sum card inspect chart on PMF on that same table', async () => {
    seedState({ targetValues: [], poolTarget: 2, chartView: 'target' });
    renderCards();

    fireEvent.click(
      screen.getByRole('button', { name: 'Inspect chart for Sum row' }),
    );

    const dialog = await screen.findByRole('dialog');
    // A sum row has no numeric target to measure, so target view is not
    // available to it even though the pool card next to it reaches it.
    expect(await within(dialog).findByText('PMF')).toBeInTheDocument();
    expect(within(dialog).queryByText('Target')).toBeNull();
  });
});
