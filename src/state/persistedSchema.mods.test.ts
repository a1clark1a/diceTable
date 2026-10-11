import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  validateExpression,
  validatePersistedState,
} from './persistedSchema';
import { normalizeExpression } from './normalize';
import { expressionDistribution } from '../engine/expression';
import { mean } from '../engine/stats';
import type { Distribution, Expression, PersistedState } from '../types';

type Raw = Record<string, unknown>;

function sumRow(overrides: Raw = {}): Raw {
  return {
    id: 'sum-1',
    name: 'Shortsword',
    parts: [{ id: 'sum-die', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function poolRow(overrides: Raw = {}): Raw {
  return {
    id: 'pool-1',
    name: 'Shadowrun test',
    parts: [{ id: 'pool-die', count: 3, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 5 },
    ...overrides,
  };
}

function checkRow(overrides: Raw = {}): Raw {
  return {
    id: 'check-1',
    name: 'Longsword',
    parts: [{ id: 'check-die', count: 1, sides: 20 }],
    flatModifier: 5,
    rollMode: 'normal',
    mode: 'check',
    check: {
      threshold: { direction: 'gte', value: 15 },
      effect: { parts: [{ id: 'effect-die', count: 1, sides: 8 }], flatModifier: 4 },
      onSuccess: 'full',
      onFailure: 'none',
    },
    ...overrides,
  };
}

// The same rows as an explicit chain, for comparing a migrated row against what
// it should now mean.
function chainRow(overrides: Partial<Expression>): Expression {
  return {
    id: 'reference',
    name: 'Reference',
    parts: [{ id: 'ref-die', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function validRow(raw: Raw): Expression {
  const row = validateExpression(raw);
  expect(row).not.toBeNull();
  return row!;
}

function expectSameDistribution(actual: Distribution, expected: Distribution): void {
  const keys = (d: Distribution) => [...d.keys()].sort((a, b) => a - b);
  expect(keys(actual)).toEqual(keys(expected));
  for (const [k, p] of expected) {
    expect(actual.get(k)).toBeCloseTo(p, 12);
  }
}

describe('validateExpression with a modifier chain', () => {
  it('accepts a sum row carrying a valid three-step chain', () => {
    const mods = [
      { op: 'add', value: 3 },
      { op: 'mul', value: 2 },
      { op: 'div', value: 3 },
    ];
    expect(validRow(sumRow({ mods })).mods).toEqual(mods);
  });

  it('accepts a pool row carrying a chain', () => {
    const mods = [{ op: 'sub', value: 1 }];
    expect(validRow(poolRow({ mods })).mods).toEqual(mods);
  });

  it('accepts a multiplier of 100 and a divisor of 1, the ends of the range', () => {
    const mods = [
      { op: 'mul', value: 100 },
      { op: 'div', value: 1 },
    ];
    expect(validRow(sumRow({ mods })).mods).toEqual(mods);
  });

  it('stores an empty chain as no chain', () => {
    expect('mods' in validRow(sumRow({ mods: [] }))).toBe(false);
  });

  it('rejects a chain of four steps', () => {
    const mods = [
      { op: 'add', value: 1 },
      { op: 'add', value: 1 },
      { op: 'add', value: 1 },
      { op: 'add', value: 1 },
    ];
    expect(validateExpression(sumRow({ mods }))).toBeNull();
  });

  it('rejects a step with an unknown operation', () => {
    expect(validateExpression(sumRow({ mods: [{ op: 'pow', value: 2 }] }))).toBeNull();
  });

  it('rejects a divide by 0', () => {
    expect(validateExpression(sumRow({ mods: [{ op: 'div', value: 0 }] }))).toBeNull();
  });

  it('rejects a multiplier of 101', () => {
    expect(validateExpression(sumRow({ mods: [{ op: 'mul', value: 101 }] }))).toBeNull();
  });

  it('rejects a multiplier of 2.5', () => {
    expect(validateExpression(sumRow({ mods: [{ op: 'mul', value: 2.5 }] }))).toBeNull();
  });

  it('rejects a step whose value is a string', () => {
    expect(validateExpression(sumRow({ mods: [{ op: 'add', value: '2' }] }))).toBeNull();
  });

  it('rejects a step that is not an object', () => {
    expect(validateExpression(sumRow({ mods: ['+2'] }))).toBeNull();
  });

  it('rejects a lone step object in place of a chain', () => {
    expect(validateExpression(sumRow({ mods: { op: 'add', value: 2 } }))).toBeNull();
  });

  it('rejects a string in place of a chain', () => {
    expect(validateExpression(sumRow({ mods: '+2' }))).toBeNull();
  });

  it('rejects a sum row carrying both a modifier and a chain', () => {
    const raw = sumRow({ flatModifier: 2, mods: [{ op: 'mul', value: 2 }] });
    expect(validateExpression(raw)).toBeNull();
  });

  it('rejects a pool row carrying both a modifier and a chain', () => {
    const raw = poolRow({ flatModifier: 1, mods: [{ op: 'add', value: 1 }] });
    expect(validateExpression(raw)).toBeNull();
  });

  it('reads a legacy modifier beside an empty chain as that modifier alone', () => {
    const row = validRow(sumRow({ flatModifier: 2, mods: [] }));
    expect(row.mods).toEqual([{ op: 'add', value: 2 }]);
  });

  it('keeps a check row and drops the chain left on it', () => {
    const row = validRow(checkRow({ mods: [{ op: 'mul', value: 2 }] }));
    expect('mods' in row).toBe(false);
  });

  it('keeps the check roll modifier when it drops a check row chain', () => {
    expect(validRow(checkRow({ mods: [{ op: 'mul', value: 2 }] })).flatModifier).toBe(5);
  });

  it('drops a broken chain on a check row rather than rejecting the row', () => {
    const row = validateExpression(checkRow({ mods: [{ op: 'div', value: 0 }] }));
    expect(row).not.toBeNull();
    expect(row?.mods).toBeUndefined();
  });
});

describe('validateExpression migrating a legacy modifier', () => {
  it('moves a sum row modifier to the front of its chain', () => {
    const row = validRow(sumRow({ flatModifier: 3 }));
    expect(row.mods).toEqual([{ op: 'add', value: 3 }]);
  });

  it('zeroes the sum row modifier it moved', () => {
    expect(validRow(sumRow({ flatModifier: 3 })).flatModifier).toBe(0);
  });

  it('moves a negative modifier as a subtract of its size', () => {
    expect(validRow(sumRow({ flatModifier: -2 })).mods).toEqual([{ op: 'sub', value: 2 }]);
  });

  it('moves a pool row modifier into its chain as automatic successes', () => {
    const row = validRow(poolRow({ flatModifier: 1 }));
    expect(row.mods).toEqual([{ op: 'add', value: 1 }]);
    expect(row.flatModifier).toBe(0);
  });

  it('leaves a check row modifier on the check roll', () => {
    const row = validRow(checkRow({ flatModifier: 5 }));
    expect(row.flatModifier).toBe(5);
    expect('mods' in row).toBe(false);
  });
});

// A table saved by the build before the chain: 2d6 + 3, 1d20 - 2 with
// advantage, 3d6 counting 5s and 6s with one success taken away, and a check.
const VERSION_6_ROWS: Raw[] = [
  sumRow({ id: 'sword', flatModifier: 3 }),
  sumRow({
    id: 'lucky',
    parts: [{ id: 'lucky-die', count: 1, sides: 20 }],
    flatModifier: -2,
    rollMode: 'advantage',
  }),
  poolRow({ id: 'pool', flatModifier: -1 }),
  checkRow({ id: 'check' }),
];

function version6Envelope(): Raw {
  return {
    version: 6,
    expressions: VERSION_6_ROWS,
    ui: {
      expandedId: null,
      chartViews: { totals: 'pmf', successes: 'pmf', shape: 'pmf' },
      target: { values: [], ruling: 'gte' },
      view: 'table',
      poolTargets: [1],
      baselineId: null,
    },
  };
}

function loaded(raw: Raw): PersistedState {
  const state = validatePersistedState(raw);
  expect(state).not.toBeNull();
  return state!;
}

function loadedRow(raw: Raw, id: string): Expression {
  const row = loaded(raw).expressions.find((e) => e.id === id);
  expect(row).toBeDefined();
  return row!;
}

describe('validatePersistedState migrating a version 6 table', () => {
  it('loads the table under the current schema version, 7', () => {
    expect(SCHEMA_VERSION).toBe(7);
    expect(loaded(version6Envelope()).version).toBe(7);
  });

  it('keeps every row', () => {
    expect(loaded(version6Envelope()).expressions.map((e) => e.id)).toEqual([
      'sword',
      'lucky',
      'pool',
      'check',
    ]);
  });

  it('moves the sum row modifier into its chain', () => {
    const row = loadedRow(version6Envelope(), 'sword');
    expect(row.mods).toEqual([{ op: 'add', value: 3 }]);
    expect(row.flatModifier).toBe(0);
  });

  it('moves the pool row modifier into its chain', () => {
    const row = loadedRow(version6Envelope(), 'pool');
    expect(row.mods).toEqual([{ op: 'sub', value: 1 }]);
    expect(row.flatModifier).toBe(0);
  });

  it('leaves the check row modifier where it was', () => {
    const row = loadedRow(version6Envelope(), 'check');
    expect(row.flatModifier).toBe(5);
    expect('mods' in row).toBe(false);
  });

  it('computes the migrated 2d6 + 3 the same as an explicit add-3 chain', () => {
    const migrated = expressionDistribution(loadedRow(version6Envelope(), 'sword'));
    const explicit = expressionDistribution(chainRow({ mods: [{ op: 'add', value: 3 }] }));
    expectSameDistribution(migrated, explicit);
  });

  it('lands the migrated 2d6 + 3 on the totals 5 to 15 with 10 the likeliest', () => {
    const dist = expressionDistribution(loadedRow(version6Envelope(), 'sword'));
    // 2d6 shows 7 six ways in 36, 2 and 12 one way each; +3 moves them to 10, 5, 15.
    expect(dist.get(10)).toBeCloseTo(6 / 36, 12);
    expect(dist.get(5)).toBeCloseTo(1 / 36, 12);
    expect(dist.get(15)).toBeCloseTo(1 / 36, 12);
    expect(dist.size).toBe(11);
    expect(mean(dist)).toBeCloseTo(10, 12);
  });

  it('computes the migrated 1d20 - 2 with advantage the same as an explicit subtract-2 chain', () => {
    const migrated = expressionDistribution(loadedRow(version6Envelope(), 'lucky'));
    const explicit = expressionDistribution(
      chainRow({
        parts: [{ id: 'ref-die', count: 1, sides: 20 }],
        rollMode: 'advantage',
        mods: [{ op: 'sub', value: 2 }],
      }),
    );
    expectSameDistribution(migrated, explicit);
  });

  it('keeps advantage on the migrated 1d20 - 2', () => {
    const dist = expressionDistribution(loadedRow(version6Envelope(), 'lucky'));
    // Advantage on 1d20 shows k with chance (2k - 1) / 400; -2 moves 20 to 18 and 1 to -1.
    expect(dist.get(18)).toBeCloseTo(39 / 400, 12);
    expect(dist.get(-1)).toBeCloseTo(1 / 400, 12);
    // 13.825, the advantage mean of 1d20, less 2.
    expect(mean(dist)).toBeCloseTo(11.825, 12);
  });

  it('computes the migrated pool the same as an explicit subtract-1 chain', () => {
    const migrated = expressionDistribution(loadedRow(version6Envelope(), 'pool'));
    const explicit = expressionDistribution(
      chainRow({
        parts: [{ id: 'ref-die', count: 3, sides: 6 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 5 },
        mods: [{ op: 'sub', value: 1 }],
      }),
    );
    expectSameDistribution(migrated, explicit);
  });

  it('still floors the migrated pool at zero successes', () => {
    const dist = expressionDistribution(loadedRow(version6Envelope(), 'pool'));
    // Successes on 3d6 at 1/3 each: 0, 1, 2, 3 with 8, 12, 6, 1 in 27. Taking one
    // away floors 0 and 1 onto 0 (20/27), and moves 2 and 3 to 1 and 2.
    expect(dist.get(0)).toBeCloseTo(20 / 27, 12);
    expect(dist.get(1)).toBeCloseTo(6 / 27, 12);
    expect(dist.get(2)).toBeCloseTo(1 / 27, 12);
    expect(dist.size).toBe(3);
  });
});

describe('validatePersistedState migrating a version 2 table', () => {
  // Version 2 predates pool mode, so its rows carry no mode at all.
  function version2Envelope(): Raw {
    const row = sumRow({
      id: 'old',
      parts: [{ id: 'old-die', count: 1, sides: 8 }],
      flatModifier: 2,
    });
    delete row.mode;
    return {
      version: 2,
      expressions: [row],
      ui: { expandedId: null, chartView: 'cdf', target: { value: 6 } },
    };
  }

  it('reads the modeless row as a sum row with its modifier in the chain', () => {
    const row = loadedRow(version2Envelope(), 'old');
    expect(row.mode).toBe('sum');
    expect(row.mods).toEqual([{ op: 'add', value: 2 }]);
    expect(row.flatModifier).toBe(0);
  });

  it('computes the migrated 1d8 + 2 as 3 to 10, each one in 8', () => {
    const dist = expressionDistribution(loadedRow(version2Envelope(), 'old'));
    const expected: Distribution = new Map();
    for (let total = 3; total <= 10; total++) expected.set(total, 1 / 8);
    expectSameDistribution(dist, expected);
  });
});

describe('validatePersistedState versions', () => {
  it.each([2, 3, 4, 5, 6])('moves the sum row modifier on a version %s table', (version) => {
    const row = loadedRow({ ...version6Envelope(), version }, 'sword');
    expect(row.mods).toEqual([{ op: 'add', value: 3 }]);
  });

  it('accepts a version 7 table', () => {
    expect(validatePersistedState({ ...version6Envelope(), version: 7 })).not.toBeNull();
  });

  it('refuses a version 8 table, written by a newer build', () => {
    expect(validatePersistedState({ ...version6Envelope(), version: 8 })).toBeNull();
  });
});

describe('a migrated table reloading', () => {
  // What hydration does to a loaded table, then what saving and reloading it does.
  function settle(raw: unknown): PersistedState {
    const state = validatePersistedState(raw);
    expect(state).not.toBeNull();
    return { ...state!, expressions: state!.expressions.map(normalizeExpression) };
  }

  it('is unchanged by a save and reload after migrating version 6', () => {
    const once = settle(version6Envelope());
    const twice = settle(JSON.parse(JSON.stringify(once)) as unknown);
    expect(twice).toEqual(once);
  });

  it('needs no repair after the validator migrates it', () => {
    const state = loaded(version6Envelope());
    for (const row of state.expressions) {
      expect(normalizeExpression(row)).toBe(row);
    }
  });

  it('settles a chain stored with a signed add after one reload', () => {
    const raw = {
      ...version6Envelope(),
      version: 7,
      expressions: [sumRow({ id: 'signed', mods: [{ op: 'add', value: -3 }] })],
    };
    const once = settle(raw);
    expect(once.expressions[0]?.mods).toEqual([{ op: 'sub', value: 3 }]);
    expect(settle(JSON.parse(JSON.stringify(once)) as unknown)).toEqual(once);
  });
});
