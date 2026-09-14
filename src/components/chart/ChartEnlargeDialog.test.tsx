import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { OverlayChart } from './OverlayChart';
import type { Expression, ExpressionMode } from '../../types';

interface ImplProps {
  expressions: Expression[];
  unit?: 'totals' | 'successes';
}

// The dialog's whole job is deciding what to hand the renderer, so the renderer
// is a mock that records exactly that. Recharts mounts nothing in jsdom anyway.
vi.mock('./OverlayChartImpl', () => ({
  default: (props: ImplProps) => (
    <div
      data-testid="chart-impl"
      data-unit={props.unit ?? 'totals'}
      data-drawn={props.expressions.length}
    />
  ),
}));

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

afterEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(window, 'matchMedia');
});

/**
 * jsdom ships no matchMedia and `readMatch` answers true without it, so the
 * default is the wide, fine-pointer path. Every narrow case has to say so
 * explicitly or it passes for the wrong reason.
 */
function mockQueries(answer: (query: string) => boolean) {
  window.matchMedia = ((query: string) => ({
    matches: answer(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

interface SeedRow {
  id: string;
  mode: ExpressionMode;
  count?: number;
  sides?: number;
}

function seed(rows: SeedRow[], poolTargets: number[] = [1]) {
  const expressions = rows.map((row) => ({
    id: row.id,
    name: `Roll ${row.id}`,
    parts: [
      { id: `p-${row.id}`, count: row.count ?? 2, sides: row.sides ?? 6 },
    ],
    flatModifier: 0,
    rollMode: 'normal' as const,
    mode: row.mode,
    ...(row.mode === 'pool'
      ? { successThreshold: { direction: 'gte' as const, value: 5 } }
      : {}),
  }));
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({
      version: 2,
      value: {
        version: 3,
        expressions,
        ui: {
          expandedId: null,
          chartView: 'pmf',
          target: { values: [], ruling: 'gte' as const },
          view: 'table',
          poolTarget: poolTargets[0] ?? 1,
        },
      },
    }),
  );
}

const sums = (n: number, count = 2, sides = 6): SeedRow[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    mode: 'sum' as const,
    count,
    sides,
  }));

async function openDialog(title = 'Totals'): Promise<HTMLElement> {
  render(
    <AllProviders>
      <OverlayChart />
    </AllProviders>,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: `Enlarge the ${title} chart` }),
  );
  return await screen.findByRole('dialog');
}

describe('ChartEnlargeDialog on a wide canvas', () => {
  it('draws the whole table and says so instead of paging', async () => {
    seed(sums(100));
    const dialog = await openDialog();
    const inside = within(dialog);

    await waitFor(() =>
      expect(inside.getByTestId('chart-impl')).toHaveAttribute(
        'data-drawn',
        '100',
      ),
    );
    expect(inside.queryByText(/showing \d+ to/i)).toBeNull();
    expect(
      inside.queryByRole('button', { name: /more rolls on the totals chart/i }),
    ).toBeNull();
    expect(inside.getByText(/drawing all 100 rolls/i)).toBeInTheDocument();

    // The rail behind it is untouched, which is the point of a second budget.
    expect(screen.getByText(/showing 1 to 20 of 100 rolls/i)).toBeInTheDocument();
  });

  it('names each chip by position, since a hundred rolls repeat both name and hue', async () => {
    seed(sums(100));
    const dialog = await openDialog();
    expect(
      within(dialog).getByRole('button', { name: 'Focus Roll s0, roll 1 of 100, in chart' }),
    ).toBeInTheDocument();
  });
});

