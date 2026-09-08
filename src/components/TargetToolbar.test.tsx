import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../state/AppContext';
import { TargetToolbar } from './TargetToolbar';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

function renderToolbar() {
  return render(
    <Providers>
      <TargetToolbar />
    </Providers>,
  );
}

function getInput(): HTMLInputElement {
  return screen.getByLabelText('Add target value') as HTMLInputElement;
}

function addValue(raw: string) {
  const input = getInput();
  fireEvent.change(input, { target: { value: raw } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

afterEach(() => {
  window.localStorage.clear();
});

describe('TargetToolbar', () => {
  it('starts with no target chips', () => {
    renderToolbar();
    expect(
      screen.queryByRole('button', { name: /^Remove target/i }),
    ).toBeNull();
  });

  it('adds a target chip when a number is entered and Enter is pressed', () => {
    renderToolbar();
    addValue('13');
    expect(
      screen.getByRole('button', { name: 'Remove target ≥ 13' }),
    ).toBeInTheDocument();
    expect(getInput().value).toBe('');
  });

  it('rejects a duplicate value silently', () => {
    renderToolbar();
    addValue('13');
    addValue('13');
    expect(
      screen.getAllByRole('button', { name: 'Remove target ≥ 13' }),
    ).toHaveLength(1);
  });

  it('removes a chip when its X button is clicked', () => {
    renderToolbar();
    addValue('13');
    addValue('16');
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove target ≥ 13' }),
    );
    expect(
      screen.queryByRole('button', { name: 'Remove target ≥ 13' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Remove target ≥ 16' }),
    ).toBeInTheDocument();
  });

  it('disables the input once five targets are present', () => {
    renderToolbar();
    addValue('10');
    addValue('11');
    addValue('12');
    addValue('13');
    addValue('14');
    expect(getInput().disabled).toBe(true);
  });

  it('removes the last chip when Backspace is pressed on an empty input', () => {
    renderToolbar();
    addValue('13');
    addValue('16');
    fireEvent.keyDown(getInput(), { key: 'Backspace' });
    expect(
      screen.queryByRole('button', { name: 'Remove target ≥ 16' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Remove target ≥ 13' }),
    ).toBeInTheDocument();
  });

  it('reflects the current ruling symbol on every chip', () => {
    renderToolbar();
    addValue('13');
    addValue('16');
    fireEvent.change(screen.getByLabelText('Target ruling'), {
      target: { value: 'lt' },
    });
    expect(
      screen.getByRole('button', { name: 'Remove target < 13' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove target < 16' }),
    ).toBeInTheDocument();
  });

  it('does not add a chip for non-numeric input', () => {
    renderToolbar();
    const input = getInput();
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(
      screen.queryByRole('button', { name: /^Remove target/ }),
    ).toBeNull();
    expect(input.value).toBe('');
  });

  it('keeps chips sorted ascending regardless of insertion order', () => {
    renderToolbar();
    addValue('19');
    addValue('13');
    addValue('16');
    const removeButtons = screen
      .getAllByRole('button', { name: /^Remove target ≥/ })
      .map((b) => b.getAttribute('aria-label'));
    expect(removeButtons).toEqual([
      'Remove target ≥ 13',
      'Remove target ≥ 16',
      'Remove target ≥ 19',
    ]);
  });
});

type SeedRowKind = 'pool' | 'sum';

interface PoolSeedOptions {
  targetValues?: number[];
  poolTarget?: number;
  /** Seeds the list instead of the legacy scalar the other cases migrate. */
  poolTargets?: number[];
  rows?: readonly SeedRowKind[];
}

function seedExpression(kind: SeedRowKind) {
  if (kind === 'pool') {
    return {
      id: 'pool1',
      name: 'Pool row',
      parts: [{ id: 'pp1', count: 2, sides: 6 }],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 4 },
    };
  }
  return {
    id: 'sum1',
    name: 'Sum row',
    parts: [{ id: 'sp1', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
}

function seedPoolRow({
  targetValues = [],
  poolTarget = 1,
  poolTargets,
  rows = ['pool'],
}: PoolSeedOptions = {}) {
  const state = {
    version: 3,
    expressions: rows.map(seedExpression),
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: targetValues, ruling: 'gte' },
      view: 'table',
      ...(poolTargets === undefined ? { poolTarget } : { poolTargets }),
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

function queryPoolInput(): HTMLInputElement | null {
  return screen.queryByLabelText('Add pool target') as HTMLInputElement | null;
}

function getPoolInput(): HTMLInputElement {
  return screen.getByLabelText('Add pool target') as HTMLInputElement;
}

function addPoolValue(raw: string) {
  const input = getPoolInput();
  fireEvent.change(input, { target: { value: raw } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

function poolChipLabels(): string[] {
  return screen
    .queryAllByRole('button', { name: /^Remove pool target/ })
    .map((b) => b.getAttribute('aria-label') ?? '');
}

// Matches whichever guidance sentence the toolbar is currently showing, so a
// test can read the hint back without naming the one it expects.
const HINT_PATTERN =
  /^(Add a target to show Hit % per row\.|Add a target to show Hit % for sum rows\.|Pool rows use the pool target below\.|Add another target or clear to hide Hit %\.|Up to \d+ targets\. Remove one to add another\.)$/;

function hintText(): string {
  return screen.getByText(HINT_PATTERN).textContent ?? '';
}

describe('TargetToolbar pool target row', () => {
  it('does not render when a target is set but no pool row exists', () => {
    renderToolbar();
    addValue('13');
    expect(queryPoolInput()).toBeNull();
  });

  it('renders on a pool row with no numeric target, the only target it uses', () => {
    seedPoolRow();
    renderToolbar();
    expect(queryPoolInput()).not.toBeNull();
  });

  it('stays put as numeric targets are added and removed around it', () => {
    seedPoolRow();
    renderToolbar();
    addValue('13');
    expect(getPoolInput()).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove target ≥ 13' }),
    );
    expect(getPoolInput()).toBeInTheDocument();
  });

  it('shows the persisted pool target as a chip', () => {
    seedPoolRow({ targetValues: [10], poolTarget: 4 });
    renderToolbar();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('hydrates a persisted list into one chip per pool target', () => {
    seedPoolRow({ targetValues: [10], poolTargets: [1, 3] });
    renderToolbar();
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 1',
      'Remove pool target ≥ 3',
    ]);
  });

  it('adds a pool target chip on Enter and clears the draft', () => {
    seedPoolRow({ targetValues: [10], poolTarget: 2 });
    renderToolbar();
    addPoolValue('6');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 2',
      'Remove pool target ≥ 6',
    ]);
    expect(getPoolInput().value).toBe('');
  });

  it('sorts an added pool target into the list', () => {
    seedPoolRow({ targetValues: [10], poolTarget: 4 });
    renderToolbar();
    addPoolValue('2');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 2',
      'Remove pool target ≥ 4',
    ]);
  });

  it('rejects a duplicate pool target silently', () => {
    seedPoolRow({ targetValues: [10], poolTarget: 2 });
    renderToolbar();
    addPoolValue('2');
    expect(poolChipLabels()).toHaveLength(0);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('clamps a pool target below one up to one', () => {
    seedPoolRow({ targetValues: [10], poolTarget: 3 });
    renderToolbar();
    addPoolValue('0');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 1',
      'Remove pool target ≥ 3',
    ]);
  });

  it('ignores a draft that is not a number', () => {
    seedPoolRow({ targetValues: [10], poolTarget: 3 });
    renderToolbar();
    addPoolValue('abc');
    expect(poolChipLabels()).toHaveLength(0);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(getPoolInput().value).toBe('');
  });

  it('clears an uncommitted pool draft on Escape', () => {
    seedPoolRow({ targetValues: [10], poolTarget: 4 });
    renderToolbar();
    const input = getPoolInput();
    fireEvent.change(input, { target: { value: '9' } });
    expect(input.value).toBe('9');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
    expect(poolChipLabels()).toHaveLength(0);
  });

  it('takes the last chip back on Backspace with an empty draft', () => {
    seedPoolRow({ targetValues: [10], poolTargets: [1, 3] });
    renderToolbar();
    fireEvent.keyDown(getPoolInput(), { key: 'Backspace' });
    expect(poolChipLabels()).toHaveLength(0);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('gives the last remaining pool target no remove control', () => {
    seedPoolRow({ targetValues: [10], poolTarget: 2 });
    renderToolbar();
    expect(poolChipLabels()).toHaveLength(0);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('keeps the last pool target through Backspace', () => {
    seedPoolRow({ targetValues: [10], poolTarget: 2 });
    renderToolbar();
    fireEvent.keyDown(getPoolInput(), { key: 'Backspace' });
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('disables the pool input at the cap', () => {
    seedPoolRow({ targetValues: [10], poolTargets: [1, 2, 3, 4, 5] });
    renderToolbar();
    expect(getPoolInput().disabled).toBe(true);
    expect(
      screen.getByText('Up to 5 pool targets. Remove one to add another.'),
    ).toBeInTheDocument();
  });

  it('adds a pool target when no numeric target is set', () => {
    seedPoolRow({ poolTarget: 1 });
    renderToolbar();
    addPoolValue('2');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 1',
      'Remove pool target ≥ 2',
    ]);
  });

  it('asks for a target for the sum rows when a table holds both kinds', () => {
    seedPoolRow({ rows: ['pool', 'sum'] });
    renderToolbar();
    expect(
      screen.getByText('Add a target to show Hit % for sum rows.'),
    ).toBeInTheDocument();
  });

  it('asks a sum-only table for a target but a pool-only table for neither', () => {
    seedPoolRow({ rows: ['sum'] });
    const sumOnly = renderToolbar();
    const sumHint = hintText();
    sumOnly.unmount();
    window.localStorage.clear();

    seedPoolRow({ rows: ['pool'] });
    renderToolbar();
    const poolHint = hintText();

    expect(sumHint).toBe('Add a target to show Hit % per row.');
    expect(poolHint).toBe('Pool rows use the pool target below.');
    expect(sumHint).not.toBe(poolHint);
  });

  it('points a pool-only table at the pool target instead of a numeric one', () => {
    seedPoolRow({ rows: ['pool'] });
    renderToolbar();
    expect(
      screen.getByText('Pool rows use the pool target below.'),
    ).toBeInTheDocument();
  });

  it('swaps the pool wording out and back as the last numeric target comes and goes', () => {
    seedPoolRow({ rows: ['pool'] });
    renderToolbar();
    addValue('4');
    expect(
      screen.getByText('Add another target or clear to hide Hit %.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Pool rows use the pool target below.'),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove target ≥ 4' }));
    expect(
      screen.getByText('Pool rows use the pool target below.'),
    ).toBeInTheDocument();
  });
});

describe('TargetToolbar draft clamping', () => {
  it('commits a negative pool draft as the floor the row keeps', () => {
    seedPoolRow({ poolTargets: [3] });
    renderToolbar();
    addPoolValue('-4');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 1',
      'Remove pool target ≥ 3',
    ]);
  });

  it('leaves the list alone when a pool draft below the floor is already in it', () => {
    seedPoolRow({ poolTargets: [1, 3] });
    renderToolbar();
    addPoolValue('0');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 1',
      'Remove pool target ≥ 3',
    ]);
    expect(getPoolInput().value).toBe('');
  });

  it('keeps a negative numeric target, which a modifier can reach', () => {
    renderToolbar();
    addValue('-3');
    expect(
      screen.getByRole('button', { name: 'Remove target ≥ -3' }),
    ).toBeInTheDocument();
  });
});
