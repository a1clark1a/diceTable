import { renderHook } from '@testing-library/react';
import { compressToEncodedURIComponent } from 'lz-string';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppProvider } from './AppContext';
import { useApp } from './useApp';
import { validateExpression, validatePersistedState } from './persistedSchema';
import { expressionDistribution } from '../engine/expression';
import { mean } from '../engine/stats';
import { decodeFromHashFragment, decodeFromJsonString } from '../share/decode';
import { encodeRollsToHash, encodeRollsToJson, HASH_PREFIX } from '../share/encode';
import type { Expression } from '../types';

type Raw = Record<string, unknown>;

// 1d20+7 against DC 15, dealing 1d8+4 on a hit and doubling its dice on a 20.
// Hand-computed mean: 0.60 x 8.5 (plain hit) + 0.05 x 13 (crit) + 0.35 x 0 = 5.75.
const CHECK_ROW_MEAN = 5.75;

function critSpec(overrides: Raw = {}): Raw {
  return {
    threshold: { direction: 'gte', value: 15 },
    effect: { parts: [{ id: 'effect-die', count: 1, sides: 8 }], flatModifier: 4 },
    onSuccess: 'full',
    onFailure: 'none',
    crit: { onFaces: [20], effect: 'doubleDice' },
    ...overrides,
  };
}

function specWithoutCrit(overrides: Raw = {}): Raw {
  const spec = critSpec(overrides);
  delete spec.crit;
  return spec;
}

function checkRow(overrides: Raw = {}): Raw {
  return {
    id: 'roll-1',
    name: 'Longsword',
    parts: [{ id: 'check-die', count: 1, sides: 20 }],
    flatModifier: 7,
    rollMode: 'normal',
    mode: 'check',
    check: critSpec(),
    ...overrides,
  };
}

function sumRow(overrides: Raw = {}): Raw {
  return {
    id: 'roll-2',
    name: 'Fireball',
    parts: [{ id: 'sum-die', count: 2, sides: 6 }],
    flatModifier: 1,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function envelope(expressions: unknown[], version = 4, ui: Raw = {}): Raw {
  return {
    version,
    expressions,
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [], ruling: 'gte' },
      view: 'table',
      poolTarget: 1,
      baselineId: null,
      ...ui,
    },
  };
}

const EXPECTED_CHECK_ROW: Expression = {
  id: 'roll-1',
  name: 'Longsword',
  parts: [{ id: 'check-die', count: 1, sides: 20 }],
  flatModifier: 7,
  rollMode: 'normal',
  mode: 'check',
  check: {
    threshold: { direction: 'gte', value: 15 },
    effect: { parts: [{ id: 'effect-die', count: 1, sides: 8 }], flatModifier: 4 },
    onSuccess: 'full',
    onFailure: 'none',
    crit: { onFaces: [20], effect: 'doubleDice' },
  },
};

describe('validatePersistedState with a check row', () => {
  it('returns a v4 check row intact, including its crit rule', () => {
    const state = validatePersistedState(envelope([checkRow()]));
    expect(state).not.toBeNull();
    expect(state!.version).toBe(4);
    expect(state!.expressions).toEqual([EXPECTED_CHECK_ROW]);
  });

  it('round-trips a check row through JSON without changing its mean', () => {
    const stored = JSON.parse(JSON.stringify(envelope([checkRow()]))) as unknown;
    const state = validatePersistedState(stored);
    expect(state).not.toBeNull();
    expect(mean(expressionDistribution(state!.expressions[0]!))).toBeCloseTo(
      CHECK_ROW_MEAN,
      4,
    );
  });

  it('rejects the whole envelope when a single check row is corrupt', () => {
    const corrupt = checkRow({ id: 'roll-3', mode: 'sum' });
    expect(validatePersistedState(envelope([checkRow(), corrupt]))).toBeNull();
  });

  it('normalises a v2 payload with no check to version 4', () => {
    const state = validatePersistedState(envelope([sumRow()], 2));
    expect(state).not.toBeNull();
    expect(state!.version).toBe(4);
    expect(state!.expressions).toHaveLength(1);
  });

  it('normalises a v3 payload with no check to version 4', () => {
    const state = validatePersistedState(envelope([sumRow()], 3));
    expect(state).not.toBeNull();
    expect(state!.version).toBe(4);
    expect(state!.expressions[0]!.mode).toBe('sum');
  });

  it('leaves a v2 row with no mode field reading as a sum row', () => {
    const legacy = sumRow();
    delete legacy.mode;
    const state = validatePersistedState(envelope([legacy], 2));
    expect(state!.expressions[0]!.mode).toBe('sum');
  });
});

