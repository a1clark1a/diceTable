import { act, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AppProvider, SeededAppProvider, type TableSeed } from './AppContext';
import { useApp, type AppContextValue } from './useApp';
import { validateExpression } from './persistedSchema';
import { findRecipePage, type RecipePage } from '../presets/recipePages';
import { toaster } from '../components/share/toaster-store';
import { MAX_EXPRESSIONS, type Expression } from '../types';

const STORAGE_KEY = 'dicetable.v2';

interface PublishedToast {
  id?: string;
  title?: unknown;
  description?: unknown;
  dismiss?: boolean;
}

const toastUnsubs: Array<() => void> = [];

/** Watches the real toaster store; dismiss events are not created toasts. */
function recordToasts(): PublishedToast[] {
  const seen: PublishedToast[] = [];
  toastUnsubs.push(
    toaster.subscribe((toast: PublishedToast) => {
      if (!toast.dismiss) seen.push(toast);
    }),
  );
  return seen;
}

afterEach(() => {
  for (const unsub of toastUnsubs.splice(0)) unsub();
  // The store is module-level and shows at most three at once; leftovers from
  // one test would queue the next test's toast instead of publishing it.
  toaster.remove();
  vi.restoreAllMocks();
  // Fake timers land the saved table's debounced write; restoring here keeps a
  // failure inside one test from leaking them into the next.
  vi.useRealTimers();
  window.localStorage.clear();
});

function recipePage(slug: string): RecipePage {
  const page = findRecipePage(slug);
  if (page === undefined) throw new Error(`no recipe page ${slug}`);
  return page;
}

// Three rows and a target of 15.
const ADVANTAGE = recipePage('advantage-vs-disadvantage');
// Two rows and two targets, 20 and 25.
const ELVEN = recipePage('elven-accuracy');
// One pool row with pool targets 1, 2 and 3.
const POOL = recipePage('counting-successes');
// One check row whose effect carries its own dice.
const CHECK = recipePage('chance-to-hit-vs-ac');
// Three rows, no target and no pool targets.
const SHAPES = recipePage('2d6-vs-3d6-vs-1d20');

// Built the way the recipe route builds it, so these tests pin the provider and
// not the route; RecipeRoute.test.tsx covers the route's own seed wiring.
function seedFor(page: RecipePage): TableSeed {
  return {
    rows: page.recipe.rows,
    ...(page.target ? { target: page.target } : {}),
    ...(page.poolTargets ? { poolTargets: page.poolTargets } : {}),
  };
}

function seededWrapper(seed: TableSeed) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SeededAppProvider seed={seed}>{children}</SeededAppProvider>;
  };
}

function renderSeeded(seed: TableSeed) {
  return renderHook(() => useApp(), { wrapper: seededWrapper(seed) });
}

function names(rows: readonly Expression[]): string[] {
  return rows.map((r) => r.name);
}

function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'id')
        .map(([key, v]) => [key, withoutIds(v)]),
    );
  }
  return value;
}

function idsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(idsIn);
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, v]) =>
      key === 'id' && typeof v === 'string' ? [v] : idsIn(v),
    );
  }
  return [];
}

function rowAt(rows: readonly Expression[], index: number): Expression {
  const row = rows[index];
  if (row === undefined) throw new Error(`no row at ${index}`);
  return row;
}

