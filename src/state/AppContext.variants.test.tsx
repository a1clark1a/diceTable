import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AppProvider } from './AppContext';
import { useApp } from './useApp';
import { getRowData } from './useDistributions';
import { SCHEMA_VERSION } from './persistedSchema';
import { toaster } from '../components/share/toaster-store';
import { encodeRollsToHash, encodeRollsToJson } from '../share/encode';
import { decodeFromHashFragment, decodeFromJsonString } from '../share/decode';
import {
  MAX_EXPRESSIONS,
  MAX_NOTE_LENGTH,
  type DicePart,
  type Expression,
} from '../types';

const STORAGE_KEY = 'dicetable.v2';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

interface PublishedToast {
  type?: string;
  title?: unknown;
  description?: unknown;
  dismiss?: boolean;
  action?: { label: string; onClick: () => void };
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
  window.localStorage.clear();
  vi.useRealTimers();
});

function row(i: number, overrides: Partial<Expression> = {}): Expression {
  return {
    id: `e${i}`,
    name: `Row ${i}`,
    parts: [{ id: `p${i}`, count: 1, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function rows(count: number): Expression[] {
  return Array.from({ length: count }, (_, i) => row(i));
}

function seedRows(expressions: Expression[]) {
  const state = {
    version: SCHEMA_VERSION,
    expressions,
    ui: {
      expandedId: null,
      target: { values: [] as number[], ruling: 'gte' as const },
    },
  };
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 2, value: state }),
  );
}

function render() {
  return renderHook(() => useApp(), { wrapper });
}

type Hook = ReturnType<typeof render>['result'];

function names(result: Hook): string[] {
  return result.current.expressions.map((e) => e.name);
}

function ids(result: Hook): string[] {
  return result.current.expressions.map((e) => e.id);
}

function at(result: Hook, index: number): Expression {
  const expr = result.current.expressions[index];
  if (expr === undefined) throw new Error(`no row at index ${index}`);
  return expr;
}

function byId(result: Hook, id: string): Expression {
  const expr = result.current.expressions.find((e) => e.id === id);
  if (expr === undefined) throw new Error(`no row with id ${id}`);
  return expr;
}

function withoutId(part: DicePart): Record<string, unknown> {
  const out: Record<string, unknown> = { ...part };
  delete out.id;
  return out;
}

function allPartIds(expr: Expression): string[] {
  return [...expr.parts, ...(expr.check?.effect.parts ?? [])].map((p) => p.id);
}

/** Writes are debounced; this lands the pending one, then mounts a fresh provider. */
function reload(unmount: () => void): Hook {
  act(() => {
    vi.advanceTimersByTime(250);
  });
  unmount();
  vi.useRealTimers();
  return render().result;
}

function persistedRows(): Record<string, unknown>[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) throw new Error('nothing persisted');
  const envelope = JSON.parse(raw) as { value: { expressions: Record<string, unknown>[] } };
  return envelope.value.expressions;
}

const longsword: Partial<Expression> = {
  name: 'Longsword',
  parts: [
    {
      id: 'p1',
      count: 4,
      sides: 6,
      keep: { type: 'highest', n: 3 },
      reroll: { values: [1], mode: 'once' },
    },
  ],
  mods: [{ op: 'add', value: 2 }],
  note: 'v2: d8, the d10 spiked too hard',
};

function seedFiveWithLongswordSecond() {
  seedRows([row(0), row(1, longsword), row(2), row(3), row(4)]);
}

function checkRow(): Expression {
  return {
    id: 'c0',
    name: 'Attack',
    parts: [{ id: 'check-die', count: 1, sides: 20 }],
    flatModifier: 5,
    rollMode: 'normal',
    mode: 'check',
    check: {
      threshold: { direction: 'gte', value: 15 },
      effect: {
        parts: [{ id: 'effect-die', count: 1, sides: 8 }],
        flatModifier: 3,
      },
      onSuccess: 'full',
      onFailure: 'none',
    },
  };
}

