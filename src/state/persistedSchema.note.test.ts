import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  validateExpression,
  validatePersistedState,
} from './persistedSchema';
import { MAX_NOTE_LENGTH, type Expression, type PersistedState } from '../types';

function rawRow(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'expr-1',
    name: 'Longsword',
    parts: [{ id: 'part-1', count: 1, sides: 8 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    mods: [{ op: 'add', value: 3 }],
    ...extra,
  };
}

function validated(extra: Record<string, unknown>): Expression | null {
  return validateExpression(rawRow(extra));
}

const payloadWithoutNotes: PersistedState = {
  version: SCHEMA_VERSION,
  expressions: [
    {
      id: 'expr-1',
      name: '4d6kh3 + 2',
      parts: [{ id: 'part-1', count: 4, sides: 6, keep: { type: 'highest', n: 3 } }],
      flatModifier: 0,
      rollMode: 'advantage',
      mode: 'sum',
      mods: [{ op: 'add', value: 2 }],
    },
    {
      id: 'expr-2',
      name: 'Pool',
      parts: [{ id: 'part-2', count: 5, sides: 10 }],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 8 },
    },
  ],
  ui: {
    expandedId: 'expr-1',
    chartViews: { totals: 'pmf', successes: 'pmf', shape: 'pmf' },
    target: { values: [15], ruling: 'gte' },
    view: 'table',
    poolTargets: [1],
    baselineId: 'expr-2',
    targetSubView: 'grid',
    targetFilter: 'all',
    targetSort: null,
    rollOffSort: 'win',
  },
};

describe('validateExpression — note', () => {
  it('keeps a note', () => {
    expect(validated({ note: 'v2: d8, the d10 spiked too hard' })?.note).toBe(
      'v2: d8, the d10 spiked too hard',
    );
  });

  it('trims surrounding whitespace from a note', () => {
    expect(validated({ note: '  v2: d8 \n' })?.note).toBe('v2: d8');
  });

  it(`accepts a note of exactly ${MAX_NOTE_LENGTH} characters`, () => {
    const note = 'n'.repeat(MAX_NOTE_LENGTH);
    expect(validated({ note })?.note).toBe(note);
  });

  it(`rejects a note of ${MAX_NOTE_LENGTH + 1} characters`, () => {
    expect(validated({ note: 'n'.repeat(MAX_NOTE_LENGTH + 1) })).toBeNull();
  });

  it(`measures the cap after trimming, so padding around ${MAX_NOTE_LENGTH} characters is accepted`, () => {
    const note = 'n'.repeat(MAX_NOTE_LENGTH);
    expect(validated({ note: `   ${note}   ` })?.note).toBe(note);
  });

  it(`rejects ${MAX_NOTE_LENGTH + 1} characters even when wrapped in whitespace`, () => {
    expect(validated({ note: ` ${'n'.repeat(MAX_NOTE_LENGTH + 1)} ` })).toBeNull();
  });

  it.each([
    ['a number', 42],
    ['null', null],
    ['a boolean', true],
    ['an array', ['v2']],
    ['an object', { text: 'v2' }],
  ])('rejects a note that is %s', (_label, note) => {
    expect(validated({ note })).toBeNull();
  });

  it('drops an empty note instead of storing an empty key', () => {
    const expr = validated({ note: '' });
    expect(expr).not.toBeNull();
    expect(expr !== null && 'note' in expr).toBe(false);
  });

  it('drops a whitespace-only note', () => {
    const expr = validated({ note: ' \t\n ' });
    expect(expr).not.toBeNull();
    expect(expr !== null && 'note' in expr).toBe(false);
  });

  it('adds no note key to a row written without one', () => {
    const expr = validateExpression(rawRow());
    expect(expr).not.toBeNull();
    expect(expr !== null && 'note' in expr).toBe(false);
  });

  it('keeps the note on a pool row and on a check row', () => {
    const pool = validated({
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 6 },
      note: 'pool note',
    });
    const check = validated({
      mode: 'check',
      parts: [{ id: 'part-1', count: 1, sides: 20 }],
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [{ id: 'fx', count: 1, sides: 8 }], flatModifier: 3 },
        onSuccess: 'full',
        onFailure: 'none',
      },
      note: 'check note',
    });
    expect(pool?.note).toBe('pool note');
    expect(check?.note).toBe('check note');
  });

  it('a note changes nothing else about the row', () => {
    const withNote = validated({ note: 'why' });
    const without = validateExpression(rawRow());
    expect(withNote).not.toBeNull();
    if (withNote === null) return;
    const rest: Record<string, unknown> = { ...withNote };
    delete rest.note;
    expect(rest).toEqual(without);
  });
});

describe('validatePersistedState — note', () => {
  it('loads a payload written before notes existed unchanged', () => {
    const round = JSON.parse(JSON.stringify(payloadWithoutNotes)) as unknown;
    const result = validatePersistedState(round);
    expect(result).toEqual(payloadWithoutNotes);
    for (const expr of result?.expressions ?? []) {
      expect('note' in expr).toBe(false);
    }
  });

  it('keeps notes through a JSON round trip of the saved table', () => {
    const withNotes: PersistedState = {
      ...payloadWithoutNotes,
      expressions: payloadWithoutNotes.expressions.map((e, i) => ({
        ...e,
        note: `note ${i}`,
      })),
    };
    const round = JSON.parse(JSON.stringify(withNotes)) as unknown;
    expect(validatePersistedState(round)?.expressions.map((e) => e.note)).toEqual([
      'note 0',
      'note 1',
    ]);
  });

  it('keeps the saved row order', () => {
    const reversed: PersistedState = {
      ...payloadWithoutNotes,
      expressions: [...payloadWithoutNotes.expressions].reverse(),
    };
    const round = JSON.parse(JSON.stringify(reversed)) as unknown;
    expect(validatePersistedState(round)?.expressions.map((e) => e.id)).toEqual([
      'expr-2',
      'expr-1',
    ]);
  });

  // Same contract as every other corrupt field: one unreadable row refuses the
  // whole envelope. The editor caps the field, so only a hand edit reaches this.
  it(`refuses a saved table holding a note over ${MAX_NOTE_LENGTH} characters`, () => {
    const corrupt = {
      ...payloadWithoutNotes,
      expressions: [
        payloadWithoutNotes.expressions[0],
        { ...payloadWithoutNotes.expressions[1], note: 'n'.repeat(MAX_NOTE_LENGTH + 1) },
      ],
    };
    expect(validatePersistedState(corrupt)).toBeNull();
  });
});