function sumRow(i: number): Expression {
  return {
    id: `seed-${i}`,
    name: `Row ${i}`,
    parts: [{ id: `seed-${i}-p1`, count: 1, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
}

/** Lets a test read two tables, or one table across rerenders, from outside. */
function tracker() {
  let last: AppContextValue | null = null;
  return {
    report(app: AppContextValue) {
      last = app;
    },
    get current(): AppContextValue {
      if (last === null) throw new Error('the probe never rendered');
      return last;
    },
  };
}

function Probe({ report }: { report: (app: AppContextValue) => void }) {
  report(useApp());
  return null;
}

/** Saves a one-row table through the real saved provider, the way a visitor would. */
function saveATable(): string {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(() => useApp(), { wrapper: AppProvider });
  act(() => {
    result.current.addExpression();
  });
  const id = rowAt(result.current.expressions, 0).id;
  act(() => {
    result.current.renameExpression(id, 'Saved row');
  });
  act(() => {
    result.current.setTarget({ values: [3] });
  });
  act(() => {
    vi.advanceTimersByTime(200);
  });
  unmount();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) throw new Error('the saved table never reached localStorage');
  return raw;
}

/** Runs one of every kind of edit the storage tests need to stay silent through. */
function editEverything(result: { current: AppContextValue }) {
  act(() => {
    result.current.addExpression();
  });
  const first = rowAt(result.current.expressions, 0).id;
  act(() => {
    result.current.updateExpression(first, { flatModifier: 9 });
  });
  act(() => {
    result.current.duplicateExpression(first);
  });
  act(() => {
    result.current.deleteExpression(first);
  });
  act(() => {
    result.current.setTarget({ values: [4, 8] });
  });
  act(() => {
    result.current.setPoolTargets([2]);
  });
  act(() => {
    result.current.setView('rolloff');
  });
}

function savedTableCalls(calls: readonly (readonly unknown[])[]): unknown[][] {
  return calls.filter((args) => args[0] === STORAGE_KEY).map((args) => [...args]);
}

describe('SeededAppProvider seeding', () => {
  it('seeds the recipe rows in order with their dice, modifiers and roll modes intact', () => {
    const { result } = renderSeeded(seedFor(ADVANTAGE));
    expect(result.current.expressions.map(withoutIds)).toEqual(
      ADVANTAGE.recipe.rows.map(withoutIds),
    );
  });

  it('gives every seeded row a fresh id instead of the recipe placeholder', () => {
    const { result } = renderSeeded(seedFor(ADVANTAGE));
    const placeholders = new Set(ADVANTAGE.recipe.rows.map((r) => r.id));
    const ids = result.current.expressions.map((e) => e.id);
    expect(ids.filter((id) => placeholders.has(id))).toEqual([]);
    expect(new Set(ids).size).toBe(ADVANTAGE.recipe.rows.length);
  });

  it('gives every seeded die a fresh id, including the dice inside a check effect', () => {
    const { result } = renderSeeded(seedFor(CHECK));
    const placeholders = idsIn(CHECK.recipe.rows);
    const ids = idsIn(result.current.expressions);
    expect(ids).toHaveLength(placeholders.length);
    expect(ids.filter((id) => placeholders.includes(id))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('repairs a seeded row that the saved table would reject on its next load', () => {
    const broken: Expression = {
      id: 'seed-pool',
      name: 'Pool',
      parts: [
        {
          id: 'seed-pool-p1',
          count: 5,
          sides: 10,
          keep: { type: 'highest', n: 3 },
          explode: { onFaces: [10], depthCap: 10 },
        },
      ],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 8 },
      keepAcross: { type: 'highest', n: 1 },
    };
    const { result } = renderSeeded({ rows: [broken] });
    const landed = rowAt(result.current.expressions, 0);
    expect(landed.parts[0]).toMatchObject({ count: 5, sides: 10 });
    expect(landed.parts[0]?.keep).toBeUndefined();
    expect(landed.parts[0]?.explode).toBeUndefined();
    expect(landed.keepAcross).toBeUndefined();
    expect(landed.successThreshold).toEqual({ direction: 'gte', value: 8 });
    expect(validateExpression(JSON.parse(JSON.stringify(landed)) as unknown)).not.toBeNull();
  });

  it('gives seeded rows that share a name distinct names', () => {
    const { result } = renderSeeded({
      rows: [
        { ...sumRow(0), name: 'Attack' },
        { ...sumRow(1), name: 'Attack' },
      ],
    });
    expect(names(result.current.expressions)).toEqual(['Attack', 'Attack (2)']);
  });

  it(`keeps only the first ${MAX_EXPRESSIONS} rows of a larger seed`, () => {
    const rows = Array.from({ length: MAX_EXPRESSIONS + 1 }, (_, i) => sumRow(i));
    const { result } = renderSeeded({ rows });
    expect(result.current.expressions).toHaveLength(MAX_EXPRESSIONS);
    expect(rowAt(result.current.expressions, MAX_EXPRESSIONS - 1).name).toBe(
      `Row ${MAX_EXPRESSIONS - 1}`,
    );
  });

  it('starts empty when the seed has no rows', () => {
    const { result } = renderSeeded({ rows: [] });
    expect(result.current.expressions).toEqual([]);
  });

  it('starts on the table view with no row open and no baseline', () => {
    const { result } = renderSeeded(seedFor(ADVANTAGE));
    expect(result.current.view).toBe('table');
    expect(result.current.expandedId).toBeNull();
    expect(result.current.baselineId).toBeNull();
  });
});

describe('SeededAppProvider targets', () => {
  it('seeds the target the page gives', () => {
    const { result } = renderSeeded(seedFor(ELVEN));
    expect(result.current.target).toEqual({ values: [20, 25], ruling: 'gte' });
  });

  it('seeds the pool targets the page gives', () => {
    const { result } = renderSeeded(seedFor(POOL));
    expect(result.current.poolTargets).toEqual([1, 2, 3]);
  });

  it('starts with no target values when the seed names no target', () => {
    const { result } = renderSeeded(seedFor(SHAPES));
    expect(result.current.target).toEqual({ values: [], ruling: 'gte' });
  });

  it('starts with a single pool target of 1 when the seed names none', () => {
    const { result } = renderSeeded(seedFor(SHAPES));
    expect(result.current.poolTargets).toEqual([1]);
  });

  // The seed is the recipe module's own data, shared by every visit. An edit
  // that reached it would change what the next visitor's page starts from.
  it('starts the next table from the same recipe fresh after the last one was edited', () => {
    const first = renderSeeded(seedFor(ELVEN));
    const firstRow = rowAt(first.result.current.expressions, 0).id;
    const secondRow = rowAt(first.result.current.expressions, 1).id;
    act(() => {
      first.result.current.updateExpression(firstRow, { flatModifier: 9 });
    });
    act(() => {
      first.result.current.deleteExpression(secondRow);
    });
    act(() => {
      first.result.current.setTarget({ values: [1], ruling: 'lt' });
    });
    first.unmount();

    const second = renderSeeded(seedFor(ELVEN));
    expect(second.result.current.expressions.map(withoutIds)).toEqual(
      ELVEN.recipe.rows.map(withoutIds),
    );
    expect(second.result.current.target).toEqual({ values: [20, 25], ruling: 'gte' });
  });
});

// Both providers run every action through one shared hook, and AppContext.test.tsx
// covers the actions themselves; this only shows the seeded table is wired to it.
describe('SeededAppProvider actions', () => {
  it('adds a new roll after the seeded rows and opens its editor', () => {
    const { result } = renderSeeded(seedFor(ADVANTAGE));
    act(() => {
      result.current.addExpression();
    });
    expect(names(result.current.expressions)).toEqual([
      'Normal',
      'Advantage',
      'Disadvantage',
      'New roll',
    ]);
    expect(result.current.expandedId).toBe(rowAt(result.current.expressions, 3).id);
  });
});

describe('SeededAppProvider and the saved table', () => {
  it('never writes or removes the saved table, through the save delay and a page unload', () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const { result, unmount } = renderSeeded(seedFor(ADVANTAGE));
    editEverything(result);
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });
    unmount();
    expect(savedTableCalls(setItem.mock.calls)).toEqual([]);
    expect(savedTableCalls(removeItem.mock.calls)).toEqual([]);
  });

  it('never reads the saved table', () => {
    vi.useFakeTimers();
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const { result, unmount } = renderSeeded(seedFor(ADVANTAGE));
    editEverything(result);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    unmount();
    expect(savedTableCalls(getItem.mock.calls)).toEqual([]);
  });

  it('shows only the recipe rows and target when this browser already has a saved table', () => {
    saveATable();
    const { result } = renderSeeded(seedFor(ADVANTAGE));
    expect(names(result.current.expressions)).toEqual(['Normal', 'Advantage', 'Disadvantage']);
    expect(result.current.target.values).toEqual([15]);
  });

  it('leaves a saved table in this browser exactly as it was', () => {
    const before = saveATable();
    const { result, unmount } = renderSeeded(seedFor(ADVANTAGE));
    editEverything(result);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });
    unmount();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  it('answers for its own subtree when nested inside the saved table, and edits stay inside it', () => {
    saveATable();
    const outer = tracker();
    const inner = tracker();
    render(
      <AppProvider>
        <Probe report={outer.report} />
        <SeededAppProvider seed={seedFor(ADVANTAGE)}>
          <Probe report={inner.report} />
        </SeededAppProvider>
      </AppProvider>,
    );
    expect(names(outer.current.expressions)).toEqual(['Saved row']);
    expect(names(inner.current.expressions)).toEqual(['Normal', 'Advantage', 'Disadvantage']);
    const normal = rowAt(inner.current.expressions, 0).id;
    act(() => {
      inner.current.deleteExpression(normal);
    });
    expect(names(inner.current.expressions)).toEqual(['Advantage', 'Disadvantage']);
    expect(names(outer.current.expressions)).toEqual(['Saved row']);
  });
});

describe('SeededAppProvider independence', () => {
  it('keeps the edits of one seeded table out of another on the same page', () => {
    const a = tracker();
    const b = tracker();
    render(
      <>
        <SeededAppProvider seed={seedFor(ADVANTAGE)}>
          <Probe report={a.report} />
        </SeededAppProvider>
        <SeededAppProvider seed={seedFor(ADVANTAGE)}>
          <Probe report={b.report} />
        </SeededAppProvider>
      </>,
    );
    const normal = rowAt(a.current.expressions, 0).id;
    act(() => {
      a.current.deleteExpression(normal);
    });
    act(() => {
      a.current.setTarget({ values: [2] });
    });
    expect(names(a.current.expressions)).toEqual(['Advantage', 'Disadvantage']);
    expect(names(b.current.expressions)).toEqual(['Normal', 'Advantage', 'Disadvantage']);
    expect(b.current.target.values).toEqual([15]);
  });

  it('hands out different ids to two tables seeded from the same recipe', () => {
    const a = tracker();
    const b = tracker();
    render(
      <>
        <SeededAppProvider seed={seedFor(CHECK)}>
          <Probe report={a.report} />
        </SeededAppProvider>
        <SeededAppProvider seed={seedFor(CHECK)}>
          <Probe report={b.report} />
        </SeededAppProvider>
      </>,
    );
    const idsA = idsIn(a.current.expressions);
    expect(idsIn(b.current.expressions).filter((id) => idsA.includes(id))).toEqual([]);
  });
});

describe('SeededAppProvider seeds once', () => {
  it('keeps its rows and edits when rerendered with a different seed', () => {
    const app = tracker();
    const { rerender } = render(
      <SeededAppProvider seed={seedFor(ADVANTAGE)}>
        <Probe report={app.report} />
      </SeededAppProvider>,
    );
    act(() => {
      app.current.addExpression();
    });
    rerender(
      <SeededAppProvider seed={seedFor(SHAPES)}>
        <Probe report={app.report} />
      </SeededAppProvider>,
    );
    expect(names(app.current.expressions)).toEqual([
      'Normal',
      'Advantage',
      'Disadvantage',
      'New roll',
    ]);
    expect(app.current.target.values).toEqual([15]);
  });

  it('starts over from the new seed when remounted under a new key', () => {
    const app = tracker();
    const { rerender } = render(
      <SeededAppProvider key={ADVANTAGE.slug} seed={seedFor(ADVANTAGE)}>
        <Probe report={app.report} />
      </SeededAppProvider>,
    );
    act(() => {
      app.current.addExpression();
    });
    rerender(
      <SeededAppProvider key={SHAPES.slug} seed={seedFor(SHAPES)}>
        <Probe report={app.report} />
      </SeededAppProvider>,
    );
    expect(app.current.expressions.map(withoutIds)).toEqual(
      SHAPES.recipe.rows.map(withoutIds),
    );
    expect(app.current.target.values).toEqual([]);
  });
});

describe('SeededAppProvider leaving the page', () => {
  /** Sweeps the Advantage row's modifier and returns the id of its Undo toast. */
  function sweepAdvantage(): { unmount: () => void; undoToastId: string } {
    const toasts = recordToasts();
    const { result, unmount } = renderSeeded(seedFor(ADVANTAGE));
    const advantage = rowAt(result.current.expressions, 1).id;
    act(() => {
      result.current.sweepExpression(advantage, { kind: 'modifier' }, [1, 2]);
    });
    const undo = toasts.find((t) => t.description === 'Just below Advantage.');
    if (undo?.id === undefined) throw new Error('the sweep raised no Undo toast');
    return { unmount, undoToastId: undo.id };
  }

  // Its Undo could only report removing rows that left with the table.
  it("takes down its sweep's Undo toast when it unmounts", () => {
    const { unmount, undoToastId } = sweepAdvantage();
    expect(toaster.isVisible(undoToastId)).toBe(true);
    unmount();
    expect(toaster.isVisible(undoToastId)).toBe(false);
  });

  // Opening a recipe in the saved table raises its toast just before this
  // table unmounts, and that toast has to outlive it.
  it('leaves a toast it did not raise up when it unmounts', () => {
    const { unmount } = sweepAdvantage();
    const unrelated = toaster.create({ type: 'success', title: 'Added 3 rolls to your table' });
    unmount();
    expect(toaster.isVisible(unrelated)).toBe(true);
  });
});
