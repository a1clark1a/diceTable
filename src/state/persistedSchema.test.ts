import { describe, expect, it } from 'vitest';
import { validatePersistedState } from './persistedSchema';
import type { PersistedState } from '../types';

const validPayload: PersistedState = {
  version: 2,
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
    },
  ],
  ui: {
    expandedId: 'expr-1',
    chartView: 'cdf',
    target: { values: [15], ruling: 'gte' },
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
    });
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
});
