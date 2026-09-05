import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  validateExpression,
  validatePersistedState,
} from './persistedSchema';
import { MAX_TARGETS, type PersistedState } from '../types';

const validPayload: PersistedState = {
  version: SCHEMA_VERSION,
  expressions: [
    {
      id: 'expr-1',
      name: '4d6kh3 + 2',
      parts: [
        {
          id: 'part-1',
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
    expandedId: 'expr-1',
    chartView: 'cdf',
    target: { values: [15], ruling: 'gte' },
    view: 'table',
    poolTargets: [1],
    baselineId: null,
  },
};

describe('validatePersistedState', () => {
  it('accepts a fully-valid payload and returns it intact', () => {
    const result = validatePersistedState(validPayload);
    expect(result).toEqual(validPayload);
  });

  it('round-trips a JSON-serialized valid payload', () => {
    const round = JSON.parse(JSON.stringify(validPayload)) as unknown;
    const result = validatePersistedState(round);
    expect(result).toEqual(validPayload);
  });

  it('rejects non-objects', () => {
    expect(validatePersistedState(null)).toBeNull();
    expect(validatePersistedState(undefined)).toBeNull();
    expect(validatePersistedState(42)).toBeNull();
    expect(validatePersistedState('hello')).toBeNull();
    expect(validatePersistedState([])).toBeNull();
  });

  it('rejects missing or wrong version', () => {
    expect(validatePersistedState({ ...validPayload, version: undefined })).toBeNull();
    expect(validatePersistedState({ ...validPayload, version: 1 })).toBeNull();
    expect(validatePersistedState({ ...validPayload, version: '2' })).toBeNull();
  });

  it('accepts an empty expressions array (the first-run shape)', () => {
    const result = validatePersistedState({ ...validPayload, expressions: [] });
    expect(result).not.toBeNull();
    expect(result!.expressions).toEqual([]);
  });

  it('rejects when expressions is not an array', () => {
    expect(
      validatePersistedState({ ...validPayload, expressions: 'oops' }),
    ).toBeNull();
    expect(
      validatePersistedState({ ...validPayload, expressions: { 0: 'x' } }),
    ).toBeNull();
  });

  it('rejects an expression with non-string id', () => {
    expect(
      validatePersistedState({
        ...validPayload,
        expressions: [{ ...validPayload.expressions[0], id: 42 }],
      }),
    ).toBeNull();
  });

  it('rejects an expression with empty parts array', () => {
    expect(
      validatePersistedState({
        ...validPayload,
        expressions: [{ ...validPayload.expressions[0], parts: [] }],
      }),
    ).toBeNull();
  });

  it('rejects a part with non-integer count', () => {
    const expr = validPayload.expressions[0]!;
    const badPart = { ...expr.parts[0]!, count: 1.5 };
    expect(
      validatePersistedState({
        ...validPayload,
        expressions: [{ ...expr, parts: [badPart] }],
      }),
    ).toBeNull();
  });

  it('rejects a part with non-integer sides', () => {
    const expr = validPayload.expressions[0]!;
    const badPart = { ...expr.parts[0]!, sides: 'six' };
    expect(
      validatePersistedState({
        ...validPayload,
        expressions: [{ ...expr, parts: [badPart] }],
      }),
    ).toBeNull();
  });

  it('rejects an unknown rollMode', () => {
    expect(
      validatePersistedState({
        ...validPayload,
        expressions: [{ ...validPayload.expressions[0], rollMode: 'lucky' }],
      }),
    ).toBeNull();
  });

  it('rejects an invalid keep rule', () => {
    const expr = validPayload.expressions[0]!;
    const badPart = { ...expr.parts[0]!, keep: { type: 'middle', n: 2 } };
    expect(
      validatePersistedState({
        ...validPayload,
        expressions: [{ ...expr, parts: [badPart] }],
      }),
    ).toBeNull();
  });

  it('fills defaults when ui is missing entirely', () => {
    const result = validatePersistedState({
      version: 2,
      expressions: validPayload.expressions,
    });
    expect(result).not.toBeNull();
    expect(result!.ui).toEqual({
      expandedId: null,
      chartView: 'pmf',
      target: { values: [], ruling: 'gte' },
      view: 'table',
      poolTargets: [1],
      baselineId: null,
    });
  });

  it('fills defaults for individual missing ui fields', () => {
    const result = validatePersistedState({
      version: 2,
      expressions: validPayload.expressions,
      ui: { expandedId: 'expr-1' },
    });
    expect(result).not.toBeNull();
    expect(result!.ui).toEqual({
      expandedId: 'expr-1',
      chartView: 'pmf',
      target: { values: [], ruling: 'gte' },
      view: 'table',
      poolTargets: [1],
      baselineId: null,
    });
  });

  it('keeps a baselineId that matches a validated expression', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: { ...validPayload.ui, baselineId: 'expr-1' },
    });
    expect(result!.ui.baselineId).toBe('expr-1');
  });

  it('nulls a baselineId that matches no expression', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: { ...validPayload.ui, baselineId: 'expr-deleted' },
    });
    expect(result!.ui.baselineId).toBeNull();
  });

  it('nulls a non-string baselineId', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: { ...validPayload.ui, baselineId: 42 },
    });
    expect(result!.ui.baselineId).toBeNull();
  });

  it('falls back to the table view when view is unknown', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: { ...validPayload.ui, view: 'wizard' },
    });
    expect(result).not.toBeNull();
    expect(result!.ui.view).toBe('table');
  });

  it('defaults view to table when it is absent', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: {
        expandedId: null,
        chartView: 'pmf',
        target: { values: [], ruling: 'gte' },
      },
    });
    expect(result).not.toBeNull();
    expect(result!.ui.view).toBe('table');
  });

  it('preserves a valid non-default view', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: { ...validPayload.ui, view: 'rolloff' },
    });
    expect(result).not.toBeNull();
    expect(result!.ui.view).toBe('rolloff');
  });

  it('falls back to default ruling when target ruling is unknown', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: { ...validPayload.ui, target: { values: [10], ruling: 'meh' } },
    });
    expect(result).not.toBeNull();
    expect(result!.ui.target).toEqual({ values: [10], ruling: 'gte' });
  });

  it('migrates a legacy single-value target to a one-item values array', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: { ...validPayload.ui, target: { value: 10, ruling: 'gte' } },
    });
    expect(result).not.toBeNull();
    expect(result!.ui.target).toEqual({ values: [10], ruling: 'gte' });
  });

  it('migrates a legacy null target to an empty values array', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: { ...validPayload.ui, target: { value: null, ruling: 'gte' } },
    });
    expect(result).not.toBeNull();
    expect(result!.ui.target).toEqual({ values: [], ruling: 'gte' });
  });

  it('sorts target values ascending', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: {
        ...validPayload.ui,
        target: { values: [22, 13, 16], ruling: 'gte' },
      },
    });
    expect(result!.ui.target.values).toEqual([13, 16, 22]);
  });

  it('dedupes repeated target values', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: {
        ...validPayload.ui,
        target: { values: [13, 16, 13, 16, 19], ruling: 'gte' },
      },
    });
    expect(result!.ui.target.values).toEqual([13, 16, 19]);
  });

  it('caps target values at five', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: {
        ...validPayload.ui,
        target: { values: [10, 11, 12, 13, 14, 15, 16], ruling: 'gte' },
      },
    });
    expect(result!.ui.target.values).toHaveLength(5);
  });

  it('skips non-integer entries inside target values', () => {
    const result = validatePersistedState({
      ...validPayload,
      ui: {
        ...validPayload.ui,
        target: { values: [13, 1.5, '16', null, 19], ruling: 'gte' },
      },
    });
    expect(result!.ui.target.values).toEqual([13, 19]);
  });

  it('truncates expressions beyond the row cap (100)', () => {
    const seed = validPayload.expressions[0]!;
    const many = Array.from({ length: 150 }, (_, i) => ({
      ...seed,
      id: `expr-${i}`,
      parts: [{ ...seed.parts[0]!, id: `part-${i}` }],
    }));
    const result = validatePersistedState({ ...validPayload, expressions: many });
    expect(result).not.toBeNull();
    expect(result!.expressions).toHaveLength(100);
    expect(result!.expressions[0]!.id).toBe('expr-0');
    expect(result!.expressions[99]!.id).toBe('expr-99');
  });
});

