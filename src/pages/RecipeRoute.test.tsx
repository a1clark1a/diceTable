import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { RECIPE_PAGES, type RecipePage } from '../presets/recipePages';
import { RELEASES } from '../whatsNew/releases';
import { encodeRollsToHash, encodeRollsToJson } from '../share/encode';
import { validatePersistedState } from '../state/persistedSchema';
import { toaster } from '../components/share/toaster-store';
import { openParams, paramsPanel } from '../test/params';
import { MAX_EXPRESSIONS, type Expression } from '../types';

// The overlay chart lazy-loads recharts, which needs browser APIs jsdom does
// not provide; what it draws is not part of this route's behaviour.
vi.mock('../components/chart/OverlayChart', () => ({
  OverlayChart: () => <div data-testid="overlay-chart" />,
}));

const App = (await import('../App')).default;

const STORAGE_KEY = 'dicetable.v2';
const LAST_SEEN = 'dicetable.lastSeenVersion';

function pageFor(slug: string): RecipePage {
  const page = RECIPE_PAGES.find((p) => p.slug === slug);
  if (page === undefined) throw new Error(`no recipe page ${slug}`);
  return page;
}

const PAGE = pageFor('advantage-vs-disadvantage');
const PAGE_URL = '/recipes/advantage-vs-disadvantage';
const RECIPE_NAMES = ['Normal', 'Advantage', 'Disadvantage'];
const OTHER_PAGE = pageFor('2d6-vs-3d6-vs-1d20');
const OTHER_URL = '/recipes/2d6-vs-3d6-vs-1d20';
const OPEN = /open this in my table/i;
const SUCCESS_TOAST = /^Added \d+ rolls? to your table$/;
const AT_THE_BOTTOM = 'They are at the bottom, after your own rolls.';
const FULL_TITLE = 'Your table is full';
const FULL_DESCRIPTION = `It holds ${MAX_EXPRESSIONS} rolls. Delete some there to make room for these.`;

const newest = RELEASES[0];
if (newest === undefined) throw new Error('no releases');
// A version with release notes, so What's new has something it could open with.
const CURRENT = newest.version;

function savedRow(i: number, name = `Saved ${i}`): Expression {
  return {
    id: `s${i}`,
    name,
    parts: [{ id: `sp${i}`, count: 1, sides: 8 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
}

function savedRows(count: number): Expression[] {
  return Array.from({ length: count }, (_, i) => savedRow(i));
}

function seedSavedTable(rows: Expression[]) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 2,
      value: {
        version: 3,
        expressions: rows,
        ui: {
          expandedId: null,
          chartView: 'pmf',
          target: { values: [], ruling: 'gte' },
          view: 'table',
          poolTarget: 1,
          baselineId: null,
        },
      },
    }),
  );
}

function savedNames(): string[] | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  const envelope: unknown = JSON.parse(raw);
  if (typeof envelope !== 'object' || envelope === null || !('value' in envelope)) {
    return null;
  }
  const state = validatePersistedState(envelope.value);
  return state === null ? null : state.expressions.map((e) => e.name);
}

/**
 * jsdom ships no matchMedia, and the color-mode provider App mounts reads one
 * on its first render. The answers pick the layout: every query true but the
 * dark-scheme one is the wide desktop table, every one false is a phone's cards.
 */
function stubQueries(matches: (query: string) => boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

function LocationProbe() {
  const { pathname, hash } = useLocation();
  return <div data-testid="location" data-pathname={pathname} data-hash={hash} />;
}

function BackButton() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Browser back</button>;
}

/** The last entry is the current page; any before it are the history behind it. */
function renderAt(...entries: string[]) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <App />
      <LocationProbe />
      {/* Stand-ins for any link between recipes, and for the browser's back. */}
      <nav aria-label="Test links">
        <Link to={PAGE_URL}>Go to advantage</Link>
        <Link to={OTHER_URL}>Go to dice shapes</Link>
        <BackButton />
      </nav>
    </MemoryRouter>,
  );
}