describe('AppContext duplicateExpression', () => {
  it('puts the copy of row 2 of 5 directly below it, named "<name> (2)"', () => {
    seedFiveWithLongswordSecond();
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('e1');
    });
    expect(result.current.expressions).toHaveLength(6);
    expect(names(result)).toEqual([
      'Row 0',
      'Longsword',
      'Longsword (2)',
      'Row 2',
      'Row 3',
      'Row 4',
    ]);
  });

  it('names a second copy of the same source "<name> (3)", again directly below the source', () => {
    seedFiveWithLongswordSecond();
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('e1');
    });
    act(() => {
      result.current.duplicateExpression('e1');
    });
    expect(result.current.expressions).toHaveLength(7);
    expect(at(result, 1).name).toBe('Longsword');
    expect(at(result, 2).name).toBe('Longsword (3)');
    expect(at(result, 3).name).toBe('Longsword (2)');
  });

  it('opens the copy in the editor', () => {
    seedFiveWithLongswordSecond();
    const { result } = render();
    act(() => {
      result.current.setExpandedId('e1');
    });
    act(() => {
      result.current.duplicateExpression('e1');
    });
    expect(result.current.expandedId).toBe(at(result, 2).id);
  });

  it('leaves the baseline pinned on the source', () => {
    seedFiveWithLongswordSecond();
    const { result } = render();
    act(() => {
      result.current.setBaselineId('e1');
    });
    act(() => {
      result.current.duplicateExpression('e1');
    });
    expect(result.current.baselineId).toBe('e1');
  });

  it('gives the copy a new row id and new part ids', () => {
    seedFiveWithLongswordSecond();
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('e1');
    });
    const copy = at(result, 2);
    expect(copy.id).not.toBe('e1');
    expect(new Set(ids(result)).size).toBe(6);
    expect(copy.parts[0]!.id).not.toBe('p1');
  });

  it('copies the dice, modifier and rules so the copy rolls the same thing', () => {
    seedFiveWithLongswordSecond();
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('e1');
    });
    const source = at(result, 1);
    const copy = at(result, 2);
    expect(copy.parts.map(withoutId)).toEqual(source.parts.map(withoutId));
    expect(copy.mods).toEqual([{ op: 'add', value: 2 }]);
    expect(copy.rollMode).toBe(source.rollMode);
    expect(copy.mode).toBe('sum');
  });

  it("computes the same mean, spread, min and max as the source", () => {
    seedFiveWithLongswordSecond();
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('e1');
    });
    const source = getRowData(at(result, 1)).stats;
    const copy = getRowData(at(result, 2)).stats;
    expect(copy.mean).toBeCloseTo(source.mean, 12);
    expect(copy.stddev).toBeCloseTo(source.stddev, 12);
    expect(copy.min).toBe(source.min);
    expect(copy.max).toBe(source.max);
    // 4d6 keep 3, reroll 1s once, +2: lowest is 3 ones kept after rerolls, +2.
    expect(copy.min).toBe(5);
    expect(copy.max).toBe(20);
  });

  it('carries the note over to the copy', () => {
    seedFiveWithLongswordSecond();
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('e1');
    });
    expect(at(result, 2).note).toBe('v2: d8, the d10 spiked too hard');
  });

  it('editing a die on the copy leaves the source alone', () => {
    seedFiveWithLongswordSecond();
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('e1');
    });
    const copy = at(result, 2);
    act(() => {
      result.current.updatePart(copy.id, copy.parts[0]!.id, { count: 6 });
    });
    expect(byId(result, 'e1').parts[0]!.count).toBe(4);
    expect(byId(result, copy.id).parts[0]!.count).toBe(6);
  });

  it('returns every other row as the same object, so only the copy is computed', () => {
    seedFiveWithLongswordSecond();
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.duplicateExpression('e1');
    });
    const after = result.current.expressions;
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[3]).toBe(before[2]);
    expect(after[4]).toBe(before[3]);
    expect(after[5]).toBe(before[4]);
    expect(before).not.toContain(after[2]);
  });

  it('gives a check row copy fresh check-die and effect-die ids', () => {
    seedRows([checkRow()]);
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('c0');
    });
    const source = at(result, 0);
    const copy = at(result, 1);
    expect(copy.name).toBe('Attack (2)');
    expect(copy.check?.effect.parts).toHaveLength(1);
    const sourceIds = new Set(allPartIds(source));
    for (const partId of allPartIds(copy)) {
      expect(sourceIds.has(partId)).toBe(false);
    }
    expect(copy.check?.effect.parts[0]).toMatchObject({ count: 1, sides: 8 });
  });

  it('gives a check row copy the same success and crit odds as the source', () => {
    seedRows([checkRow()]);
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('c0');
    });
    const source = getRowData(at(result, 0));
    const copy = getRowData(at(result, 1));
    expect(copy.checkChances).not.toBeNull();
    expect(copy.checkChances).toEqual(source.checkChances);
    expect(copy.stats.mean).toBeCloseTo(source.stats.mean, 12);
  });

  it(`refuses at ${MAX_EXPRESSIONS} rows and says why`, () => {
    seedRows(rows(MAX_EXPRESSIONS));
    const toasts = recordToasts();
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.duplicateExpression('e5');
    });
    expect(result.current.expressions).toBe(before);
    expect(toasts.map((t) => t.title)).toContain(`Up to ${MAX_EXPRESSIONS} rolls`);
  });

  it('duplicates the last free slot up to exactly the cap', () => {
    seedRows(rows(MAX_EXPRESSIONS - 1));
    const { result } = render();
    act(() => {
      result.current.duplicateExpression('e0');
    });
    expect(result.current.expressions).toHaveLength(MAX_EXPRESSIONS);
    expect(at(result, 1).name).toBe('Row 0 (2)');
  });

  it('does nothing for an id that is not in the table', () => {
    seedFiveWithLongswordSecond();
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.duplicateExpression('missing');
    });
    expect(result.current.expressions).toBe(before);
  });
});