describe('validateExpression check rejection rules', () => {
  it('rejects a crit on a check whose single part rolls two dice', () => {
    expect(
      validateExpression(checkRow({ parts: [{ id: 'check-die', count: 2, sides: 20 }] })),
    ).toBeNull();
  });

  it('rejects a crit on a check built from two parts', () => {
    expect(
      validateExpression(
        checkRow({
          parts: [
            { id: 'check-die', count: 1, sides: 20 },
            { id: 'extra-die', count: 1, sides: 4 },
          ],
        }),
      ),
    ).toBeNull();
  });

  it('rejects a crit with an empty face list', () => {
    expect(
      validateExpression(
        checkRow({ check: critSpec({ crit: { onFaces: [], effect: 'doubleDice' } }) }),
      ),
    ).toBeNull();
  });

  it('rejects a crit face below 1', () => {
    expect(
      validateExpression(
        checkRow({ check: critSpec({ crit: { onFaces: [0], effect: 'doubleDice' } }) }),
      ),
    ).toBeNull();
    expect(
      validateExpression(
        checkRow({ check: critSpec({ crit: { onFaces: [-3], effect: 'doubleDice' } }) }),
      ),
    ).toBeNull();
  });

  it('rejects a fractional crit face', () => {
    expect(
      validateExpression(
        checkRow({ check: critSpec({ crit: { onFaces: [19.5], effect: 'doubleDice' } }) }),
      ),
    ).toBeNull();
  });

  it('rejects an unknown crit effect', () => {
    expect(
      validateExpression(
        checkRow({ check: critSpec({ crit: { onFaces: [20], effect: 'tripleDice' } }) }),
      ),
    ).toBeNull();
  });

  it('rejects a crit that is not an object', () => {
    expect(validateExpression(checkRow({ check: critSpec({ crit: null }) }))).toBeNull();
    expect(validateExpression(checkRow({ check: critSpec({ crit: 20 }) }))).toBeNull();
  });

  it('rejects a crit whose face list is not an array', () => {
    expect(
      validateExpression(
        checkRow({ check: critSpec({ crit: { onFaces: 20, effect: 'doubleDice' } }) }),
      ),
    ).toBeNull();
  });

  it('rejects a check row carrying no check', () => {
    const row = checkRow();
    delete row.check;
    expect(validateExpression(row)).toBeNull();
  });

  it('rejects a check row whose check is not an object', () => {
    expect(validateExpression(checkRow({ check: 'gte 15' }))).toBeNull();
  });

  it('rejects a sum row carrying a check', () => {
    expect(validateExpression(checkRow({ mode: 'sum' }))).toBeNull();
  });

  it('rejects a legacy row with no mode field carrying a check', () => {
    const row = checkRow();
    delete row.mode;
    expect(validateExpression(row)).toBeNull();
  });

  it('rejects a pool row carrying a check', () => {
    expect(
      validateExpression(
        checkRow({
          mode: 'pool',
          successThreshold: { direction: 'gte', value: 5 },
        }),
      ),
    ).toBeNull();
  });

  it('rejects keepAcross on a check row', () => {
    expect(
      validateExpression(checkRow({ keepAcross: { type: 'highest', n: 1 } })),
    ).toBeNull();
  });

  it('rejects an effect carrying both keepAcross and a per-part keep', () => {
    expect(
      validateExpression(
        checkRow({
          check: critSpec({
            effect: {
              parts: [
                { id: 'effect-die', count: 2, sides: 8, keep: { type: 'highest', n: 1 } },
                { id: 'effect-die-2', count: 1, sides: 6 },
              ],
              flatModifier: 0,
              keepAcross: { type: 'highest', n: 1 },
            },
          }),
        }),
      ),
    ).toBeNull();
  });

  it('rejects an effect with zero parts', () => {
    expect(
      validateExpression(
        checkRow({ check: critSpec({ effect: { parts: [], flatModifier: 4 } }) }),
      ),
    ).toBeNull();
  });

  it('rejects an effect whose parts are not an array', () => {
    expect(
      validateExpression(
        checkRow({ check: critSpec({ effect: { parts: 'd8', flatModifier: 4 } }) }),
      ),
    ).toBeNull();
  });

  it('rejects an effect part with fewer than two sides', () => {
    expect(
      validateExpression(
        checkRow({
          check: critSpec({
            effect: {
              parts: [{ id: 'effect-die', count: 1, sides: 1 }],
              flatModifier: 0,
            },
          }),
        }),
      ),
    ).toBeNull();
  });

  it('rejects a non-finite effect modifier', () => {
    const effect = (flatModifier: number): Raw => ({
      parts: [{ id: 'effect-die', count: 1, sides: 8 }],
      flatModifier,
    });
    expect(
      validateExpression(checkRow({ check: critSpec({ effect: effect(NaN) }) })),
    ).toBeNull();
    expect(
      validateExpression(checkRow({ check: critSpec({ effect: effect(Infinity) }) })),
    ).toBeNull();
    expect(
      validateExpression(checkRow({ check: critSpec({ effect: effect(-Infinity) }) })),
    ).toBeNull();
  });

  it('rejects an unknown scale on success', () => {
    expect(
      validateExpression(checkRow({ check: critSpec({ onSuccess: 'double' }) })),
    ).toBeNull();
  });

  it('rejects an unknown scale on failure', () => {
    expect(
      validateExpression(checkRow({ check: critSpec({ onFailure: 'quarter' }) })),
    ).toBeNull();
  });

  it('rejects a check with no scale on success', () => {
    const spec = critSpec();
    delete spec.onSuccess;
    expect(validateExpression(checkRow({ check: spec }))).toBeNull();
  });

  it('rejects a check with no scale on failure', () => {
    const spec = critSpec();
    delete spec.onFailure;
    expect(validateExpression(checkRow({ check: spec }))).toBeNull();
  });

  it('rejects a check with no threshold', () => {
    const spec = critSpec();
    delete spec.threshold;
    expect(validateExpression(checkRow({ check: spec }))).toBeNull();
  });

  it('rejects a threshold value below 1', () => {
    expect(
      validateExpression(
        checkRow({ check: critSpec({ threshold: { direction: 'gte', value: 0 } }) }),
      ),
    ).toBeNull();
  });

  it('rejects a fractional threshold value', () => {
    expect(
      validateExpression(
        checkRow({ check: critSpec({ threshold: { direction: 'gte', value: 15.5 } }) }),
      ),
    ).toBeNull();
  });

  it('rejects an effect part rolling zero dice', () => {
    expect(
      validateExpression(
        checkRow({
          check: critSpec({
            effect: {
              parts: [{ id: 'effect-die', count: 0, sides: 8 }],
              flatModifier: 4,
            },
          }),
        }),
      ),
    ).toBeNull();
  });

  it('rejects an unknown threshold direction', () => {
    expect(
      validateExpression(
        checkRow({ check: critSpec({ threshold: { direction: 'near', value: 15 } }) }),
      ),
    ).toBeNull();
  });
});