// The share link autoload reads the real window location rather than the
// router's, so a link arrival sets both.
function arriveWithHash(path: string, hash: string) {
  window.history.replaceState(null, '', `${path}${hash}`);
  return renderAt(`${path}${hash}`);
}

function follow(linkName: string) {
  fireEvent.click(screen.getByRole('link', { name: linkName }));
}

function currentPathname(): string | null {
  return screen.getByTestId('location').getAttribute('data-pathname');
}

function currentHash(): string | null {
  return screen.getByTestId('location').getAttribute('data-hash');
}

function rowNames(): string[] {
  return screen
    .getAllByRole('textbox', { name: 'Roll name' })
    .map((el) => (el instanceof HTMLInputElement ? el.value : ''));
}

function openInMyTable() {
  fireEvent.click(screen.getByRole('button', { name: OPEN }));
}

function deleteRowNamed(name: string) {
  const index = rowNames().indexOf(name);
  const button = screen.getAllByRole('button', { name: 'Delete row' })[index];
  if (button === undefined) throw new Error(`no row named ${name}`);
  fireEvent.click(button);
}

// The body row that owns a named roll, found through its name field so the
// lookup never depends on row order.
function rowFor(name: string): HTMLElement {
  const row = screen
    .getAllByRole('row')
    .find((r) => within(r).queryByDisplayValue(name) !== null);
  if (row === undefined) throw new Error(`no row named ${name}`);
  return row;
}

// Located by the header's position rather than a hard-coded column index.
function hitCellIn(row: HTMLElement): HTMLElement {
  const column = screen
    .getAllByRole('columnheader')
    .findIndex((h) => (h.textContent ?? '').includes('Hit %'));
  const cell = within(row).getAllByRole('cell')[column];
  if (cell === undefined) throw new Error('no Hit % cell in row');
  return cell;
}

// dom-accessibility-api joins "Variants" and the visually hidden " of <name>"
// without the space a browser keeps, so the trigger is found by its text.
async function addVariantsOf(name: string) {
  const expand = screen.getAllByRole('button', { name: 'Expand row' })[
    rowNames().indexOf(name)
  ];
  if (expand === undefined) throw new Error(`no row named ${name}`);
  fireEvent.click(expand);
  const trigger = screen
    .getAllByRole('button')
    .find((b) => b.textContent === `Variants of ${name}`);
  if (trigger === undefined) throw new Error(`no Variants trigger for ${name}`);
  fireEvent.click(trigger);
  const panel = await screen.findByRole('dialog', { name: `Variants of ${name}` });
  fireEvent.click(within(panel).getByRole('button', { name: /^Add (\d+ )?rolls?$/ }));
}

async function importOnPage(rows: Expression[]) {
  fireEvent.click(screen.getByRole('button', { name: 'Import rolls' }));
  const dialog = await screen.findByRole('dialog', { name: 'Import rolls' });
  fireEvent.change(
    within(dialog).getByRole('textbox', { name: 'Paste a share link or JSON' }),
    { target: { value: encodeRollsToJson(rows) } },
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add to table' }));
}

// Saved-table writes are debounced, and leaving the page flushes a pending one
// as a reload would. After the flush, an absent write means "never written"
// whatever the debounce length.
function flushPendingSave() {
  act(() => {
    window.dispatchEvent(new Event('beforeunload'));
  });
}

// A dialog that is going to open does so a beat after mount, so absence is only
// meaningful once that beat has passed.
async function expectNoDialog() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(screen.queryByRole('dialog')).toBeNull();
}

beforeEach(() => {
  stubQueries((query) => !query.includes('prefers-color-scheme'));
  vi.stubGlobal('__APP_VERSION__', CURRENT);
  // Seen already, so What's new stays out of the way of every test that is
  // not about it.
  window.localStorage.setItem(LAST_SEEN, CURRENT);
});