describe('AppContext moveExpression', () => {
  it('moving the first row up does nothing', () => {
    seedRows(rows(4));
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.moveExpression('e0', -1);
    });
    expect(result.current.expressions).toBe(before);
  });

  it('moving the last row down does nothing', () => {
    seedRows(rows(4));
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.moveExpression('e3', 1);
    });
    expect(result.current.expressions).toBe(before);
  });

  it('moving a row down swaps it with the row below', () => {
    seedRows(rows(4));
    const { result } = render();
    act(() => {
      result.current.moveExpression('e1', 1);
    });
    expect(ids(result)).toEqual(['e0', 'e2', 'e1', 'e3']);
  });

  it('moving a row up swaps it with the row above', () => {
    seedRows(rows(4));
    const { result } = render();
    act(() => {
      result.current.moveExpression('e2', -1);
    });
    expect(ids(result)).toEqual(['e0', 'e2', 'e1', 'e3']);
  });

  it('keeps every row the same object, so nothing is recomputed', () => {
    seedRows(rows(4));
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.moveExpression('e1', 1);
    });
    const after = result.current.expressions;
    expect(after).not.toBe(before);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[2]);
    expect(after[2]).toBe(before[1]);
    expect(after[3]).toBe(before[3]);
  });

  it('a row moved up from index 30 one step at a time reaches index 5 with the rest in order', () => {
    seedRows(rows(40));
    const { result } = render();
    for (let step = 0; step < 25; step += 1) {
      act(() => {
        result.current.moveExpression('e30', -1);
      });
    }
    expect(at(result, 5).id).toBe('e30');
    const others = ids(result).filter((id) => id !== 'e30');
    expect(others).toEqual(rows(40).map((e) => e.id).filter((id) => id !== 'e30'));
  });

  it('leaves the open editor and the baseline on the same rows', () => {
    seedRows(rows(4));
    const { result } = render();
    act(() => {
      result.current.setExpandedId('e1');
      result.current.setBaselineId('e2');
    });
    act(() => {
      result.current.moveExpression('e1', 1);
    });
    expect(result.current.expandedId).toBe('e1');
    expect(result.current.baselineId).toBe('e2');
  });

  it('does nothing for an id that is not in the table', () => {
    seedRows(rows(4));
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.moveExpression('missing', 1);
    });
    expect(result.current.expressions).toBe(before);
  });

  it('keeps the new order through a reload', () => {
    seedRows(rows(4));
    vi.useFakeTimers();
    const { result, unmount } = render();
    act(() => {
      result.current.moveExpression('e3', -1);
    });
    act(() => {
      result.current.moveExpression('e3', -1);
    });
    const second = reload(unmount);
    expect(ids(second)).toEqual(['e0', 'e3', 'e1', 'e2']);
  });
});