describe('validateExpression check rows that stay valid', () => {
  it('accepts a multi-die check with no crit', () => {
    const row = validateExpression(
      checkRow({
        parts: [{ id: 'check-die', count: 2, sides: 6 }],
        check: specWithoutCrit(),
      }),
    );
    expect(row).not.toBeNull();
    expect(row!.check!.crit).toBeUndefined();
  });

  it('accepts a two-part check with no crit', () => {
    const row = validateExpression(
      checkRow({
        parts: [
          { id: 'check-die', count: 1, sides: 20 },
          { id: 'extra-die', count: 1, sides: 4 },
        ],
        check: specWithoutCrit(),
      }),
    );
    expect(row).not.toBeNull();
    expect(row!.parts).toHaveLength(2);
  });

  it('accepts a crit on face 1, the lowest legal face', () => {
    const row = validateExpression(
      checkRow({ check: critSpec({ crit: { onFaces: [1], effect: 'extraDie' } }) }),
    );
    expect(row!.check!.crit).toEqual({ onFaces: [1], effect: 'extraDie' });
  });

  it('accepts a crit spanning several faces', () => {
    const row = validateExpression(
      checkRow({ check: critSpec({ crit: { onFaces: [19, 20], effect: 'maxPlusRoll' } }) }),
    );
    expect(row!.check!.crit).toEqual({ onFaces: [19, 20], effect: 'maxPlusRoll' });
  });

  it('accepts an effect keeping across its parts when no part keeps its own', () => {
    const row = validateExpression(
      checkRow({
        check: specWithoutCrit({
          effect: {
            parts: [
              { id: 'effect-die', count: 1, sides: 8 },
              { id: 'effect-die-2', count: 1, sides: 6 },
            ],
            flatModifier: 0,
            keepAcross: { type: 'highest', n: 1 },
          },
        }),
      }),
    );
    expect(row!.check!.effect.keepAcross).toEqual({ type: 'highest', n: 1 });
  });

  it('accepts a zero effect modifier', () => {
    const row = validateExpression(
      checkRow({
        check: specWithoutCrit({
          effect: { parts: [{ id: 'effect-die', count: 1, sides: 8 }], flatModifier: 0 },
        }),
      }),
    );
    expect(row!.check!.effect.flatModifier).toBe(0);
  });

  it('accepts a negative effect modifier', () => {
    const row = validateExpression(
      checkRow({
        check: specWithoutCrit({
          effect: { parts: [{ id: 'effect-die', count: 1, sides: 8 }], flatModifier: -2 },
        }),
      }),
    );
    expect(row!.check!.effect.flatModifier).toBe(-2);
  });

  it('accepts an lte threshold on a check row', () => {
    const row = validateExpression(
      checkRow({ check: specWithoutCrit({ threshold: { direction: 'lte', value: 8 } }) }),
    );
    expect(row!.check!.threshold).toEqual({ direction: 'lte', value: 8 });
  });

  it('accepts a threshold of 1, the lowest legal value', () => {
    const row = validateExpression(
      checkRow({ check: specWithoutCrit({ threshold: { direction: 'gte', value: 1 } }) }),
    );
    expect(row!.check!.threshold).toEqual({ direction: 'gte', value: 1 });
  });

  it('copies the crit face list instead of aliasing the stored array', () => {
    const faces = [20];
    const row = validateExpression(
      checkRow({ check: critSpec({ crit: { onFaces: faces, effect: 'doubleDice' } }) }),
    );
    faces.push(19);
    expect(row!.check!.crit!.onFaces).toEqual([20]);
  });

  it('accepts a pool row once its stray check is gone', () => {
    const row = checkRow({
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 5 },
    });
    delete row.check;
    const validated = validateExpression(row);
    expect(validated).not.toBeNull();
    expect(validated!.mode).toBe('pool');
  });
});

