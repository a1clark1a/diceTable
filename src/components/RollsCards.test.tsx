import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../state/AppContext';
import { RollHistoryProvider } from '../state/RollHistoryContext';
import { RollsCards } from './RollsCards';
import { TargetToolbar } from './TargetToolbar';

function seedState(opts: { targetValues: number[]; poolTarget: number }) {
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
        id: 'pool1',
        name: 'Pool row',
        parts: [{ id: 'pp1', count: 2, sides: 6 }],
        flatModifier: 0,
        rollMode: 'normal',
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 4 },
      },
    ],
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: opts.targetValues, ruling: 'gte' },
      view: 'table',
      poolTarget: opts.poolTarget,
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

afterEach(() => {
  window.localStorage.clear();
});

describe('RollsCards pool Hit %', () => {
  it('shows the ≥2 pool label with 25.0% on the pool card and 16.7% on the sum card', () => {
    seedState({ targetValues: [10], poolTarget: 2 });
    renderCards();

    const poolLabel = screen.getByText('≥2');
    const poolValueRow = poolLabel.closest('div')!;
    expect(within(poolValueRow).getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText('16.7%')).toBeInTheDocument();
  });

  it('renders the ruling glyph accessory on the sum card pill only, never on the pool card', () => {
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

  it('committing pool target 1 with Enter updates the pool card to 75.0%', () => {
    seedState({ targetValues: [10], poolTarget: 2 });
    renderCards();

    const input = screen.getByLabelText('Pool target, minimum successes');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const poolLabel = screen.getByText('≥1');
    const poolValueRow = poolLabel.closest('div')!;
    expect(within(poolValueRow).getByText('75.0%')).toBeInTheDocument();
    expect(screen.queryByText('25.0%')).toBeNull();
  });

  it('renders no Hit % pill on either card when no targets are set', () => {
    seedState({ targetValues: [], poolTarget: 2 });
    renderCards();

    expect(screen.queryAllByText('Hit %')).toHaveLength(0);
  });
});

// Two sum rows with hand-computed stats: 2d6 → mean 7.00; 1d6+5 → mean 8.50.
// Deltas vs the 2d6 baseline: avg +1.50, spread −0.71, hit (target 10, gte)
// 33.3% − 16.7% → +16.7%.
function seedTwoSumCards() {
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
      target: { values: [10], ruling: 'gte' },
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
  it('pinning swaps the sibling card to a vs-baseline pill and unpinning restores it', () => {
    seedTwoSumCards();
    renderCards();

    expect(screen.getByText('8.50')).toBeInTheDocument();
    expect(screen.queryByText('vs baseline')).toBeNull();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );

    // Baseline card: badge plus untouched absolute stats.
    expect(screen.getByText('Baseline')).toBeInTheDocument();
    expect(screen.getByText('7.00')).toBeInTheDocument();
    expect(screen.getByText('16.7%')).toBeInTheDocument();

    // Sibling card: the Mean ± σ pill becomes a vs-baseline delta pill.
    expect(screen.getByText('vs baseline')).toBeInTheDocument();
    expect(screen.getByText('avg')).toBeInTheDocument();
    expect(screen.getByText('spread')).toBeInTheDocument();
    expect(screen.getByText('+1.50')).toBeInTheDocument();
    expect(screen.getByText('−0.71')).toBeInTheDocument();
    expect(screen.getByText('+16.7%')).toBeInTheDocument();
    expect(screen.queryByText('8.50')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear baseline' }));

    expect(screen.queryByText('vs baseline')).toBeNull();
    expect(screen.queryByText('Baseline')).toBeNull();
    expect(screen.getByText('8.50')).toBeInTheDocument();
  });

  it('writes the verdict line on the sibling card', () => {
    seedTwoSumCards();
    renderCards();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );

    expect(
      screen.getByText('Averages 1.5 higher · steadier · hits 17% more often'),
    ).toBeInTheDocument();
  });
});