function twoDsix(): Expression {
  return row(1, {
    name: '2d6',
    parts: [{ id: 'p1', count: 2, sides: 6 }],
    note: 'baseline damage',
  });
}

function fillers(count: number): Expression[] {
  return Array.from({ length: count }, (_, i) =>
    row(i, { id: `x${i}`, name: `Filler ${i}`, parts: [{ id: `xp${i}`, count: 1, sides: 6 }] }),
  );
}

function seedAroundTwoDsix() {
  seedRows([row(0), twoDsix(), row(2)]);
}

const MODIFIER = { kind: 'modifier', step: 0 } as const;

describe('AppContext sweepExpression', () => {
  it('inserts the family directly below the source, named by the value that changed', () => {
    seedAroundTwoDsix();
    const { result } = render();
    act(() => {
      result.current.sweepExpression('e1', MODIFIER, [0, 1, 2, 3, 4, 5]);
    });
    expect(names(result)).toEqual([
      'Row 0',
      '2d6',
      '2d6 · +1',
      '2d6 · +2',
      '2d6 · +3',
      '2d6 · +4',
      '2d6 · +5',
      'Row 2',
    ]);
  });

  it('gives the modifier family means 8 through 12', () => {
    seedAroundTwoDsix();
    const { result } = render();
    act(() => {
      result.current.sweepExpression('e1', MODIFIER, [0, 1, 2, 3, 4, 5]);
    });
    const means = result.current.expressions
      .slice(2, 7)
      .map((e) => getRowData(e).stats.mean);
    [8, 9, 10, 11, 12].forEach((expected, i) => {
      expect(means[i]).toBeCloseTo(expected, 12);
    });
  });

  it('leaves every existing row the same object with the same id', () => {
    seedAroundTwoDsix();
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.sweepExpression('e1', MODIFIER, [1, 2, 3]);
    });
    const after = result.current.expressions;
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[5]).toBe(before[2]);
    expect(at(result, 1)).toEqual(twoDsix());
  });

  it('gives each variant its own row and part ids', () => {
    seedAroundTwoDsix();
    const { result } = render();
    act(() => {
      result.current.sweepExpression('e1', MODIFIER, [1, 2, 3]);
    });
    expect(new Set(ids(result)).size).toBe(6);
    const partIds = result.current.expressions.flatMap(allPartIds);
    expect(new Set(partIds).size).toBe(partIds.length);
  });

  it('carries the note to every variant', () => {
    seedAroundTwoDsix();
    const { result } = render();
    act(() => {
      result.current.sweepExpression('e1', MODIFIER, [1, 2]);
    });
    expect(at(result, 2).note).toBe('baseline damage');
    expect(at(result, 3).note).toBe('baseline damage');
  });

  it('keeps the source open in the editor and the baseline where it was', () => {
    seedAroundTwoDsix();
    const { result } = render();
    act(() => {
      result.current.setExpandedId('e1');
      result.current.setBaselineId('e0');
    });
    act(() => {
      result.current.sweepExpression('e1', MODIFIER, [1, 2]);
    });
    expect(result.current.expandedId).toBe('e1');
    expect(result.current.baselineId).toBe('e0');
  });

  it('sweeps die sizes on a part and keeps the reroll on every variant', () => {
    seedRows([
      row(0, {
        name: 'Hit',
        parts: [{ id: 'p0', count: 1, sides: 6, reroll: { values: [1], mode: 'once' } }],
      }),
    ]);
    const { result } = render();
    act(() => {
      result.current.sweepExpression('e0', { kind: 'sides', partId: 'p0' }, [4, 6, 8, 10]);
    });
    expect(names(result)).toEqual(['Hit', 'Hit · d4', 'Hit · d8', 'Hit · d10']);
    expect(result.current.expressions.slice(1).map((e) => e.parts[0]!.sides)).toEqual([
      4, 8, 10,
    ]);
    for (const variant of result.current.expressions.slice(1)) {
      expect(variant.parts[0]!.reroll).toEqual({ values: [1], mode: 'once' });
    }
  });

  it('dedupes a variant name that is already taken', () => {
    seedRows([row(0, { name: '2d6', parts: [{ id: 'p0', count: 2, sides: 6 }] }), row(1, { name: '2d6 · +1' })]);
    const { result } = render();
    act(() => {
      result.current.sweepExpression('e0', MODIFIER, [1]);
    });
    expect(names(result)).toEqual(['2d6', '2d6 · +1 (2)', '2d6 · +1']);
  });

  it(`with ${MAX_EXPRESSIONS - 3} rows, a five-value sweep creates only the three that fit`, () => {
    seedRows([twoDsix(), ...fillers(MAX_EXPRESSIONS - 4)]);
    const toasts = recordToasts();
    const { result } = render();
    expect(result.current.expressions).toHaveLength(MAX_EXPRESSIONS - 3);
    act(() => {
      result.current.sweepExpression('e1', MODIFIER, [1, 2, 3, 4, 5]);
    });
    expect(result.current.expressions).toHaveLength(MAX_EXPRESSIONS);
    expect(names(result).slice(0, 4)).toEqual(['2d6', '2d6 · +1', '2d6 · +2', '2d6 · +3']);
    expect(toasts.map((t) => t.title)).toContain('Added 3 rolls');
  });

  it(`creates nothing at ${MAX_EXPRESSIONS} rows`, () => {
    seedRows([twoDsix(), ...fillers(MAX_EXPRESSIONS - 1)]);
    const toasts = recordToasts();
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.sweepExpression('e1', MODIFIER, [1, 2]);
    });
    expect(result.current.expressions).toBe(before);
    expect(toasts.some((t) => typeof t.title === 'string' && t.title.startsWith('Added'))).toBe(
      false,
    );
  });

  it('creates nothing on a check row', () => {
    seedRows([checkRow()]);
    const toasts = recordToasts();
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.sweepExpression('c0', MODIFIER, [1, 2]);
    });
    expect(result.current.expressions).toBe(before);
    expect(toasts).toHaveLength(0);
  });

  it('creates nothing when every value is the source value', () => {
    seedAroundTwoDsix();
    const toasts = recordToasts();
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.sweepExpression('e1', MODIFIER, [0]);
    });
    expect(result.current.expressions).toBe(before);
    expect(toasts).toHaveLength(0);
  });

  it('does nothing for an id that is not in the table', () => {
    seedAroundTwoDsix();
    const { result } = render();
    const before = result.current.expressions;
    act(() => {
      result.current.sweepExpression('missing', MODIFIER, [1, 2]);
    });
    expect(result.current.expressions).toBe(before);
  });
});

