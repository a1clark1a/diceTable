import { describe, expect, it } from 'vitest';
import type { Expression } from '../types';
import {
  buildExportEnvelope,
  EXPORT_FORMAT_TAG,
  EXPORT_VERSION,
  validateExportPayload,
} from './format';

/**
 * Ids do not travel any more: the wire drops them and the importer fills fresh
 * ones in, because both import paths replace them on arrival regardless. So a
 * round trip is equal in everything except the ids, and every arriving row and
 * part still has to carry one.
 */
function omitId(v: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(v as Record<string, unknown>) };
  delete out.id;
  return out;
}

function stripIds(rolls: readonly unknown[]): unknown[] {
  return rolls.map((r) => {
    const row = r as Record<string, unknown>;
    const out = omitId(row);
    if (Array.isArray(row.parts)) out.parts = row.parts.map(omitId);
    const check = row.check as Record<string, unknown> | undefined;
    const effect = check?.effect as Record<string, unknown> | undefined;
    if (check && effect && Array.isArray(effect.parts)) {
      out.check = { ...check, effect: { ...effect, parts: effect.parts.map(omitId) } };
    }
    return out;
  });
}

function expectSameRolls(actual: readonly unknown[], expected: readonly unknown[]): void {
  expect(stripIds(actual)).toEqual(stripIds(expected));
  for (const r of actual) {
    const row = r as Record<string, unknown>;
    expect(typeof row.id).toBe('string');
    expect((row.id as string).length).toBeGreaterThan(0);
  }
}

const sampleExpr: Expression = {
  id: 'expr-1',
  name: 'Longbow',
  parts: [{ id: 'part-1', count: 1, sides: 20 }],
  flatModifier: 5,
  rollMode: 'normal',
  mode: 'sum',
};

describe('buildExportEnvelope', () => {
  it('produces an envelope with the format tag and version', () => {
    const env = buildExportEnvelope([sampleExpr]);
    expect(env.format).toBe(EXPORT_FORMAT_TAG);
    expect(env.exportVersion).toBe(EXPORT_VERSION);
    // The envelope deliberately carries no ids, so compare on everything else.
    expect(stripIds(env.rolls)).toEqual(stripIds([sampleExpr]));
    expect((env.rolls[0] as unknown as Record<string, unknown>).id).toBeUndefined();
  });
});

describe('validateExportPayload', () => {
  it('accepts a valid envelope and returns its rolls', () => {
    const env = buildExportEnvelope([sampleExpr]);
    expectSameRolls(validateExportPayload(env) ?? [], [sampleExpr]);
  });

  it('accepts an empty rolls array', () => {
    const env = buildExportEnvelope([]);
    expect(validateExportPayload(env)).toEqual([]);
  });

  it('rejects non-objects', () => {
    expect(validateExportPayload(null)).toBeNull();
    expect(validateExportPayload(undefined)).toBeNull();
    expect(validateExportPayload(42)).toBeNull();
    expect(validateExportPayload('hello')).toBeNull();
    expect(validateExportPayload([])).toBeNull();
  });

  it('rejects wrong format tag', () => {
    expect(
      validateExportPayload({
        format: 'something-else',
        exportVersion: 1,
        rolls: [sampleExpr],
      }),
    ).toBeNull();
  });

  it('rejects wrong export version', () => {
    expect(
      validateExportPayload({
        format: EXPORT_FORMAT_TAG,
        exportVersion: 999,
        rolls: [sampleExpr],
      }),
    ).toBeNull();
  });

  it('rejects when rolls is not an array', () => {
    expect(
      validateExportPayload({
        format: EXPORT_FORMAT_TAG,
        exportVersion: EXPORT_VERSION,
        rolls: 'oops',
      }),
    ).toBeNull();
  });

  it('rejects when any roll is invalid', () => {
    expect(
      validateExportPayload({
        format: EXPORT_FORMAT_TAG,
        exportVersion: EXPORT_VERSION,
        rolls: [{ ...sampleExpr, parts: [] }],
      }),
    ).toBeNull();
  });

  it('round-trips through JSON', () => {
    const env = buildExportEnvelope([sampleExpr]);
    const round = JSON.parse(JSON.stringify(env)) as unknown;
    expectSameRolls(validateExportPayload(round) ?? [], [sampleExpr]);
  });
});

describe('export format — keepAcross rows', () => {
  const keepAcrossExpr: Expression = {
    ...sampleExpr,
    parts: [
      { id: 'part-1', count: 1, sides: 8 },
      { id: 'part-2', count: 1, sides: 6 },
    ],
    keepAcross: { type: 'highest', n: 1 },
  };

  it('is on export version 4', () => {
    expect(EXPORT_VERSION).toBe(4);
  });

  it('round-trips the rule through JSON', () => {
    const env = buildExportEnvelope([keepAcrossExpr]);
    const round = JSON.parse(JSON.stringify(env)) as unknown;
    expectSameRolls(validateExportPayload(round) ?? [], [keepAcrossExpr]);
  });

  it('still imports links and files written before the rule existed', () => {
    for (const exportVersion of [1, 2]) {
      // An old payload still carries its ids, and they are kept: the importer
      // only fills one in where there is none.
      expect(
        validateExportPayload({
          format: EXPORT_FORMAT_TAG,
          exportVersion,
          rolls: [sampleExpr],
        }),
      ).toEqual([sampleExpr]);
    }
  });

  it('rejects a payload whose rule contradicts its dice', () => {
    expect(
      validateExportPayload({
        format: EXPORT_FORMAT_TAG,
        exportVersion: EXPORT_VERSION,
        rolls: [
          {
            ...keepAcrossExpr,
            parts: [{ id: 'part-1', count: 4, sides: 6, keep: { type: 'highest', n: 3 } }],
          },
        ],
      }),
    ).toBeNull();
  });
});
