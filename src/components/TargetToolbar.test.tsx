import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../state/AppContext';
import { openParams, paramsPanel } from '../test/params';
import { TargetToolbar } from './TargetToolbar';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

async function renderToolbar() {
  const result = render(
    <Providers>
      <TargetToolbar />
    </Providers>,
  );
  // Both editors open for the run of the test. Opening is a no-op for a group
  // that is not on screen, so a pool-less table still renders pool-less.
  await openParams('Edit targets');
  await openParams('Edit pool targets');
  return result;
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
  it('starts with no target chips', async () => {
    await renderToolbar();
    expect(
      screen.queryByRole('button', { name: /^Remove target/i }),
    ).toBeNull();
  });

  it('adds a target chip when a number is entered and Enter is pressed', async () => {
    await renderToolbar();
    addValue('13');
    expect(
      screen.getByRole('button', { name: 'Remove target ≥ 13' }),
    ).toBeInTheDocument();
    expect(getInput().value).toBe('');
  });

  it('rejects a duplicate value silently', async () => {
    await renderToolbar();
    addValue('13');
    addValue('13');
    expect(
      screen.getAllByRole('button', { name: 'Remove target ≥ 13' }),
    ).toHaveLength(1);
  });

  it('removes a chip when its X button is clicked', async () => {
    await renderToolbar();
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

  it('disables the input once five targets are present', async () => {
    await renderToolbar();
    addValue('10');
    addValue('11');
    addValue('12');
    addValue('13');
    addValue('14');
    expect(getInput().disabled).toBe(true);
  });

  it('removes the last chip when Backspace is pressed on an empty input', async () => {
    await renderToolbar();
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

  it('reflects the current ruling symbol on every chip', async () => {
    await renderToolbar();
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

  it('does not add a chip for non-numeric input', async () => {
    await renderToolbar();
    const input = getInput();
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(
      screen.queryByRole('button', { name: /^Remove target/ }),
    ).toBeNull();
    expect(input.value).toBe('');
  });

  it('keeps chips sorted ascending regardless of insertion order', async () => {
    await renderToolbar();
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

function poolPanel() {
  return paramsPanel('Pool targets');
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

// The guidance rides the control it describes rather than sitting inline, so
// it is read off the input instead of out of the document body.
function hintText(): string {
  return getInput().getAttribute('title') ?? '';
}

function poolHintText(): string {
  return getPoolInput().getAttribute('title') ?? '';
}

describe('TargetToolbar pool target row', () => {
  it('does not render when a target is set but no pool row exists', async () => {
    await renderToolbar();
    addValue('13');
    expect(queryPoolInput()).toBeNull();
  });

  it('renders on a pool row with no numeric target, the only target it uses', async () => {
    seedPoolRow();
    await renderToolbar();
    expect(queryPoolInput()).not.toBeNull();
  });

  it('stays put as numeric targets are added and removed around it', async () => {
    seedPoolRow();
    await renderToolbar();
    addValue('13');
    expect(getPoolInput()).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove target ≥ 13' }),
    );
    expect(getPoolInput()).toBeInTheDocument();
  });

  it('shows the persisted pool target as a chip', async () => {
    seedPoolRow({ targetValues: [10], poolTarget: 4 });
    await renderToolbar();
    expect(poolPanel().getByText('4')).toBeInTheDocument();
  });

  it('hydrates a persisted list into one chip per pool target', async () => {
    seedPoolRow({ targetValues: [10], poolTargets: [1, 3] });
    await renderToolbar();
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 1',
      'Remove pool target ≥ 3',
    ]);
  });

  it('adds a pool target chip on Enter and clears the draft', async () => {
    seedPoolRow({ targetValues: [10], poolTarget: 2 });
    await renderToolbar();
    addPoolValue('6');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 2',
      'Remove pool target ≥ 6',
    ]);
    expect(getPoolInput().value).toBe('');
  });

  it('sorts an added pool target into the list', async () => {
    seedPoolRow({ targetValues: [10], poolTarget: 4 });
    await renderToolbar();
    addPoolValue('2');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 2',
      'Remove pool target ≥ 4',
    ]);
  });

  it('rejects a duplicate pool target silently', async () => {
    seedPoolRow({ targetValues: [10], poolTarget: 2 });
    await renderToolbar();
    addPoolValue('2');
    expect(poolChipLabels()).toHaveLength(0);
    expect(poolPanel().getByText('2')).toBeInTheDocument();
  });

  it('clamps a pool target below one up to one', async () => {
    seedPoolRow({ targetValues: [10], poolTarget: 3 });
    await renderToolbar();
    addPoolValue('0');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 1',
      'Remove pool target ≥ 3',
    ]);
  });

  it('ignores a draft that is not a number', async () => {
    seedPoolRow({ targetValues: [10], poolTarget: 3 });
    await renderToolbar();
    addPoolValue('abc');
    expect(poolChipLabels()).toHaveLength(0);
    expect(poolPanel().getByText('3')).toBeInTheDocument();
    expect(getPoolInput().value).toBe('');
  });

  it('clears an uncommitted pool draft on Escape', async () => {
    seedPoolRow({ targetValues: [10], poolTarget: 4 });
    await renderToolbar();
    const input = getPoolInput();
    fireEvent.change(input, { target: { value: '9' } });
    expect(input.value).toBe('9');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
    expect(poolChipLabels()).toHaveLength(0);
  });

  it('takes the last chip back on Backspace with an empty draft', async () => {
    seedPoolRow({ targetValues: [10], poolTargets: [1, 3] });
    await renderToolbar();
    fireEvent.keyDown(getPoolInput(), { key: 'Backspace' });
    expect(poolChipLabels()).toHaveLength(0);
    expect(poolPanel().getByText('1')).toBeInTheDocument();
  });

  it('gives the last remaining pool target no remove control', async () => {
    seedPoolRow({ targetValues: [10], poolTarget: 2 });
    await renderToolbar();
    expect(poolChipLabels()).toHaveLength(0);
    expect(poolPanel().getByText('2')).toBeInTheDocument();
  });

  it('keeps the last pool target through Backspace', async () => {
    seedPoolRow({ targetValues: [10], poolTarget: 2 });
    await renderToolbar();
    fireEvent.keyDown(getPoolInput(), { key: 'Backspace' });
    expect(poolPanel().getByText('2')).toBeInTheDocument();
  });

  it('disables the pool input at the cap', async () => {
    seedPoolRow({ targetValues: [10], poolTargets: [1, 2, 3, 4, 5] });
    await renderToolbar();
    expect(getPoolInput().disabled).toBe(true);
    expect(poolHintText()).toBe(
      'Up to 5 pool targets. Remove one to add another.',
    );
  });

  it('adds a pool target when no numeric target is set', async () => {
    seedPoolRow({ poolTarget: 1 });
    await renderToolbar();
    addPoolValue('2');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 1',
      'Remove pool target ≥ 2',
    ]);
  });

  it('asks for a target for the sum rows when a table holds both kinds', async () => {
    seedPoolRow({ rows: ['pool', 'sum'] });
    await renderToolbar();
    expect(hintText()).toBe('Add a target to show Hit % for sum rows.');
  });

  it('asks a sum-only table for a target but a pool-only table for neither', async () => {
    seedPoolRow({ rows: ['sum'] });
    const sumOnly = await renderToolbar();
    const sumHint = hintText();
    sumOnly.unmount();
    window.localStorage.clear();

    seedPoolRow({ rows: ['pool'] });
    await renderToolbar();
    const poolHint = hintText();

    expect(sumHint).toBe('Add a target to show Hit % per row.');
    expect(poolHint).toBe('Pool rows use the pool target below.');
    expect(sumHint).not.toBe(poolHint);
  });

  it('points a pool-only table at the pool target instead of a numeric one', async () => {
    seedPoolRow({ rows: ['pool'] });
    await renderToolbar();
    expect(hintText()).toBe('Pool rows use the pool target below.');
  });

  it('swaps the pool wording out and back as the last numeric target comes and goes', async () => {
    seedPoolRow({ rows: ['pool'] });
    await renderToolbar();
    addValue('4');
    expect(hintText()).toBe('Add another target or clear to hide Hit %.');
    expect(hintText()).not.toBe('Pool rows use the pool target below.');
    fireEvent.click(screen.getByRole('button', { name: 'Remove target ≥ 4' }));
    expect(hintText()).toBe('Pool rows use the pool target below.');
  });
});

describe('TargetToolbar draft clamping', () => {
  it('commits a negative pool draft as the floor the row keeps', async () => {
    seedPoolRow({ poolTargets: [3] });
    await renderToolbar();
    addPoolValue('-4');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 1',
      'Remove pool target ≥ 3',
    ]);
  });

  it('leaves the list alone when a pool draft below the floor is already in it', async () => {
    seedPoolRow({ poolTargets: [1, 3] });
    await renderToolbar();
    addPoolValue('0');
    expect(poolChipLabels()).toEqual([
      'Remove pool target ≥ 1',
      'Remove pool target ≥ 3',
    ]);
    expect(getPoolInput().value).toBe('');
  });

  it('keeps a negative numeric target, which a modifier can reach', async () => {
    await renderToolbar();
    addValue('-3');
    expect(
      screen.getByRole('button', { name: 'Remove target ≥ -3' }),
    ).toBeInTheDocument();
  });
});