describe('AppContext sweep toast and Undo', () => {
  function sweepFive(result: Hook, toasts: PublishedToast[]): PublishedToast {
    act(() => {
      result.current.sweepExpression('e1', MODIFIER, [1, 2, 3, 4, 5]);
    });
    const added = toasts.find((t) => t.title === 'Added 5 rolls');
    if (added === undefined) throw new Error('no "Added 5 rolls" toast');
    return added;
  }

  function undo(toast: PublishedToast) {
    const action = toast.action;
    if (action === undefined) throw new Error('toast has no action');
    act(() => {
      action.onClick();
    });
  }

  it('announces how many rows it added and where, with an Undo action', () => {
    seedAroundTwoDsix();
    const toasts = recordToasts();
    const { result } = render();
    const added = sweepFive(result, toasts);
    expect(added.description).toBe('Just below 2d6.');
    expect(added.action?.label).toBe('Undo');
  });

  it('says "Added 1 roll" for a single variant', () => {
    seedAroundTwoDsix();
    const toasts = recordToasts();
    const { result } = render();
    act(() => {
      result.current.sweepExpression('e1', MODIFIER, [3]);
    });
    expect(toasts.map((t) => t.title)).toContain('Added 1 roll');
  });

  it('Undo removes exactly the rows the sweep created', () => {
    seedAroundTwoDsix();
    const toasts = recordToasts();
    const { result } = render();
    const before = result.current.expressions;
    const added = sweepFive(result, toasts);
    undo(added);
    expect(ids(result)).toEqual(['e0', 'e1', 'e2']);
    result.current.expressions.forEach((e, i) => {
      expect(e).toBe(before[i]);
    });
    expect(toasts.map((t) => t.title)).toContain('Removed 5 rolls');
  });

  it('Undo leaves a row added after the sweep in place', () => {
    seedAroundTwoDsix();
    const toasts = recordToasts();
    const { result } = render();
    const added = sweepFive(result, toasts);
    act(() => {
      result.current.addExpression();
    });
    const later = at(result, result.current.expressions.length - 1);
    undo(added);
    expect(ids(result)).toEqual(['e0', 'e1', 'e2', later.id]);
    expect(result.current.expandedId).toBe(later.id);
  });

  it('Undo leaves a duplicate made after the sweep in place, even of a swept row', () => {
    seedAroundTwoDsix();
    const toasts = recordToasts();
    const { result } = render();
    const added = sweepFive(result, toasts);
    const swept = at(result, 2);
    act(() => {
      result.current.duplicateExpression(swept.id);
    });
    const copy = at(result, 3);
    expect(copy.name).toBe('2d6 · +1 (2)');
    undo(added);
    expect(ids(result)).toEqual(['e0', 'e1', copy.id, 'e2']);
  });

  it('Undo counts only the created rows still present', () => {
    seedAroundTwoDsix();
    const toasts = recordToasts();
    const { result } = render();
    const added = sweepFive(result, toasts);
    act(() => {
      result.current.deleteExpression(at(result, 2).id);
    });
    act(() => {
      result.current.deleteExpression(at(result, 2).id);
    });
    undo(added);
    expect(ids(result)).toEqual(['e0', 'e1', 'e2']);
    expect(toasts.map((t) => t.title)).toContain('Removed 3 rolls');
  });

  it('Undo does nothing once every created row is already gone', () => {
    seedAroundTwoDsix();
    const toasts = recordToasts();
    const { result } = render();
    const added = sweepFive(result, toasts);
    undo(added);
    const afterFirst = result.current.expressions;
    const toastCount = toasts.length;
    undo(added);
    expect(result.current.expressions).toBe(afterFirst);
    expect(toasts).toHaveLength(toastCount);
  });

  it('Undo clears a baseline or open editor that pointed at a removed row', () => {
    seedAroundTwoDsix();
    const toasts = recordToasts();
    const { result } = render();
    const added = sweepFive(result, toasts);
    act(() => {
      result.current.setBaselineId(at(result, 3).id);
      result.current.setExpandedId(at(result, 4).id);
    });
    undo(added);
    expect(result.current.baselineId).toBeNull();
    expect(result.current.expandedId).toBeNull();
  });

  it('Undo keeps a baseline and open editor on rows it did not create', () => {
    seedAroundTwoDsix();
    const toasts = recordToasts();
    const { result } = render();
    const added = sweepFive(result, toasts);
    act(() => {
      result.current.setBaselineId('e0');
      result.current.setExpandedId('e1');
    });
    undo(added);
    expect(result.current.baselineId).toBe('e0');
    expect(result.current.expandedId).toBe('e1');
  });

  it('Undo still finds rows the sweep created after they were moved', () => {
    seedAroundTwoDsix();
    const toasts = recordToasts();
    const { result } = render();
    const added = sweepFive(result, toasts);
    act(() => {
      result.current.moveExpression('e2', -1);
    });
    undo(added);
    expect(ids(result)).toEqual(['e0', 'e1', 'e2']);
  });
});