describe('ChartEnlargeDialog falls back to a page', () => {
  it('pages on a narrow canvas, which is every phone', async () => {
    // The single most important assertion here. Without the stub this passes
    // for the wrong reason, because jsdom answers every query true.
    mockQueries(() => false);
    seed(sums(100));
    const dialog = await openDialog();
    const inside = within(dialog);

    await waitFor(() =>
      expect(inside.getByTestId('chart-impl')).toHaveAttribute(
        'data-drawn',
        '20',
      ),
    );
    expect(inside.getByText(/showing 1 to 20 of 100 rolls/i)).toBeInTheDocument();
    expect(
      inside.getByRole('button', { name: /more rolls on the totals chart/i }),
    ).toBeInTheDocument();
    expect(inside.queryByText(/drawing all/i)).toBeNull();
  });

  it('pages on a wide touch tablet, which has no way into the field', async () => {
    mockQueries((q) => !q.includes('hover'));
    seed(sums(100));
    const dialog = await openDialog();

    await waitFor(() =>
      expect(within(dialog).getByTestId('chart-impl')).toHaveAttribute(
        'data-drawn',
        '20',
      ),
    );
    expect(
      within(dialog).getByText(/showing 1 to 20 of 100 rolls/i),
    ).toBeInTheDocument();
  });

  it('pages both panels when two are sharing the height', async () => {
    // 31 a side, one past the threshold: at exactly thirty the curves are
    // still followable in their own pens and the field would be a regression.
    seed([
      ...sums(31),
      ...Array.from({ length: 31 }, (_, i) => ({
        id: `p${i}`,
        mode: 'pool' as const,
      })),
    ]);
    const dialog = await openDialog();
    const inside = within(dialog);

    // One panel on screen, so the field is on.
    await waitFor(() =>
      expect(inside.getByText(/drawing all 31 rolls/i)).toBeInTheDocument(),
    );

    fireEvent.click(inside.getByRole('button', { name: 'Both' }));
    await waitFor(() =>
      expect(inside.getAllByText(/showing 1 to 20 of 31 rolls/i)).toHaveLength(2),
    );
    expect(inside.queryByText(/drawing all/i)).toBeNull();
  });

  it('pages a draw too wide to afford, whatever it would have looked like', async () => {
    // 100 rows of 3d100 blows the point budget. The cap raise alone would have
    // drawn them.
    seed(sums(100, 3, 100));
    const dialog = await openDialog();

    await waitFor(() =>
      expect(within(dialog).getByTestId('chart-impl')).toHaveAttribute(
        'data-drawn',
        '20',
      ),
    );
    expect(
      within(dialog).getByText(/showing 1 to 20 of 100 rolls/i),
    ).toBeInTheDocument();
  });
});

describe('ChartEnlargeDialog paging stays its own', () => {
  it('leaves the rail where the user left it', async () => {
    mockQueries(() => false);
    seed(sums(30));
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole('button', {
        name: /more rolls on the totals chart/i,
      }),
    );
    expect(
      within(dialog).getByText(/showing 21 to 30 of 30 rolls/i),
    ).toBeInTheDocument();
    // The rail behind the dialog has not moved.
    expect(screen.getByText(/showing 1 to 20 of 30 rolls/i)).toBeInTheDocument();
  });
});

describe('the field threshold is a real edge', () => {
  it('keeps a thirty-roll table on its own pens and takes the thirty-first onto the field', async () => {
    seed(sums(30));
    const { unmount } = render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Enlarge the Totals chart' }),
    );
    const at = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(within(at).getByTestId('chart-impl')).toHaveAttribute(
        'data-drawn',
        '30',
      ),
    );
    // Drawn whole, but through the existing per-series path: no field caption
    // and no scrolling legend index.
    expect(within(at).queryByText(/drawing all/i)).toBeNull();
    expect(
      within(at).queryByRole('group', { name: 'Rolls drawn on this chart' }),
    ).toBeNull();
    unmount();

    window.localStorage.clear();
    seed(sums(31));
    const past = await openDialog();
    await waitFor(() =>
      expect(within(past).getByText(/drawing all 31 rolls/i)).toBeInTheDocument(),
    );
    expect(
      within(past).getByRole('group', { name: 'Rolls drawn on this chart' }),
    ).toBeInTheDocument();
  });
});