describe('AppProvider hydration of stored check rows', () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(AppProvider, null, children);

  function seed(expressions: unknown[], ui: Raw = {}): void {
    window.localStorage.setItem(
      'dicetable.v2',
      JSON.stringify({ version: 2, value: envelope(expressions, 4, ui) }),
    );
  }

  afterEach(() => {
    window.localStorage.clear();
  });

  it('loads a stored check row with its crit rule and its stored chart view', () => {
    seed([checkRow()], { chartView: 'cdf' });
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.expressions).toEqual([EXPECTED_CHECK_ROW]);
    expect(result.current.chartView).toBe('cdf');
  });

  it('falls back to an empty table when one stored row is corrupt', () => {
    seed([checkRow(), checkRow({ id: 'roll-3', mode: 'sum' })], { chartView: 'cdf' });
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.expressions).toEqual([]);
    // An empty table alone is also what a table that never loaded looks like, so
    // the stored chart view has to fall back too before this proves the whole
    // envelope was rejected rather than just the bad row dropped.
    expect(result.current.chartView).toBe('pmf');
  });
});

describe('share links carrying a check row', () => {
  function legacyHash(payload: unknown): string {
    return HASH_PREFIX + compressToEncodedURIComponent(JSON.stringify(payload));
  }

  it('survives an encode and decode round trip with the same mean', () => {
    const row = validateExpression(checkRow());
    expect(row).not.toBeNull();
    const decoded = decodeFromHashFragment(encodeRollsToHash([row!]));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(mean(expressionDistribution(decoded.rolls[0]!))).toBeCloseTo(CHECK_ROW_MEAN, 4);
  });

  it('keeps the crit rule intact through a link', () => {
    const row = validateExpression(checkRow());
    const decoded = decodeFromHashFragment(encodeRollsToHash([row!]));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.rolls).toEqual([EXPECTED_CHECK_ROW]);
  });

  it('keeps a check row intact through the JSON export', () => {
    const row = validateExpression(checkRow());
    const decoded = decodeFromJsonString(encodeRollsToJson([row!]));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.rolls).toEqual([EXPECTED_CHECK_ROW]);
  });

  it('rejects a link whose check row is corrupt', () => {
    const hash = legacyHash({
      format: 'dicetable-rolls',
      exportVersion: 3,
      rolls: [checkRow({ check: critSpec({ onSuccess: 'double' }) })],
    });
    const decoded = decodeFromHashFragment(hash);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.error).toBe('invalid-shape');
  });

  it('still imports a v1 link written before modes existed', () => {
    const hash = legacyHash({
      format: 'dicetable-rolls',
      exportVersion: 1,
      rolls: [
        {
          id: 'old-1',
          name: 'Longbow',
          parts: [{ id: 'old-part', count: 1, sides: 20 }],
          flatModifier: 5,
          rollMode: 'normal',
        },
      ],
    });
    const decoded = decodeFromHashFragment(hash);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.rolls[0]!.mode).toBe('sum');
    expect(decoded.rolls[0]!.check).toBeUndefined();
  });

  it('still imports a v2 link carrying a pool row', () => {
    const hash = legacyHash({
      format: 'dicetable-rolls',
      exportVersion: 2,
      rolls: [
        {
          id: 'old-2',
          name: 'Dice pool',
          parts: [{ id: 'old-part', count: 5, sides: 6 }],
          flatModifier: 0,
          rollMode: 'normal',
          mode: 'pool',
          successThreshold: { direction: 'gte', value: 5 },
        },
      ],
    });
    const decoded = decodeFromHashFragment(hash);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.rolls[0]!.mode).toBe('pool');
    expect(decoded.rolls[0]!.successThreshold).toEqual({ direction: 'gte', value: 5 });
  });
});