describe('AppContext note patch', () => {
  function seedOne(note?: string) {
    seedRows([row(0, note === undefined ? {} : { note })]);
  }

  it('stores the note trimmed', () => {
    seedOne();
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { note: '  d10 spiked too hard  ' });
    });
    expect(at(result, 0).note).toBe('d10 spiked too hard');
  });

  it('removes the key when the note is cleared to an empty string', () => {
    seedOne('old note');
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { note: '' });
    });
    expect('note' in at(result, 0)).toBe(false);
  });

  // A reload trims what it reads back, so what is stored must already be
  // trimmed, or the note would change between one session and the next.
  it('does not end a note cut at the cap in a space', () => {
    seedOne();
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { note: `${'a'.repeat(199)} ${'b'.repeat(20)}` });
    });
    expect(at(result, 0).note).toBe('a'.repeat(199));
  });

  it('does not cut an emoji in half at the cap', () => {
    seedOne();
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { note: `${'a'.repeat(199)}\u{1F3B2}b` });
    });
    expect(at(result, 0).note).toBe('a'.repeat(199));
  });

  it('removes the key when the note is only whitespace', () => {
    seedOne('old note');
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { note: '   ' });
    });
    expect('note' in at(result, 0)).toBe(false);
  });

  it('removes the key when the patch passes undefined', () => {
    seedOne('old note');
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { note: undefined });
    });
    expect('note' in at(result, 0)).toBe(false);
  });

  it(`cuts a note longer than ${MAX_NOTE_LENGTH} characters at the cap`, () => {
    seedOne();
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { note: 'a'.repeat(250) });
    });
    expect(at(result, 0).note).toBe('a'.repeat(MAX_NOTE_LENGTH));
  });

  it('leaves the note alone when the patch does not mention it', () => {
    seedOne('keep me');
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { mods: [{ op: 'add', value: 3 }] });
    });
    expect(at(result, 0).note).toBe('keep me');
    expect(at(result, 0).mods).toEqual([{ op: 'add', value: 3 }]);
  });

  it('keeps the note through a reload', () => {
    seedOne();
    vi.useFakeTimers();
    const { result, unmount } = render();
    act(() => {
      result.current.updateExpression('e0', { note: 'v2: d8' });
    });
    const second = reload(unmount);
    expect(at(second, 0).note).toBe('v2: d8');
  });

  it('a cleared note leaves no key on the persisted row', () => {
    seedOne('old note');
    vi.useFakeTimers();
    const { result } = render();
    act(() => {
      result.current.updateExpression('e0', { note: '' });
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    const persisted = persistedRows()[0];
    expect(persisted).toBeDefined();
    expect(persisted !== undefined && 'note' in persisted).toBe(false);
  });

  it('a note cut at the cap survives a reload rather than dropping the table', () => {
    seedOne();
    vi.useFakeTimers();
    const { result, unmount } = render();
    act(() => {
      result.current.updateExpression('e0', { note: 'a'.repeat(MAX_NOTE_LENGTH + 50) });
    });
    const second = reload(unmount);
    expect(second.current.expressions).toHaveLength(1);
    expect(at(second, 0).note).toBe('a'.repeat(MAX_NOTE_LENGTH));
  });
});