describe('validatePersistedState — keepAcross', () => {
  const sumRow = validPayload.expressions[0]!;
  const withKeepAcross = (
    keepAcross: unknown,
    over: Record<string, unknown> = {},
  ): unknown => ({
    ...sumRow,
    parts: [{ id: 'p1', count: 1, sides: 8 }],
    keepAcross,
    ...over,
  });

  it('keeps a valid rule on a sum row', () => {
    const result = validatePersistedState({
      ...validPayload,
      expressions: [withKeepAcross({ type: 'highest', n: 1 })],
    });
    expect(result!.expressions[0]!.keepAcross).toEqual({ type: 'highest', n: 1 });
  });

  it('normalises an older payload up to the current schema version', () => {
    const result = validatePersistedState({ ...validPayload, version: 3 });
    expect(result!.version).toBe(SCHEMA_VERSION);
  });

  it('accepts a payload from before the rule existed', () => {
    const result = validatePersistedState({ ...validPayload, version: 2 });
    expect(result).not.toBeNull();
    expect(result!.expressions[0]!.keepAcross).toBeUndefined();
  });

  it('rejects a row carrying both keepAcross and a per-part keep', () => {
    expect(
      validateExpression(
        withKeepAcross({ type: 'highest', n: 1 }, {
          parts: [{ id: 'p1', count: 4, sides: 6, keep: { type: 'highest', n: 3 } }],
        }),
      ),
    ).toBeNull();
  });

  it('rejects keepAcross on a row that counts successes', () => {
    expect(
      validateExpression(
        withKeepAcross({ type: 'highest', n: 1 }, {
          mode: 'pool',
          successThreshold: { direction: 'gte', value: 5 },
        }),
      ),
    ).toBeNull();
  });

  it('rejects an unknown keep direction', () => {
    expect(validateExpression(withKeepAcross({ type: 'sideways', n: 1 }))).toBeNull();
  });

  it('rejects a count below one', () => {
    expect(validateExpression(withKeepAcross({ type: 'highest', n: 0 }))).toBeNull();
    expect(validateExpression(withKeepAcross({ type: 'highest', n: -3 }))).toBeNull();
  });

  it('rejects a fractional count', () => {
    expect(validateExpression(withKeepAcross({ type: 'highest', n: 1.5 }))).toBeNull();
  });

  it('rejects a non-object rule', () => {
    expect(validateExpression(withKeepAcross('highest'))).toBeNull();
    expect(validateExpression(withKeepAcross(null))).toBeNull();
  });
});

