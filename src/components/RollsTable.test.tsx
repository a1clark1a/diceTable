import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import type { DicePart } from '../types';
import type { PartPatch } from '../state/useApp';

// Render-isolation invariant: a Count commit inside the one expanded row
// must NOT re-render any sibling RollTableRow. memo(RollTableRow) is
// module-internal, so the faithful instrument is ExpressionDiceText, which
// every collapsed row renders unconditionally with its own `expr`. If a
// sibling row's memo bails, its ExpressionDiceText is never re-invoked and
// its counter stays flat; if the bail fails for a reason a static trace
// could not see (Chakra Table context, etc.), this test catches it.
const { rowRenderCounts } = vi.hoisted(() => ({
  rowRenderCounts: {} as Record<string, number>,
}));

vi.mock('./chart/Sparkline', () => ({
  RowSparkline: () => null,
  ShapeHeaderLabel: () => null,
}));

vi.mock('./editor/ExpressionRender', async (importActual) => {
  const actual =
    await importActual<typeof import('./editor/ExpressionRender')>();
  return {
    ...actual,
    ExpressionDiceText: ({ expr }: { expr: { id: string } }) => {
      rowRenderCounts[expr.id] = (rowRenderCounts[expr.id] ?? 0) + 1;
      return <span data-testid={`dice-${expr.id}`} />;
    },
  };
});

vi.mock('./editor/DicePartRow', () => ({
  DicePartRow: ({
    part,
    onChange,
  }: {
    part: DicePart;
    onChange: (patch: PartPatch) => void;
    onRemove: () => void;
    canRemove: boolean;
  }) => (
    <input
      data-testid={`dpr-${part.id}`}
      value={String(part.count)}
      onChange={(e) => onChange({ count: Number(e.target.value) })}
    />
  ),
}));

const { AppProvider } = await import('../state/AppContext');
const { RollHistoryProvider } = await import('../state/RollHistoryContext');
const { RollsTable } = await import('./RollsTable');
const { TargetToolbar } = await import('./TargetToolbar');

const SEED_EXPR_ID = 'seed-4d6kh3';
const SEED_PART_ID = 'seed-4d6kh3-part';

// The toolbar renders alongside the table (TablePage hoists it to the page
// level), and the pool Hit % tests drive the pool-target input it owns.
function renderTable() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <RollHistoryProvider>
          <TargetToolbar />
          <RollsTable />
        </RollHistoryProvider>
      </AppProvider>
    </ChakraProvider>,
  );
}

function resetCounts() {
  for (const k of Object.keys(rowRenderCounts)) delete rowRenderCounts[k];
}

function siblingIds(): string[] {
  return Object.keys(rowRenderCounts).filter((id) => id !== SEED_EXPR_ID);
}

afterEach(() => {
  resetCounts();
  window.localStorage.clear();
});

describe('RollsTable sibling-row isolation (Phase 2 gate / Phase 3 trigger)', () => {
  it('a Count commit in the expanded row re-renders zero sibling RollTableRows', () => {
    renderTable();

    // Seed gives one row; add three more so there are real siblings to sample.
    // The plan's 100-row / rows-2,50,99 sampling exists only for the optional
    // wall-clock check; the memo bail is per-row identical, so three siblings
    // are a sufficient, faithful stand-in for the agent-run gate.
    const addRoll = screen.getByRole('button', { name: 'Add roll' });
    fireEvent.click(addRoll);
    fireEvent.click(addRoll);
    fireEvent.click(addRoll);

    const allIds = Object.keys(rowRenderCounts);
    expect(allIds).toContain(SEED_EXPR_ID);
    expect(siblingIds().length).toBe(3);

    // Expand the seed row (row 1) so its dice editor mounts.
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Expand row' })[0]!,
    );

    resetCounts();

    // Commit a Count edit on the seed row's part, through the real
    // updatePart context path (the stub calls the stabilized onChange).
    const partInput = screen.getByTestId(
      `dpr-${SEED_PART_ID}`,
    ) as HTMLInputElement;
    fireEvent.change(partInput, { target: { value: '7' } });

    // The edited row re-rendered and reflects the committed value...
    expect(rowRenderCounts[SEED_EXPR_ID] ?? 0).toBeGreaterThanOrEqual(1);
    expect(
      (screen.getByTestId(`dpr-${SEED_PART_ID}`) as HTMLInputElement).value,
    ).toBe('7');

    // ...and every sibling RollTableRow's memo bailed: zero re-renders.
    for (const id of siblingIds()) {
      expect(rowRenderCounts[id] ?? 0).toBe(0);
    }
  });

  it('a Mod commit on one row re-renders zero sibling RollTableRows (regression guard)', () => {
    renderTable();
    const addRoll = screen.getByRole('button', { name: 'Add roll' });
    fireEvent.click(addRoll);
    fireEvent.click(addRoll);

    // addExpression auto-expands each new row, so the last-added sibling mounts
    // its editor. This test's premise is a Mod commit with NO editor mounted
    // (the structurally identical commit Phase 1 said already bails). Collapse
    // the auto-expanded row to restore that premise: an expanded editor is a
    // useApp consumer and re-renders on every commit, and its formula-header
    // ExpressionDiceText would otherwise be counted by this row-render proxy.
    fireEvent.click(screen.getByRole('button', { name: 'Collapse row' }));

    resetCounts();

    // The Mod field never mounts the editor; it is the structurally identical
    // commit Phase 1 said already bails. Pin that it still does post-fix.
    const mod = screen.getAllByRole('textbox', { name: 'Modifier' })[0]!;
    fireEvent.change(mod, { target: { value: '3' } });
    fireEvent.blur(mod);

    expect(rowRenderCounts[SEED_EXPR_ID] ?? 0).toBeGreaterThanOrEqual(1);
    for (const id of siblingIds()) {
      expect(rowRenderCounts[id] ?? 0).toBe(0);
    }
  });
});