describe('AppContext import after the insert refactor', () => {
  it('still appends imported rows at the end and dedupes their names', () => {
    seedRows([row(0, { name: 'Longbow' }), row(1)]);
    const { result } = render();
    act(() => {
      result.current.addExpressions([
        row(0, { name: 'Longbow' }),
        row(1, { name: 'Longbow' }),
        row(2, { name: 'Dagger' }),
      ]);
    });
    expect(names(result)).toEqual(['Longbow', 'Row 1', 'Longbow (2)', 'Longbow (3)', 'Dagger']);
  });

  it('re-ids imported rows even when their ids collide with existing ones', () => {
    seedRows([row(0), row(1)]);
    const { result } = render();
    act(() => {
      result.current.addExpressions([row(0, { name: 'Imported' })]);
    });
    expect(new Set(ids(result)).size).toBe(3);
    expect(at(result, 2).id).not.toBe('e0');
    expect(at(result, 2).parts[0]!.id).not.toBe('p0');
  });

  it('keeps existing rows the same objects and collapses the editor', () => {
    seedRows([row(0), row(1)]);
    const { result } = render();
    act(() => {
      result.current.setExpandedId('e0');
    });
    const before = result.current.expressions;
    act(() => {
      result.current.addExpressions([row(5)]);
    });
    expect(at(result, 0)).toBe(before[0]);
    expect(at(result, 1)).toBe(before[1]);
    expect(result.current.expandedId).toBeNull();
  });

  it('keeps the notes on imported rows', () => {
    seedRows([row(0)]);
    const { result } = render();
    act(() => {
      result.current.addExpressions([row(1, { note: 'from the shared table' })]);
    });
    expect(at(result, 1).note).toBe('from the shared table');
  });
});