afterEach(() => {
  // The store is module-level and shows at most three at once; leftovers from
  // one test would queue the next test's toast instead of showing it.
  toaster.remove();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('recipe page on arrival', () => {
  it('shows the page heading as an h1', () => {
    renderAt(PAGE_URL);
    expect(
      screen.getByRole('heading', { level: 1, name: PAGE.heading }),
    ).toBeInTheDocument();
  });

  it('shows the recipe rows in the table, in order', () => {
    renderAt(PAGE_URL);
    expect(rowNames()).toEqual(RECIPE_NAMES);
  });

  it('sets the document title to the page title', () => {
    renderAt(PAGE_URL);
    expect(document.title).toBe(PAGE.title);
  });

  it('gives the page its own meta description', () => {
    renderAt(PAGE_URL);
    expect(
      Array.from(
        document.head.querySelectorAll('meta[name="description"]'),
        (el) => el.getAttribute('content'),
      ),
    ).toEqual([PAGE.description]);
  });

  it('points the canonical link at the recipe URL', () => {
    renderAt(PAGE_URL);
    expect(
      document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    ).toBe('https://dice-table.app/recipes/advantage-vs-disadvantage');
  });

  it('emits HowTo structured data with the page description and steps, in order', () => {
    renderAt(PAGE_URL);
    const blocks = Array.from(
      document.querySelectorAll('script[type="application/ld+json"]'),
      (el): unknown => JSON.parse(el.textContent ?? 'null'),
    );
    expect(blocks).toContainEqual(
      expect.objectContaining({
        '@type': 'HowTo',
        name: PAGE.heading,
        description: PAGE.description,
        step: PAGE.steps.map((s, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: s.title,
          text: s.plain,
        })),
      }),
    );
  });
});

describe('recipe page targets', () => {
  it('starts with the page’s target of 15', async () => {
    renderAt(PAGE_URL);
    await openParams('Edit targets');
    expect(
      screen.getByRole('button', { name: 'Remove target ≥ 15' }),
    ).toBeInTheDocument();
  });

  it('shows the plain d20 + 5 reaching 15 or more 55% of the time', () => {
    renderAt(PAGE_URL);
    expect(hitCellIn(rowFor('Normal'))).toHaveTextContent('55.0%');
  });

  it('starts the counting-successes page with pool targets of 1, 2 and 3', async () => {
    renderAt('/recipes/counting-successes');
    await openParams('Edit pool targets');
    expect(
      screen
        .getAllByRole('button', { name: /^Remove pool target/ })
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual([
      'Remove pool target ≥ 1',
      'Remove pool target ≥ 2',
      'Remove pool target ≥ 3',
    ]);
  });
});

describe('moving from one recipe page to another', () => {
  it('shows the next page’s heading', async () => {
    renderAt(PAGE_URL);
    follow('Go to dice shapes');
    expect(
      await screen.findByRole('heading', { level: 1, name: OTHER_PAGE.heading }),
    ).toBeInTheDocument();
  });

  it('starts the next page from its own rows', async () => {
    renderAt(PAGE_URL);
    follow('Go to dice shapes');
    await screen.findByRole('heading', { level: 1, name: OTHER_PAGE.heading });
    expect(rowNames()).toEqual(OTHER_PAGE.recipe.rows.map((r) => r.name));
  });

  it('leaves the first page’s target behind', async () => {
    renderAt(PAGE_URL);
    follow('Go to dice shapes');
    await screen.findByRole('heading', { level: 1, name: OTHER_PAGE.heading });
    await openParams('Edit targets');
    expect(
      paramsPanel('Targets').queryAllByRole('button', { name: /^Remove target/ }),
    ).toEqual([]);
  });

  it('shows the first page unedited on coming back to it', async () => {
    renderAt(PAGE_URL);
    deleteRowNamed('Normal');
    follow('Go to dice shapes');
    await screen.findByRole('heading', { level: 1, name: OTHER_PAGE.heading });
    follow('Go to advantage');
    await screen.findByRole('heading', { level: 1, name: PAGE.heading });
    expect(rowNames()).toEqual(RECIPE_NAMES);
  });
});

describe('recipe page with an unknown slug', () => {
  it('shows Page not found', () => {
    renderAt('/recipes/not-a-recipe');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
  });

  it('keeps the site header around it', () => {
    renderAt('/recipes/not-a-recipe');
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('has exactly one level-1 heading', () => {
    renderAt('/recipes/not-a-recipe');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('asks search engines not to index it', () => {
    renderAt('/recipes/not-a-recipe');
    expect(
      document.head.querySelector('meta[name="robots"]')?.getAttribute('content'),
    ).toBe('noindex,follow');
  });
});

describe('recipe page and the saved table', () => {
  it('never writes the saved table just for arriving', () => {
    renderAt(PAGE_URL);
    flushPendingSave();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('keeps edits to the recipe rows out of the saved table', () => {
    renderAt(PAGE_URL);
    deleteRowNamed('Normal');
    expect(rowNames()).toEqual(['Advantage', 'Disadvantage']);
    flushPendingSave();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('shows only the recipe rows when the visitor already has a saved table', () => {
    seedSavedTable([savedRow(1, 'Longsword')]);
    renderAt(PAGE_URL);
    expect(rowNames()).toEqual(RECIPE_NAMES);
  });

  it('leaves a saved table untouched while the visitor edits the recipe rows', () => {
    seedSavedTable([savedRow(1, 'Longsword')]);
    renderAt(PAGE_URL);
    deleteRowNamed('Normal');
    flushPendingSave();
    expect(savedNames()).toEqual(['Longsword']);
  });
});

describe('recipe page and the share controls', () => {
  it('lets a visitor with an empty saved table share the recipe rows', () => {
    renderAt(PAGE_URL);
    expect(screen.getByRole('button', { name: 'Share rolls' })).toBeEnabled();
  });

  it('turns Share off once every recipe row is deleted, even with a saved table', () => {
    seedSavedTable([savedRow(1, 'Longsword')]);
    renderAt(PAGE_URL);
    for (const name of RECIPE_NAMES) deleteRowNamed(name);
    expect(screen.getByRole('button', { name: 'Share rolls' })).toBeDisabled();
  });

  it('imports into the rows on screen', async () => {
    seedSavedTable([savedRow(1, 'Longsword')]);
    renderAt(PAGE_URL);
    await importOnPage([savedRow(2, 'Dagger')]);
    await waitFor(() => expect(rowNames()).toEqual([...RECIPE_NAMES, 'Dagger']));
  });

  it('leaves the saved table alone when importing', async () => {
    seedSavedTable([savedRow(1, 'Longsword')]);
    renderAt(PAGE_URL);
    await importOnPage([savedRow(2, 'Dagger')]);
    await waitFor(() => expect(rowNames()).toContain('Dagger'));
    flushPendingSave();
    expect(savedNames()).toEqual(['Longsword']);
  });
});

describe('Open this in my table', () => {
  it('adds the recipe rows after the rows already saved', async () => {
    seedSavedTable([savedRow(1, 'Longsword'), savedRow(2, 'Dagger')]);
    renderAt(PAGE_URL);
    openInMyTable();
    await waitFor(() =>
      expect(savedNames()).toEqual(['Longsword', 'Dagger', ...RECIPE_NAMES]),
    );
  });

  it('saves the recipe rows into an empty saved table', async () => {
    renderAt(PAGE_URL);
    openInMyTable();
    await waitFor(() => expect(savedNames()).toEqual(RECIPE_NAMES));
  });

  it('renames a recipe row whose name the saved table already uses', async () => {
    seedSavedTable([savedRow(1, 'Advantage')]);
    renderAt(PAGE_URL);
    openInMyTable();
    await waitFor(() =>
      expect(savedNames()).toEqual([
        'Advantage',
        'Normal',
        'Advantage (2)',
        'Disadvantage',
      ]),
    );
  });

  it('takes the visitor to their own table', async () => {
    seedSavedTable([savedRow(1, 'Longsword')]);
    renderAt(PAGE_URL);
    openInMyTable();
    await waitFor(() => expect(currentPathname()).toBe('/'));
    expect(rowNames()).toEqual(['Longsword', ...RECIPE_NAMES]);
  });

  it('keeps the recipe page in history, so back returns to it', async () => {
    renderAt(PAGE_URL);
    openInMyTable();
    await waitFor(() => expect(currentPathname()).toBe('/'));
    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
    await waitFor(() => expect(currentPathname()).toBe(PAGE_URL));
  });

  it('confirms with a toast saying how many rolls were added', async () => {
    renderAt(PAGE_URL);
    openInMyTable();
    expect(await screen.findByText('Added 3 rolls to your table')).toBeInTheDocument();
  });

  it('says "1 roll" when a single row is carried', async () => {
    renderAt(PAGE_URL);
    deleteRowNamed('Normal');
    deleteRowNamed('Advantage');
    openInMyTable();
    expect(await screen.findByText('Added 1 roll to your table')).toBeInTheDocument();
  });

  it('tells a visitor with saved rows that the new ones are at the bottom', async () => {
    seedSavedTable([savedRow(1, 'Longsword')]);
    renderAt(PAGE_URL);
    openInMyTable();
    expect(await screen.findByText(AT_THE_BOTTOM)).toBeInTheDocument();
  });

  it('says nothing about the bottom to a visitor whose saved table was empty', async () => {
    renderAt(PAGE_URL);
    openInMyTable();
    await screen.findByText('Added 3 rolls to your table');
    expect(screen.queryByText(AT_THE_BOTTOM)).toBeNull();
  });

  it('confirms with the success toast when the free room exactly fits the rows', async () => {
    seedSavedTable(savedRows(MAX_EXPRESSIONS - RECIPE_NAMES.length));
    renderAt(PAGE_URL);
    openInMyTable();
    expect(await screen.findByText('Added 3 rolls to your table')).toBeInTheDocument();
  });

  it('saves every row when the free room exactly fits them', async () => {
    const saved = savedRows(MAX_EXPRESSIONS - RECIPE_NAMES.length);
    seedSavedTable(saved);
    renderAt(PAGE_URL);
    openInMyTable();
    await waitFor(() =>
      expect(savedNames()).toEqual([...saved.map((r) => r.name), ...RECIPE_NAMES]),
    );
  });

  it('says how many fit instead of the success toast when only some do', async () => {
    seedSavedTable(savedRows(MAX_EXPRESSIONS - 2));
    renderAt(PAGE_URL);
    openInMyTable();
    expect(await screen.findByText('Added 2 of 3 rolls')).toBeInTheDocument();
    expect(screen.queryByText(SUCCESS_TOAST)).toBeNull();
  });

  it('carries only the rows left after one is deleted', async () => {
    renderAt(PAGE_URL);
    deleteRowNamed('Normal');
    openInMyTable();
    await waitFor(() =>
      expect(savedNames()).toEqual(['Advantage', 'Disadvantage']),
    );
  });

  it('counts only the carried rows in the toast', async () => {
    renderAt(PAGE_URL);
    deleteRowNamed('Normal');
    openInMyTable();
    expect(await screen.findByText('Added 2 rolls to your table')).toBeInTheDocument();
  });

  it('disappears once every recipe row is deleted', () => {
    renderAt(PAGE_URL);
    for (const name of RECIPE_NAMES) deleteRowNamed(name);
    expect(screen.queryByRole('button', { name: OPEN })).toBeNull();
  });
});

describe('Open this in my table pressed twice in quick succession', () => {
  // Both clicks land in one act, so the second arrives before React has
  // re-rendered from the first and the button is still on screen.
  function doublePress() {
    const button = screen.getByRole('button', { name: OPEN });
    act(() => {
      button.click();
      button.click();
    });
  }

  it('adds the recipe rows once', async () => {
    renderAt(PAGE_URL);
    doublePress();
    await waitFor(() => expect(currentPathname()).toBe('/'));
    flushPendingSave();
    expect(savedNames()).toEqual(RECIPE_NAMES);
  });

  it('shows one success toast', async () => {
    renderAt(PAGE_URL);
    doublePress();
    expect(await screen.findAllByText(SUCCESS_TOAST)).toHaveLength(1);
  });
});

describe('Open this in my table with a full saved table', () => {
  const FULL = savedRows(MAX_EXPRESSIONS);

  it('says the table is full', async () => {
    seedSavedTable(FULL);
    renderAt(PAGE_URL);
    openInMyTable();
    expect(await screen.findByText(FULL_TITLE)).toBeInTheDocument();
  });

  it('says how many rolls the table holds and how to make room', async () => {
    seedSavedTable(FULL);
    renderAt(PAGE_URL);
    openInMyTable();
    expect(await screen.findByText(FULL_DESCRIPTION)).toBeInTheDocument();
  });

  it('stays on the recipe page', async () => {
    seedSavedTable(FULL);
    renderAt(PAGE_URL);
    openInMyTable();
    await screen.findByText(FULL_TITLE);
    expect(currentPathname()).toBe(PAGE_URL);
  });

  it('keeps the visitor’s edits to the recipe rows', async () => {
    seedSavedTable(FULL);
    renderAt(PAGE_URL);
    deleteRowNamed('Normal');
    openInMyTable();
    await screen.findByText(FULL_TITLE);
    expect(rowNames()).toEqual(['Advantage', 'Disadvantage']);
  });

  it('adds nothing to the saved table', async () => {
    seedSavedTable(FULL);
    renderAt(PAGE_URL);
    openInMyTable();
    await screen.findByText(FULL_TITLE);
    flushPendingSave();
    expect(savedNames()).toEqual(FULL.map((r) => r.name));
  });

  it('shows neither the success toast nor the table’s own cap notice', async () => {
    seedSavedTable(FULL);
    renderAt(PAGE_URL);
    openInMyTable();
    await screen.findByText(FULL_TITLE);
    expect(screen.queryByText(SUCCESS_TOAST)).toBeNull();
    expect(screen.queryByText(`Up to ${MAX_EXPRESSIONS} rolls`)).toBeNull();
  });

  it('says so again on a second press', async () => {
    seedSavedTable(FULL);
    renderAt(PAGE_URL);
    openInMyTable();
    await screen.findByText(FULL_TITLE);
    openInMyTable();
    await waitFor(() => expect(screen.getAllByText(FULL_TITLE)).toHaveLength(2));
  });
});

describe('Open this in my table after adding variants', () => {
  it('takes the recipe table’s Undo toast away on leaving', async () => {
    renderAt(PAGE_URL);
    await addVariantsOf('Normal');
    await screen.findByText('Just below Normal.');
    openInMyTable();
    await waitFor(() => expect(currentPathname()).toBe('/'));
    await waitFor(() => expect(screen.queryByText(/^Just below /)).toBeNull());
  });

  it('keeps the success toast for the carried rows', async () => {
    renderAt(PAGE_URL);
    await addVariantsOf('Normal');
    await screen.findByText('Just below Normal.');
    const carried = rowNames().length;
    openInMyTable();
    await waitFor(() => expect(currentPathname()).toBe('/'));
    await waitFor(() => expect(screen.queryByText(/^Just below /)).toBeNull());
    expect(
      screen.getByText(`Added ${carried} rolls to your table`),
    ).toBeInTheDocument();
  });
});

describe('recipe page on a phone', () => {
  beforeEach(() => {
    stubQueries(() => false);
  });

  it('shows the page heading as an h1', () => {
    renderAt(PAGE_URL);
    expect(
      screen.getByRole('heading', { level: 1, name: PAGE.heading }),
    ).toBeInTheDocument();
  });

  it('shows the recipe rows as cards, in order', () => {
    renderAt(PAGE_URL);
    expect(screen.getAllByRole('button', { name: 'Delete card' })).toHaveLength(3);
    expect(rowNames()).toEqual(RECIPE_NAMES);
  });

  it('saves the recipe rows when Open this in my table is pressed', async () => {
    renderAt(PAGE_URL);
    openInMyTable();
    await waitFor(() => expect(savedNames()).toEqual(RECIPE_NAMES));
  });
});

describe('recipe page and share links', () => {
  it('sends a share link opened on a recipe page to the visitor’s own table, hash intact', () => {
    const hash = encodeRollsToHash([savedRow(1, 'Longsword')]);
    renderAt(`${PAGE_URL}${hash}`);
    expect(currentPathname()).toBe('/');
    expect(currentHash()).toBe(hash);
  });

  it('loads a share link opened on a recipe page into the saved table', async () => {
    seedSavedTable([savedRow(2, 'Dagger')]);
    arriveWithHash(PAGE_URL, encodeRollsToHash([savedRow(1, 'Longsword')]));
    await waitFor(() => expect(savedNames()).toEqual(['Longsword']));
  });

  it('confirms a share link opened on a recipe page with a toast', async () => {
    arriveWithHash(PAGE_URL, encodeRollsToHash([savedRow(1, 'Longsword')]));
    expect(await screen.findByText('Loaded 1 roll from link')).toBeInTheDocument();
  });

  it('sends a share link on an unknown recipe slug to the visitor’s own table, hash intact', () => {
    const hash = encodeRollsToHash([savedRow(1, 'Longsword')]);
    renderAt(`/recipes/not-a-recipe${hash}`);
    expect(currentPathname()).toBe('/');
    expect(currentHash()).toBe(hash);
  });

  it('leaves the recipe URL out of history, so back returns to the page before it', async () => {
    const hash = encodeRollsToHash([savedRow(1, 'Longsword')]);
    renderAt('/privacy', `${PAGE_URL}${hash}`);
    expect(currentPathname()).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
    await waitFor(() => expect(currentPathname()).toBe('/privacy'));
  });

  it('stays on the recipe page for a hash that is not a share link', () => {
    renderAt(`${PAGE_URL}#steps`);
    expect(currentPathname()).toBe(PAGE_URL);
    expect(
      screen.getByRole('heading', { level: 1, name: PAGE.heading }),
    ).toBeInTheDocument();
  });
});

describe('What\'s new on a recipe page', () => {
  // The recipe's own rows are on screen, so a shell that judged the visitor by
  // them would take a first visit for a returning user from before What's new
  // existed, and open it.
  it('stays closed for a first-time visitor whose own table is empty', async () => {
    window.localStorage.removeItem(LAST_SEEN);
    renderAt(PAGE_URL);
    await expectNoDialog();
  });

  it('records the version for a first-time visitor, so the next visit stays quiet', async () => {
    window.localStorage.removeItem(LAST_SEEN);
    renderAt(PAGE_URL);
    await waitFor(() => expect(window.localStorage.getItem(LAST_SEEN)).toBe(CURRENT));
  });

  it('opens for a visitor whose own saved table has rows and who has not seen it', async () => {
    window.localStorage.removeItem(LAST_SEEN);
    seedSavedTable([savedRow(1, 'Longsword')]);
    renderAt(PAGE_URL);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
