import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import indexHtml from '../../index.html?raw';
import bootJs from '../../public/boot.js?raw';

// The overlay chart lazy-loads recharts, which needs browser APIs jsdom does
// not provide; the page-level seam under test is which sections render, not
// what the chart draws.
vi.mock('../components/chart/OverlayChart', () => ({
  OverlayChart: () => <div data-testid="overlay-chart" />,
}));

const { AppProvider } = await import('../state/AppContext');
const { RollHistoryProvider } = await import('../state/RollHistoryContext');
const TablePage = (await import('./TablePage')).default;

function renderPage() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <RollHistoryProvider>
          <TablePage />
        </RollHistoryProvider>
      </AppProvider>
    </ChakraProvider>,
  );
}

type WorkshopView = 'table' | 'target' | 'rolloff' | 'matrix';

function seedOneRoll(view: WorkshopView) {
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
      view,
      poolTarget: 1,
      baselineId: null,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('TablePage first-run empty state', () => {
  it('shows the example panel instead of the workshop views on first run', () => {
    renderPage();
    expect(screen.getByText('Start with an example')).toBeInTheDocument();
    // An empty table has nothing to edit, so the whole workshop toolbar sits
    // out and the panel owns the only two ways in. The view switcher stays.
    expect(screen.queryByText('Roll mode')).toBeNull();
    expect(screen.queryByRole('button', { name: 'PMF' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll to top' })).toBeNull();
    expect(screen.queryByTestId('overlay-chart')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Table & chart' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /start from a blank roll/i }),
    ).toBeInTheDocument();
  });

  it('replaces every workshop view with the panel while empty', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Roll-off' }));
    expect(screen.getByText('Start with an example')).toBeInTheDocument();
    expect(screen.queryByText(/at least two rolls/i)).toBeNull();
  });

  it('leaves the panel and shows the table once an example is used', () => {
    renderPage();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Use this roll' })[0]!,
    );

    expect(screen.queryByText('Start with an example')).toBeNull();
    expect(screen.getByText('Roll mode')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Name' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('overlay-chart')).toBeInTheDocument();
  });

  it('renders the persisted workshop view, not the panel, when rows exist', () => {
    seedOneRoll('rolloff');
    renderPage();
    expect(screen.queryByText('Start with an example')).toBeNull();
    expect(screen.getByText(/at least two rolls/i)).toBeInTheDocument();
  });
});

const HERO = 'Compare dice rolls side by side';



describe('TablePage heading', () => {
  it('shows the heading while the table is empty', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: HERO }),
    ).toBeInTheDocument();
  });

  it('keeps the heading once the table has rows', () => {
    // The heading is hidden visually, not unmounted: / would otherwise have no
    // h1 at all for the whole time a table has rows in it.
    seedOneRoll('table');
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: HERO }),
    ).toBeInTheDocument();
  });

  it('renders exactly one h1 either way', () => {
    seedOneRoll('table');
    const { container } = renderPage();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('matches the copy index.html paints before React mounts', () => {
    // index.html hardcodes this string for crawlers and the pre-mount frame,
    // and cannot read it from here, so the two drift silently without a check.
    const preboot = /<div id="root">[\s\S]*?<h1>([\s\S]*?)<\/h1>/.exec(indexHtml);
    expect(preboot).not.toBeNull();
    expect(preboot![1]!.replace(/\s+/g, ' ').trim()).toBe(HERO);
  });

  it('hides the preboot copy before mount when the table already has rows', () => {
    // Without this the returning visitor watches the heading paint and vanish,
    // because the store hydrates synchronously on the first render. The script
    // half lives in public/boot.js rather than inline, because the deployed CSP
    // is script-src 'self' and blocks an inline block outright; the rule it
    // depends on is still in index.html's pre-mount style block.
    expect(bootJs).toContain("localStorage.getItem('dicetable.v2')");
    expect(bootJs).toContain("classList.add('has-rolls')");
    expect(indexHtml).toMatch(/html\.has-rolls \.preboot h1/);
  });

  it('loads the pre-paint script as a file the CSP allows', () => {
    // It was inline, and script-src 'self' blocked it every time, silently.
    // Inlining it back is the easy regression, so the shape is pinned here.
    expect(indexHtml).toContain('<script src="/boot.js"></script>');
    expect(indexHtml).not.toMatch(/<script>\s*\(function/);
    expect(bootJs).toContain("classList.add('dark')");
  });
});

describe('TablePage row actions', () => {
  it.each(['table', 'target', 'rolloff', 'matrix'] as const)(
    'offers Add roll on the %s view',
    (view) => {
      seedOneRoll(view);
      renderPage();
      expect(
        screen.getAllByRole('button', { name: /add roll/i }).length,
      ).toBeGreaterThan(0);
    },
  );

  it('keeps Add roll on Target hit when no target is set', () => {
    // That view's controls used to be gated on having a target, which left the
    // one view that most needs a second roll with no way to add one.
    seedOneRoll('target');
    renderPage();
    expect(screen.queryByRole('button', { name: 'TARGET' })).toBeNull();
    expect(
      screen.getAllByRole('button', { name: /add roll/i }).length,
    ).toBeGreaterThan(0);
  });
});