describe('order and notes leaving and re-entering a table', () => {
  function buildTable(result: Hook) {
    act(() => {
      result.current.updateExpression('e0', { note: 'first note' });
      result.current.updateExpression('e2', { note: 'third note' });
    });
    act(() => {
      result.current.moveExpression('e2', -1);
    });
  }

  it('a share link carries the moved order and the notes into a fresh table', () => {
    seedRows(rows(3));
    const { result } = render();
    buildTable(result);
    const hash = encodeRollsToHash(result.current.expressions);
    window.localStorage.clear();
    const fresh = render().result;
    const decoded = decodeFromHashFragment(hash);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    act(() => {
      fresh.current.replaceExpressions(decoded.rolls);
    });
    expect(names(fresh)).toEqual(['Row 0', 'Row 2', 'Row 1']);
    expect(fresh.current.expressions.map((e) => e.note)).toEqual([
      'first note',
      'third note',
      undefined,
    ]);
  });

  it('a JSON export carries the moved order and the notes into a fresh table', () => {
    seedRows(rows(3));
    const { result } = render();
    buildTable(result);
    const json = encodeRollsToJson(result.current.expressions);
    window.localStorage.clear();
    const fresh = render().result;
    const decoded = decodeFromJsonString(json);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    act(() => {
      fresh.current.addExpressions(decoded.rolls);
    });
    expect(names(fresh)).toEqual(['Row 0', 'Row 2', 'Row 1']);
    expect(fresh.current.expressions.map((e) => e.note)).toEqual([
      'first note',
      'third note',
      undefined,
    ]);
  });
});
