import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import indexHtml from '../../index.html?raw';
import bootJs from '../../public/boot.js?raw';
import type { DicePart } from '../types';
import { WIDTH_REFUSED_PART } from '../test/tooComplex';

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
      <MemoryRouter>
        <AppProvider>
          <RollHistoryProvider>
            <TablePage />
          </RollHistoryProvider>
        </AppProvider>
      </MemoryRouter>
    </ChakraProvider>,
  );
}

type WorkshopView = 'table' | 'target' | 'rolloff' | 'matrix';

function seedOneRoll(
  view: WorkshopView,
  parts: DicePart[] = [{ id: 'p1', count: 1, sides: 8 }],
) {
  const state = {
    version: 3,
    expressions: [
      {
        id: 'e1',
        name: 'Longsword',
        parts,
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

const HERO = 'Build, compare and balance dice rolls';



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

describe('TablePage roll library', () => {
  // The dialog machine opens a beat after the click.
  async function openLibrary() {
    fireEvent.click(screen.getByRole('button', { name: 'Find a roll' }));
    return await screen.findByRole('dialog');
  }

  it('opens from an empty table and stays open once the first roll lands', async () => {
    renderPage();
    const dialog = await openLibrary();

    fireEvent.click(
      within(dialog).getAllByRole('button', { name: 'Use this roll' })[0]!,
    );

    // The start panel gives way to the table underneath, and that swap must
    // not take the library down with it.
    expect(screen.queryByText('Start with an example')).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('stays open on Target hit when the first chartable roll lands', async () => {
    seedOneRoll('target', [WIDTH_REFUSED_PART]);
    renderPage();
    const emptyHint = /add a roll with valid dice/i;
    expect(screen.getByText(emptyHint)).toBeInTheDocument();
    const dialog = await openLibrary();

    fireEvent.click(
      within(dialog).getAllByRole('button', { name: 'Use this roll' })[0]!,
    );

    // The view has swapped to its full layout, which is the remount that used
    // to close a dialog owned by the button.
    expect(screen.queryByText(emptyHint)).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('TablePage row actions on a phone', () => {
  beforeEach(() => {
    // Every breakpoint query answers false, which is a phone: no desktop row
    // actions, cards instead of the table.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['table', 'target', 'rolloff', 'matrix'] as const)(
    'shows a labelled Find a roll button outside the overflow menu on the %s view',
    (view) => {
      seedOneRoll(view);
      renderPage();
      const find = screen.getByRole('button', { name: 'Find a roll' });
      expect(find).toBeVisible();
      expect(find.closest('[role="menu"]')).toBeNull();
    },
  );

  it.each(['table', 'target', 'rolloff', 'matrix'] as const)(
    'keeps Add roll out of the Find a roll row on the %s view',
    (view) => {
      seedOneRoll(view);
      renderPage();
      // Scoped to the row rather than the page: on Rolls the cards end with a
      // full-width Add roll of their own, which is not the row action.
      const row = screen.getByRole('button', { name: 'Find a roll' })
        .parentElement;
      expect(row).not.toBeNull();
      expect(
        within(row!).queryByRole('button', { name: /add roll/i }),
      ).toBeNull();
    },
  );
});

describe('TablePage Target view on a phone', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // A pool row is what brings the pool target row, so the toolbar shows both.
  function seedSumAndPool() {
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
        {
          id: 'e2',
          name: 'Pool',
          parts: [{ id: 'p2', count: 5, sides: 10 }],
          flatModifier: 0,
          rollMode: 'normal',
          mode: 'pool',
          successThreshold: { direction: 'gte', value: 8 },
        },
      ],
      ui: {
        expandedId: null,
        chartView: 'pmf',
        target: { values: [] as number[], ruling: 'gte' as const },
        view: 'target',
        poolTarget: 1,
        baselineId: null,
      },
    };
    window.localStorage.setItem(
      'dicetable.v2',
      JSON.stringify({ version: 2, value: state }),
    );
  }

  // jsdom measures nothing, but it does resolve each element's base styles, so
  // these pin the two rules that keep the Edit buttons on a 360px screen. The
  // target and pool target rows share one toolbar; its parent is the slot the
  // view's row gives it.
  function targetToolbarSlot(): HTMLElement {
    const pool = screen.getByRole('button', { name: 'Edit pool targets' });
    let toolbar = screen.getByRole('button', { name: 'Edit targets' })
      .parentElement;
    while (toolbar !== null && !toolbar.contains(pool)) {
      toolbar = toolbar.parentElement;
    }
    expect(toolbar?.parentElement).toBeTruthy();
    return toolbar!.parentElement!;
  }

  it('lets the target settings take the row width instead of their content width', () => {
    seedSumAndPool();
    renderPage();
    const slot = getComputedStyle(targetToolbarSlot());
    expect(slot.flexGrow).toBe('1');
    expect(slot.minWidth).toBe('0px');
  });

  it('leaves nothing else in that row to take space beside them', () => {
    seedSumAndPool();
    renderPage();
    const slot = targetToolbarSlot();
    const siblings = [...slot.parentElement!.children].filter(
      (el) => el !== slot,
    );
    expect(siblings.length).toBeGreaterThan(0);
    // The scroll pair lives on the sticky toolbar below md; a spacer or an
    // empty group left in this row would still take a gap.
    for (const el of siblings) {
      expect(getComputedStyle(el).display).toBe('none');
    }
  });
});

// index.html as the server sends it, parsed without running its scripts.
const served = new DOMParser().parseFromString(indexHtml, 'text/html');

function collapse(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function firstOf<T>(items: T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('expected at least one match');
  return item;
}

describe('index.html before React mounts', () => {
  function prebootText(tag: 'h1' | 'p'): string {
    const text = collapse(
      served.querySelector(`#root .preboot ${tag}`)?.textContent,
    );
    expect(text).not.toBe('');
    return text;
  }

  it('ships a single title marked data-default for RouteHead to replace', () => {
    const titles = [...served.querySelectorAll('title')];
    expect(titles).toHaveLength(1);
    expect(firstOf(titles).hasAttribute('data-default')).toBe(true);
  });

  it('paints the same heading before mount that / renders after it', () => {
    renderPage();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(collapse(heading.textContent)).toBe(prebootText('h1'));
  });

  it('paints the same paragraph before mount that / renders after it', () => {
    renderPage();
    expect(screen.getByText(prebootText('p')).tagName).toBe('P');
  });
});

describe('the homepage pitch', () => {
  // The positioning is building and balancing rolls, for published and
  // homebrew mechanics alike, with "compare" kept because people search it.
  function servedMeta(selector: string): string {
    return served.querySelector(selector)?.getAttribute('content') ?? '';
  }
  function servedJsonLdDescription(): string {
    const block = served.querySelector('script[type="application/ld+json"]');
    const data: unknown = JSON.parse(block?.textContent ?? '{}');
    if (typeof data !== 'object' || data === null || !('description' in data)) return '';
    return String(data.description);
  }

  it('says balance in the title, description, heading and JSON-LD', () => {
    renderPage();
    const strings = [
      document.title,
      servedMeta('meta[name="description"]'),
      collapse(screen.getByRole('heading', { level: 1 }).textContent),
      servedJsonLdDescription(),
    ];
    for (const s of strings) expect(s).toMatch(/\bbalanc(e|ing)\b/i);
  });

  it('says homebrew in the description and JSON-LD', () => {
    expect(servedMeta('meta[name="description"]')).toMatch(/homebrew/i);
    expect(servedJsonLdDescription()).toMatch(/homebrew/i);
  });

  it('uses no em-dash or en-dash anywhere in the pitch', () => {
    renderPage();
    const strings = [
      document.title,
      servedMeta('meta[name="description"]'),
      servedMeta('meta[property="og:title"]'),
      servedMeta('meta[property="og:description"]'),
      collapse(screen.getByRole('heading', { level: 1 }).textContent),
      servedJsonLdDescription(),
      collapse(served.querySelector('title')?.textContent),
    ];
    for (const s of strings) expect(s).not.toMatch(/[–—]/);
  });

  it('gives link previews the same title and description the page renders', () => {
    renderPage();
    expect(collapse(served.querySelector('title')?.textContent)).toBe(document.title);
    expect(servedMeta('meta[name="description"]')).toBe(
      document.head.querySelector('meta[name="description"]')?.getAttribute('content'),
    );
    expect(servedMeta('meta[property="og:title"]')).toBe(document.title);
  });
});

// boot.js reads exactly these four browser globals. Passing stand-ins runs it
// as a fresh page load would, without touching the test's own location.
function runBoot({
  pathname,
  storage = window.localStorage,
  doc = document.implementation.createHTMLDocument(''),
}: {
  pathname: string;
  storage?: Pick<Storage, 'getItem'>;
  doc?: Document;
}): DOMTokenList {
  const boot = new Function(
    'location',
    'localStorage',
    'window',
    'document',
    bootJs,
  );
  boot({ pathname }, storage, { matchMedia: () => ({ matches: false }) }, doc);
  return doc.documentElement.classList;
}

const blockedStorage: Pick<Storage, 'getItem'> = {
  getItem: () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  },
};

describe('boot.js recipe-route class', () => {
  it.each(['/', '/docs/quickstart', '/recipes', '/recipes-guide', '/docs/recipes/x'])(
    'leaves %s unmarked',
    (pathname) => {
      expect(runBoot({ pathname }).contains('recipe-route')).toBe(false);
    },
  );

  it('marks a recipe page', () => {
    expect(
      runBoot({ pathname: '/recipes/exploding-dice' }).contains('recipe-route'),
    ).toBe(true);
  });

  it('still marks a recipe page when storage is blocked', () => {
    // A private window can refuse storage; the hero would then flash the
    // homepage pitch on the one route that never shows it.
    expect(
      runBoot({
        pathname: '/recipes/exploding-dice',
        storage: blockedStorage,
      }).contains('recipe-route'),
    ).toBe(true);
  });
});

describe('boot.js has-rolls class', () => {
  it('marks the next load once a roll has been added', () => {
    renderPage();
    fireEvent.click(
      firstOf(screen.getAllByRole('button', { name: 'Use this roll' })),
    );
    // Leaving the page flushes the debounced save, as a reload would.
    window.dispatchEvent(new Event('beforeunload'));
    expect(runBoot({ pathname: '/' }).contains('has-rolls')).toBe(true);
  });

  it('leaves a first visit unmarked', () => {
    expect(runBoot({ pathname: '/' }).contains('has-rolls')).toBe(false);
  });

  it('leaves a saved table with no rows unmarked', () => {
    window.localStorage.setItem(
      'dicetable.v2',
      JSON.stringify({ version: 2, value: { version: 3, expressions: [] } }),
    );
    expect(runBoot({ pathname: '/' }).contains('has-rolls')).toBe(false);
  });

  it('leaves an unreadable save unmarked', () => {
    window.localStorage.setItem('dicetable.v2', '{not json');
    expect(runBoot({ pathname: '/' }).contains('has-rolls')).toBe(false);
  });

  it('leaves blocked storage unmarked', () => {
    expect(
      runBoot({ pathname: '/', storage: blockedStorage }).contains('has-rolls'),
    ).toBe(false);
  });
});

describe('preboot hero on the first paint', () => {
  let style: HTMLStyleElement;
  let root: HTMLDivElement;
  let classBefore: string;

  // The served <style> and #root markup go into the live document, because
  // jsdom only resolves stylesheets for a document with a window.
  beforeEach(() => {
    classBefore = document.documentElement.className;
    style = document.createElement('style');
    style.textContent = served.querySelector('style')?.textContent ?? '';
    document.head.append(style);
    root = document.createElement('div');
    root.innerHTML = served.getElementById('root')?.innerHTML ?? '';
    document.body.append(root);
  });

  afterEach(() => {
    style.remove();
    root.remove();
    document.documentElement.className = classBefore;
  });

  function clipped(tag: 'h1' | 'p'): boolean {
    const el = root.querySelector(`.preboot ${tag}`);
    expect(el).not.toBeNull();
    if (el === null) return false;
    const css = getComputedStyle(el);
    return (
      css.position === 'absolute' && css.width === '1px' && css.height === '1px'
    );
  }

  it('hides the homepage heading on a recipe page', () => {
    runBoot({ pathname: '/recipes/exploding-dice', doc: document });
    expect(clipped('h1')).toBe(true);
  });

  it('hides the homepage paragraph on a recipe page', () => {
    runBoot({ pathname: '/recipes/exploding-dice', doc: document });
    expect(clipped('p')).toBe(true);
  });

  it('shows the hero on / for a first visit', () => {
    runBoot({ pathname: '/', doc: document });
    expect(clipped('h1')).toBe(false);
    expect(clipped('p')).toBe(false);
  });
});