interface PoolSeedOptions {
  ruling?: 'gte' | 'lte';
  targetValues?: number[];
  poolTarget?: number;
}

// One sum row (2d6) and one pool row (2d6, success on 4+, so per-die p = 0.5).
// Hand-computed expectations: pool P(>=2 successes) = 0.25, P(>=1) = 0.75;
// sum P(2d6 >= 10) = 6/36 = 16.7%, P(2d6 <= 10) = 33/36 = 91.7%.
function seedMixedTable({
  ruling = 'gte',
  targetValues = [10],
  poolTarget = 2,
}: PoolSeedOptions = {}) {
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
      target: { values: targetValues, ruling },
      view: 'table',
      poolTarget,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

describe('RollsTable pool Hit %', () => {
  it('shows the pool row Hit % against the pool target with an at-least label', () => {
    seedMixedTable();
    renderTable();
    expect(screen.getByLabelText('At least 2 successes')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('shows the sum row Hit % against the toolbar target in the same table', () => {
    seedMixedTable();
    renderTable();
    expect(screen.getByText('16.7%')).toBeInTheDocument();
  });

  it('ignores the numeric target ruling on pool rows while sum rows follow it', () => {
    seedMixedTable({ ruling: 'lte' });
    renderTable();
    expect(screen.getByText('91.7%')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('committing a new pool target with Enter updates the pool Hit % live', () => {
    seedMixedTable();
    renderTable();
    const input = screen.getByLabelText('Pool target, minimum successes');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getByLabelText('At least 1 successes')).toBeInTheDocument();
  });

  it('renders no pool Hit % when no targets are set', () => {
    seedMixedTable({ targetValues: [] });
    renderTable();
    expect(screen.queryByText('25.0%')).toBeNull();
    expect(screen.queryByLabelText('At least 2 successes')).toBeNull();
  });
});

// Two sum rows with hand-computed stats: 2d6 → mean 7.00, σ 2.42;
// 1d6+5 → mean 8.50, σ 1.71. Deltas vs the 2d6 baseline: avg +1.50,
// spread −0.71; hit vs target 10 (gte): 33.3% − 16.7% → +16.7%.
function seedTwoSumRows(targetValues: number[] = [10]) {
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

describe('RollsTable baseline pin round trip', () => {
  it('pinning switches the sibling to deltas and unpinning restores absolutes', () => {
    seedTwoSumRows();
    renderTable();

    expect(screen.getByText('8.50')).toBeInTheDocument();
    expect(screen.queryByText('Baseline')).toBeNull();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );

    // The baseline row wears the badge and keeps its absolute stats.
    expect(screen.getByText('Baseline')).toBeInTheDocument();
    expect(screen.getByText('7.00')).toBeInTheDocument();
    expect(screen.getByText('16.7%')).toBeInTheDocument();

    // The sibling swaps to labeled delta lines and a signed hit delta.
    expect(screen.getByText('avg')).toBeInTheDocument();
    expect(screen.getByText('spread')).toBeInTheDocument();
    expect(screen.getByText('+1.50')).toBeInTheDocument();
    expect(screen.getByText('−0.71')).toBeInTheDocument();
    expect(screen.getByText('+16.7%')).toBeInTheDocument();
    expect(screen.queryByText('8.50')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear baseline' }));

    expect(screen.queryByText('Baseline')).toBeNull();
    expect(screen.queryByText('avg')).toBeNull();
    expect(screen.queryByText('+1.50')).toBeNull();
    expect(screen.getByText('8.50')).toBeInTheDocument();
  });

  it('labels each delta for screen readers', () => {
    seedTwoSumRows();
    renderTable();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );

    expect(
      screen.getByLabelText('1.50 higher than baseline'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('0.71 less spread than baseline'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('hits 16.7 points more often than baseline'),
    ).toBeInTheDocument();
  });

  it('writes a verdict line under the sibling name', () => {
    seedTwoSumRows();
    renderTable();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );

    expect(
      screen.getByText('Averages 1.5 higher · steadier · hits 17% more often'),
    ).toBeInTheDocument();
  });

  it('pinning a second row moves the baseline instead of adding one', () => {
    seedTwoSumRows();
    renderTable();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pin as baseline' }));

    expect(screen.getAllByText('Baseline')).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'Clear baseline' }),
    ).toHaveLength(1);
    // The first row is now the comparing side: 7.00 − 8.50 → −1.50.
    expect(screen.getByText('−1.50')).toBeInTheDocument();
    expect(screen.getByText('8.50')).toBeInTheDocument();
  });

  it('renders delta lines without a Hit % column when no targets are set', () => {
    seedTwoSumRows([]);
    renderTable();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );

    expect(screen.getByText('+1.50')).toBeInTheDocument();
    expect(screen.queryByText('+16.7%')).toBeNull();
    expect(
      screen.getByText('Averages 1.5 higher · steadier'),
    ).toBeInTheDocument();
  });
});

