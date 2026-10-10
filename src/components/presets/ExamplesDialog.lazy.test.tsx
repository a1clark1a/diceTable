import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Distribution, Expression } from '../../types';

// One spy outlives every module reset, so each fresh copy of the engine
// module reports into the same place.
const { distributionSpy } = vi.hoisted(() => ({
  distributionSpy: vi.fn<(expr: Expression) => Distribution>(),
}));

// getRowData, the only caller outside the engine, reaches this export through
// the module boundary, so wrapping it sees every distribution the cards and
// the table compute.
vi.mock('../../engine/expression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../engine/expression')>();
  distributionSpy.mockImplementation(actual.expressionDistribution);
  return { ...actual, expressionDistribution: distributionSpy };
});

// The overlay chart lazy-loads recharts, which needs browser APIs jsdom does
// not provide.
vi.mock('../chart/OverlayChart', () => ({
  OverlayChart: () => <div data-testid="overlay-chart" />,
}));

// getRowData caches by row identity for the life of its module, so a test that
// ran earlier and opened the library would leave every recipe cached and make
// a later "opening computes them" assertion pass or fail by test order. A fresh
// module graph per test gives each one its own cache and its own recipe rows.
beforeEach(() => {
  vi.resetModules();
  distributionSpy.mockClear();
});

afterEach(() => {
  window.localStorage.clear();
});

function computedRows(): Expression[] {
  return distributionSpy.mock.calls.map(([expr]) => expr);
}

function isPresetRow(expr: Expression): boolean {
  return expr.id.startsWith('recipe-') || expr.id.startsWith('preset-');
}

function seedOneRoll() {
  const state = {
    version: 3,
    expressions: [
      {
        id: 'e1',
        name: 'Longsword',
        parts: [{ id: 'p1', count: 1, sides: 8 }],
        flatModifier: 0,
        rollMode: 'normal',
        mode: 'sum',
      },
    ],
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [] as number[], ruling: 'gte' as const },
      view: 'table',
      poolTarget: 1,
      baselineId: null,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

// Everything is imported after the reset, Chakra included, so the providers
// and the page share one module graph.
async function renderTablePage() {
  const { ChakraProvider, defaultSystem } = await import('@chakra-ui/react');
  const { AppProvider } = await import('../../state/AppContext');
  const { RollHistoryProvider } = await import('../../state/RollHistoryContext');
  const TablePage = (await import('../../pages/TablePage')).default;
  const { RECIPES } = await import('../../presets/recipes');
  render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <RollHistoryProvider>
          <TablePage />
        </RollHistoryProvider>
      </AppProvider>
    </ChakraProvider>,
  );
  return { RECIPES };
}

// Each test imports Chakra and the whole page afresh, which is the point and is
// also slow: a busy machine pushed one past the default 15s, and its leftover
// render then broke the next test.
describe('recipe library boot cost', { timeout: 60_000 }, () => {
  it('importing the recipe and starter modules computes no distribution', async () => {
    const { RECIPES } = await import('../../presets/recipes');
    const { STARTER_PRESETS } = await import('../../presets/starterRolls');

    expect(RECIPES.length).toBeGreaterThan(STARTER_PRESETS.length);
    expect(distributionSpy).not.toHaveBeenCalled();
  });

  it('a table with the library closed computes its own rows but no recipe row', async () => {
    seedOneRoll();
    await renderTablePage();

    expect(screen.getByRole('button', { name: 'Find a roll' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    // Proves the spy is wired into the path the table really uses, so the
    // absence below is not just a spy that never sees anything.
    expect(computedRows().map((e) => e.name)).toContain('Longsword');
    expect(computedRows().filter(isPresetRow)).toEqual([]);
  });

  it('an empty table computes only the starter rows its panel shows, never the library', async () => {
    const { STARTER_ROWS } = await import('../../presets/starterRolls');
    await renderTablePage();

    expect(screen.getByText('Start with an example')).toBeInTheDocument();
    const ids = new Set(computedRows().map((e) => e.id));
    for (const row of STARTER_ROWS) expect(ids).toContain(row.id);
    expect([...ids].filter((id) => id.startsWith('recipe-'))).toEqual([]);
  });

  it('opening the library computes every recipe row', async () => {
    seedOneRoll();
    const { RECIPES } = await renderTablePage();
    expect(computedRows().filter(isPresetRow)).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Find a roll' }));
    await screen.findByRole('dialog');

    const ids = new Set(computedRows().map((e) => e.id));
    const recipeIds = RECIPES.flatMap((r) => r.rows.map((row) => row.id));
    expect(recipeIds.filter((id) => !ids.has(id))).toEqual([]);
  });
});