describe('validatePersistedState — pool targets', () => {
  function uiOf(ui: Record<string, unknown>): PersistedState['ui'] {
    const result = validatePersistedState({
      ...validPayload,
      ui: { ...validPayload.ui, ...ui },
    });
    expect(result).not.toBeNull();
    return result!.ui;
  }

  it('folds the legacy scalar into a one-entry list', () => {
    const { poolTargets } = uiOf({ poolTargets: undefined, poolTarget: 3 });
    expect(poolTargets).toEqual([3]);
  });

  it('accepts a version 4 envelope carrying the scalar', () => {
    const result = validatePersistedState({
      ...validPayload,
      version: 4,
      ui: { ...validPayload.ui, poolTargets: undefined, poolTarget: 3 },
    });
    expect(result!.version).toBe(SCHEMA_VERSION);
    expect(result!.ui.poolTargets).toEqual([3]);
  });

  it('dedupes, clamps, sorts and caps a stored list', () => {
    const { poolTargets } = uiOf({ poolTargets: [3, 3, 1, 0, 9, 9, 9, 9] });
    expect(poolTargets).toEqual([1, 3, 9]);
  });

  it('keeps at most MAX_TARGETS entries', () => {
    const { poolTargets } = uiOf({ poolTargets: [1, 2, 3, 4, 5, 6, 7] });
    expect(poolTargets).toHaveLength(MAX_TARGETS);
  });

  it('falls back to a single target of 1 rather than failing the envelope', () => {
    expect(uiOf({ poolTargets: 'nope' }).poolTargets).toEqual([1]);
    expect(uiOf({ poolTargets: [] }).poolTargets).toEqual([1]);
    expect(uiOf({ poolTargets: ['a', null] }).poolTargets).toEqual([1]);
    expect(
      uiOf({ poolTargets: undefined, poolTarget: 0 }).poolTargets,
    ).toEqual([1]);
  });

  it('prefers the scalar when the stored list holds nothing usable', () => {
    const { poolTargets } = uiOf({ poolTargets: [], poolTarget: 4 });
    expect(poolTargets).toEqual([4]);
  });
});
