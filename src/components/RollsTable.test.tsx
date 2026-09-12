import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import type { ChartView, DicePart } from '../types';
import type { PartPatch } from '../state/useApp';
import { openParams } from '../test/params';

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

// The sparkline is stubbed so row assertions never depend on SVG geometry,
// but the stub still echoes the `view` it was handed: each row resolves that
// view from its own target, and a stub returning null hides the result.
vi.mock('./chart/Sparkline', () => ({
  RowSparkline: ({ view }: { view: ChartView }) => (
    <span>{`shape view ${view}`}</span>
  ),
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

// A fresh mount now starts with zero rolls, so the isolation tests hydrate the
// one addressable row they need (the 4d6kh3 shape the app used to seed).
function seedIsolationRow() {
  const state = {
    version: 3,
    expressions: [
      {
        id: SEED_EXPR_ID,
        name: '4d6kh3 + 2 (adv)',
        parts: [
          {
            id: SEED_PART_ID,
            count: 4,
            sides: 6,
            keep: { type: 'highest', n: 3 },
          },
        ],
        flatModifier: 2,
        rollMode: 'advantage',
        mode: 'sum',
      },
    ],
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [], ruling: 'gte' },
      view: 'table',
      poolTarget: 1,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

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

describe('RollsTable column headers', () => {
  // The mode chips sit in a fixed slot beside the dice notation rather than
  // in a column of their own, so this label is the only thing naming them.
  it('names the mode chips as their own column beside Dice', async () => {
    seedIsolationRow();
    renderTable();
    const header = screen
      .getAllByRole('columnheader')
      .find((h) => (h.textContent ?? '').includes('Dice'));
    expect(header).toBeDefined();
    expect(within(header!).getByText('Style')).toBeInTheDocument();
  });
});

describe('RollsTable sibling-row isolation (Phase 2 gate / Phase 3 trigger)', () => {
  it('a Count commit in the expanded row re-renders zero sibling RollTableRows', async () => {
    seedIsolationRow();
    renderTable();

    // The seeded row plus three more so there are real siblings to sample.
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

  it('a Mod commit on one row re-renders zero sibling RollTableRows (regression guard)', async () => {
    seedIsolationRow();
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
  /** Seeds the list instead of the legacy scalar the other cases migrate. */
  poolTargets?: number[];
  /** Drops the sum row so the table holds nothing but the pool roll. */
  poolOnly?: boolean;
  /** Seeded chart view; each row resolves its own sparkline view from it. */
  chartView?: 'pmf' | 'target';
}

// One sum row (2d6) and one pool row (2d6, success on 4+, so per-die p = 0.5).
// Hand-computed expectations: pool P(>=2 successes) = 0.25, P(>=1) = 0.75;
// sum P(2d6 >= 10) = 6/36 = 16.7%, P(2d6 <= 10) = 33/36 = 91.7%.
function seedMixedTable({
  ruling = 'gte',
  targetValues = [10],
  poolTarget = 2,
  poolTargets,
  poolOnly = false,
  chartView = 'pmf',
}: PoolSeedOptions = {}) {
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
    expressions: poolOnly ? [poolRow] : [sumRow, poolRow],
    ui: {
      expandedId: null,
      chartView,
      target: { values: targetValues, ruling },
      view: 'table',
      ...(poolTargets === undefined ? { poolTarget } : { poolTargets }),
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

// The body row that owns a named roll, found through its name field so the
// lookup never depends on row order.
function rowFor(rollName: string): HTMLElement {
  const row = screen
    .getAllByRole('row')
    .find((r) => within(r).queryByDisplayValue(rollName) !== null);
  if (row === undefined) throw new Error(`no row named ${rollName}`);
  return row;
}

function hitColumnHeader(): HTMLElement {
  const header = screen
    .getAllByRole('columnheader')
    .find((h) => (h.textContent ?? '').includes('Hit %'));
  if (header === undefined) throw new Error('no Hit % column header');
  return header;
}

// The cell sitting under the Hit % header, located by that header's position
// rather than by a hard-coded column index.
function hitCellIn(row: HTMLElement): HTMLElement {
  const columnIndex = screen
    .getAllByRole('columnheader')
    .findIndex((h) => (h.textContent ?? '').includes('Hit %'));
  const cell = within(row).getAllByRole('cell')[columnIndex];
  if (cell === undefined) throw new Error('no Hit % cell in row');
  return cell;
}

// Leaf filter: the glyph text node lives in exactly one childless span, so a
// wrapper that merely contains it is never counted as a second symbol.
function rulingGlyphsIn(el: HTMLElement): HTMLElement[] {
  return within(el)
    .queryAllByText('≥')
    .filter((node) => node.children.length === 0);
}

describe('RollsTable pool Hit %', () => {
  it('shows the pool row Hit % against the pool target with an at-least label', async () => {
    seedMixedTable();
    renderTable();
    expect(screen.getByLabelText('At least 2 successes')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('shows the sum row Hit % against the toolbar target in the same table', async () => {
    seedMixedTable();
    renderTable();
    expect(screen.getByText('16.7%')).toBeInTheDocument();
  });

  it('ignores the numeric target ruling on pool rows while sum rows follow it', async () => {
    seedMixedTable({ ruling: 'lte' });
    renderTable();
    expect(screen.getByText('91.7%')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('adding a pool target with Enter stacks a second pool Hit % live', async () => {
    seedMixedTable();
    renderTable();
    await openParams('Edit pool targets');
    const input = screen.getByLabelText('Add pool target');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByLabelText('At least 1 successes')).toBeInTheDocument();
    expect(screen.getByLabelText('At least 2 successes')).toBeInTheDocument();
  });

  it('removing a pool target chip takes its Hit % row off the pool row', async () => {
    seedMixedTable({ poolTargets: [1, 2] });
    renderTable();
    expect(screen.getByLabelText('At least 1 successes')).toBeInTheDocument();

    await openParams('Edit pool targets');
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove pool target ≥ 1' }),
    );
    expect(screen.queryByLabelText('At least 1 successes')).toBeNull();
    expect(screen.getByLabelText('At least 2 successes')).toBeInTheDocument();
  });

  it('keeps the pool Hit % when no numeric target is set', async () => {
    seedMixedTable({ targetValues: [] });
    renderTable();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByLabelText('At least 2 successes')).toBeInTheDocument();
  });

  it('keeps the Hit % column on a table of only pool rows with no numeric target', async () => {
    seedMixedTable({ targetValues: [], poolOnly: true });
    renderTable();
    expect(screen.getByText('Hit %')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('dashes the sum row Hit % cell while the pool row keeps its percentage', async () => {
    seedMixedTable({ targetValues: [] });
    renderTable();
    // EM_DASH, U+2014; the Range cell's 2–12 uses an en dash instead.
    expect(hitCellIn(rowFor('Sum row')).textContent).toBe('—');
    expect(hitCellIn(rowFor('Pool row')).textContent).toContain('25.0%');
  });

  it('shows the Hit % ruling glyph only once a numeric target exists', async () => {
    seedMixedTable({ targetValues: [] });
    renderTable();

    // The pool row keeps the column open, but the ruling describes sum rows
    // against numeric targets, and there are none yet.
    expect(rulingGlyphsIn(hitColumnHeader())).toHaveLength(0);

    await openParams('Edit targets');
    const input = screen.getByLabelText('Add target value');
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(rulingGlyphsIn(hitColumnHeader())).toHaveLength(1);
  });

  it('opens the Hit % column when a sum row is switched to pool with no numeric target', async () => {
    seedTwoSumRows([]);
    renderTable();
    expect(screen.queryByText('Hit %')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Pool' })[0]!);

    expect(screen.getByText('Hit %')).toBeInTheDocument();
  });
});

describe('RollsTable per-row chart view', () => {
  it('keeps a pool row in target view while a sum row falls back to PMF with no numeric target', async () => {
    seedMixedTable({ targetValues: [], chartView: 'target' });
    renderTable();

    // The pool row measures the shared pool target, so target view still has
    // something to highlight; the sum row has nothing and drops to PMF.
    expect(
      within(rowFor('Pool row')).getByText('shape view target'),
    ).toBeInTheDocument();
    expect(
      within(rowFor('Sum row')).getByText('shape view pmf'),
    ).toBeInTheDocument();
  });

  it('keeps the pool row in target view when the last numeric target is removed', async () => {
    seedMixedTable({ chartView: 'target' });
    renderTable();

    // Both rows start in target view: the sum row measures the numeric 10,
    // the pool row the shared pool target.
    expect(
      within(rowFor('Sum row')).getByText('shape view target'),
    ).toBeInTheDocument();

    await openParams('Edit targets');
    fireEvent.click(screen.getByRole('button', { name: /^Remove target/ }));

    // Only the sum row loses what it was measuring.
    expect(
      within(rowFor('Sum row')).getByText('shape view pmf'),
    ).toBeInTheDocument();
    expect(
      within(rowFor('Pool row')).getByText('shape view target'),
    ).toBeInTheDocument();
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
  it('pinning switches the sibling to deltas and unpinning restores absolutes', async () => {
    seedTwoSumRows();
    renderTable();

    expect(screen.getByText('8.50')).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Clear baseline' })).toHaveLength(0);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );

    // The baseline row is marked by its pin and keeps its absolute stats.
    expect(screen.getAllByRole('button', { name: 'Clear baseline' })).toHaveLength(1);
    expect(screen.getByText('7.00')).toBeInTheDocument();
    expect(screen.getByText('16.7%')).toBeInTheDocument();

    // The sibling swaps to deltas under the header's Avg / Spread slots.
    expect(screen.getByText('Avg')).toBeInTheDocument();
    expect(screen.getByText('Spread')).toBeInTheDocument();
    expect(screen.getByText('+1.50')).toBeInTheDocument();
    expect(screen.getByText('−0.71')).toBeInTheDocument();
    expect(screen.getByText('+16.7%')).toBeInTheDocument();
    expect(screen.queryByText('8.50')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear baseline' }));

    expect(screen.queryAllByRole('button', { name: 'Clear baseline' })).toHaveLength(0);
    expect(screen.queryByText('Avg')).toBeNull();
    expect(screen.queryByText('+1.50')).toBeNull();
    expect(screen.getByText('8.50')).toBeInTheDocument();
  });

  it('labels each delta for screen readers', async () => {
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

  it('titles the sibling deltas with the verdict', async () => {
    seedTwoSumRows();
    renderTable();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );

    expect(
      document.querySelector(
        '[title="Averages 1.5 higher · steadier · hits 17% more often"]',
      ),
    ).not.toBeNull();
  });

  it('pinning a second row moves the baseline instead of adding one', async () => {
    seedTwoSumRows();
    renderTable();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pin as baseline' }));

    expect(
      screen.getAllByRole('button', { name: 'Clear baseline' }),
    ).toHaveLength(1);
    // The first row is now the comparing side: 7.00 − 8.50 → −1.50.
    expect(screen.getByText('−1.50')).toBeInTheDocument();
    expect(screen.getByText('8.50')).toBeInTheDocument();
  });

  it('renders delta lines without a Hit % column when no targets are set', async () => {
    seedTwoSumRows([]);
    renderTable();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Pin as baseline' })[0]!,
    );

    expect(screen.getByText('+1.50')).toBeInTheDocument();
    expect(screen.queryByText('+16.7%')).toBeNull();
    expect(
      document.querySelector('[title="Averages 1.5 higher · steadier"]'),
    ).not.toBeNull();
  });
});

