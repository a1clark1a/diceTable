import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { describe, expect, it } from 'vitest';
import { expressionDistribution } from '../engine/expression';
import { sortedKeys } from '../engine/distribution';
import type { Distribution, Expression, ModStep } from '../types';
import { decodeFromHashFragment, decodeFromJsonString, type DecodeResult } from './decode';
import { encodeRollsToHash, encodeRollsToJson, HASH_PREFIX } from './encode';
import { EXPORT_FORMAT_TAG, EXPORT_VERSION, isFutureExportVersion } from './format';

/** The newest format a build from before the modifier chain can read. */
const LAST_VERSION_BEFORE_CHAIN = 4;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asLink(payload: unknown): string {
  return HASH_PREFIX + compressToEncodedURIComponent(JSON.stringify(payload));
}

function rowsOf(result: DecodeResult): Expression[] {
  if (!result.ok) throw new Error(`decode failed: ${result.error}`);
  return result.rolls;
}

function rowAt(rows: readonly Expression[], index: number): Expression {
  const row = rows[index];
  if (row === undefined) throw new Error(`no row at ${index}`);
  return row;
}

function expectDistribution(actual: Distribution, expected: Record<number, number>): void {
  const keys = Object.keys(expected)
    .map(Number)
    .sort((a, b) => a - b);
  expect(sortedKeys(actual)).toEqual(keys);
  for (const [k, p] of Object.entries(expected)) {
    expect(actual.get(Number(k))).toBeCloseTo(p, 12);
  }
}

function sumRow(mods: ModStep[] | undefined, id = 'row-sum'): Expression {
  return {
    id,
    name: 'Greatsword',
    parts: [{ id: `${id}-part`, count: 2, sides: 6 }],
    flatModifier: 0,
    ...(mods === undefined ? {} : { mods }),
    rollMode: 'normal',
    mode: 'sum',
  };
}

function poolRow(mods: ModStep[] | undefined): Expression {
  return {
    id: 'row-pool',
    name: 'Shooting',
    parts: [{ id: 'row-pool-part', count: 7, sides: 10 }],
    flatModifier: 0,
    ...(mods === undefined ? {} : { mods }),
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 8 },
  };
}

const checkRow: Expression = {
  id: 'row-check',
  name: 'Saving throw',
  parts: [{ id: 'row-check-part', count: 1, sides: 20 }],
  flatModifier: 5,
  rollMode: 'normal',
  mode: 'check',
  check: {
    threshold: { direction: 'gte', value: 15 },
    effect: { parts: [{ id: 'row-check-effect', count: 1, sides: 4 }], flatModifier: 0 },
    onSuccess: 'full',
    onFailure: 'none',
  },
};

/** What a v5 encoder puts on the wire for one row, ids already dropped. */
function wireRow(row: Expression): Record<string, unknown> {
  const parsed: unknown = JSON.parse(encodeRollsToJson([row]));
  if (!isRecord(parsed) || !Array.isArray(parsed.rolls)) throw new Error('not an envelope');
  const first: unknown = parsed.rolls[0];
  if (!isRecord(first)) throw new Error('no row on the wire');
  return first;
}

/**
 * A table as a v4 build wrote it, by hand: no ids, and each sum and pool row's
 * modifier in flatModifier, where every version before the chain kept it.
 */
const v4Payload = {
  format: EXPORT_FORMAT_TAG,
  exportVersion: 4,
  rolls: [
    {
      name: 'Greatsword',
      parts: [{ count: 2, sides: 6 }],
      flatModifier: 3,
      rollMode: 'normal',
      mode: 'sum',
    },
    {
      name: 'Pool',
      parts: [{ count: 2, sides: 6 }],
      flatModifier: -1,
      rollMode: 'normal',
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 5 },
    },
    {
      name: 'Saving throw',
      parts: [{ count: 1, sides: 20 }],
      flatModifier: 5,
      rollMode: 'normal',
      mode: 'check',
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [{ count: 1, sides: 4 }], flatModifier: 0 },
        onSuccess: 'full',
        onFailure: 'none',
      },
    },
  ],
};

describe.each([
  ['share link', () => decodeFromHashFragment(asLink(v4Payload))],
  ['JSON file', () => decodeFromJsonString(JSON.stringify(v4Payload))],
])('a v4 %s', (_label, decode) => {
  it('still opens', () => {
    expect(decode().ok).toBe(true);
  });

  it('rolls its sum row as 2d6 + 3, the way it always did', () => {
    // 2d6 lands on 2..12 in 1,2,3,4,5,6,5,4,3,2,1 ways of 36; +3 moves it to 5..15.
    const dist = expressionDistribution(rowAt(rowsOf(decode()), 0));
    expectDistribution(dist, {
      5: 1 / 36,
      6: 2 / 36,
      7: 3 / 36,
      8: 4 / 36,
      9: 5 / 36,
      10: 6 / 36,
      11: 5 / 36,
      12: 4 / 36,
      13: 3 / 36,
      14: 2 / 36,
      15: 1 / 36,
    });
  });

  it('counts its pool row with one automatic success taken away, never below zero', () => {
    // Each die succeeds on 5 or 6, a third of the time: 0, 1 or 2 successes
    // with 4/9, 4/9, 1/9. Taking one away floors the first two onto 0.
    const dist = expressionDistribution(rowAt(rowsOf(decode()), 1));
    expectDistribution(dist, { 0: 8 / 9, 1: 1 / 9 });
  });

  it('keeps its check row adding 5 to the check roll', () => {
    // d20 + 5 reaches 15 on a natural 10 or better, 11 faces of 20. A miss is
    // 0; a hit rolls the d4, so each of 1..4 is 11/20 x 1/4 = 11/80.
    const dist = expressionDistribution(rowAt(rowsOf(decode()), 2));
    expectDistribution(dist, { 0: 9 / 20, 1: 11 / 80, 2: 11 / 80, 3: 11 / 80, 4: 11 / 80 });
  });

  it('moves the sum and pool modifiers to the front of a chain', () => {
    const rows = rowsOf(decode());
    expect(rowAt(rows, 0).mods).toEqual([{ op: 'add', value: 3 }]);
    expect(rowAt(rows, 1).mods).toEqual([{ op: 'sub', value: 1 }]);
  });

  it('leaves no modifier behind in flatModifier on the sum and pool rows', () => {
    const rows = rowsOf(decode());
    expect(rowAt(rows, 0).flatModifier).toBe(0);
    expect(rowAt(rows, 1).flatModifier).toBe(0);
  });

  it('leaves the check row with its modifier and no chain', () => {
    const row = rowAt(rowsOf(decode()), 2);
    expect(row.flatModifier).toBe(5);
    expect('mods' in row).toBe(false);
  });
});

describe('the v5 encoder', () => {
  it('stamps the envelope with export version 5', () => {
    const parsed: unknown = JSON.parse(encodeRollsToJson([sumRow([{ op: 'add', value: 3 }])]));
    expect(isRecord(parsed) ? parsed.exportVersion : null).toBe(5);
  });

  it('writes a lone add as the flatModifier every version reads', () => {
    expect(wireRow(sumRow([{ op: 'add', value: 3 }])).flatModifier).toBe(3);
  });

  it('leaves the mods key off a lone add', () => {
    expect('mods' in wireRow(sumRow([{ op: 'add', value: 3 }]))).toBe(false);
  });

  it('writes a lone subtract as a negative flatModifier', () => {
    const wire = wireRow(sumRow([{ op: 'sub', value: 2 }]));
    expect(wire.flatModifier).toBe(-2);
    expect('mods' in wire).toBe(false);
  });

  it('writes a lone subtract on a pool row as a negative flatModifier', () => {
    const wire = wireRow(poolRow([{ op: 'sub', value: 1 }]));
    expect(wire.flatModifier).toBe(-1);
    expect('mods' in wire).toBe(false);
  });

  it('writes a row with no chain as flatModifier 0 and no mods', () => {
    const wire = wireRow(sumRow(undefined));
    expect(wire.flatModifier).toBe(0);
    expect('mods' in wire).toBe(false);
  });

  it('writes a chain of more than one step as mods, in order', () => {
    const chain: ModStep[] = [
      { op: 'add', value: 3 },
      { op: 'mul', value: 2 },
    ];
    expect(wireRow(sumRow(chain)).mods).toEqual(chain);
  });

  it('keeps flatModifier at 0 beside a chain of more than one step', () => {
    const wire = wireRow(
      sumRow([
        { op: 'add', value: 3 },
        { op: 'mul', value: 2 },
      ]),
    );
    expect(wire.flatModifier).toBe(0);
  });

  it('writes a lone multiply as mods, since no flatModifier means it', () => {
    const wire = wireRow(sumRow([{ op: 'mul', value: 2 }]));
    expect(wire.mods).toEqual([{ op: 'mul', value: 2 }]);
    expect(wire.flatModifier).toBe(0);
  });

  it('writes a check row modifier as it is, with no mods', () => {
    const wire = wireRow(checkRow);
    expect(wire.flatModifier).toBe(5);
    expect('mods' in wire).toBe(false);
  });
});

describe.each([
  ['share link', (rolls: Expression[]) => decodeFromHashFragment(encodeRollsToHash(rolls))],
  ['JSON file', (rolls: Expression[]) => decodeFromJsonString(encodeRollsToJson(rolls))],
])('a chain through a v5 %s', (_label, roundTrip) => {
  const chains: [string, ModStep[]][] = [
    ['a lone add', [{ op: 'add', value: 3 }]],
    ['a lone subtract', [{ op: 'sub', value: 2 }]],
    ['add then multiply', [{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]],
    ['multiply then add', [{ op: 'mul', value: 2 }, { op: 'add', value: 3 }]],
    ['a lone divide', [{ op: 'div', value: 3 }]],
    [
      'three steps',
      [
        { op: 'sub', value: 1 },
        { op: 'mul', value: 3 },
        { op: 'div', value: 2 },
      ],
    ],
  ];

  it.each(chains)('arrives on a sum row as the same chain: %s', (_name, chain) => {
    const row = rowAt(rowsOf(roundTrip([sumRow(chain)])), 0);
    expect(row.mods).toEqual(chain);
  });

  it.each(chains)('arrives on a sum row with flatModifier 0: %s', (_name, chain) => {
    const row = rowAt(rowsOf(roundTrip([sumRow(chain)])), 0);
    expect(row.flatModifier).toBe(0);
  });

  it('arrives on a pool row as the same chain', () => {
    const chain: ModStep[] = [
      { op: 'add', value: 2 },
      { op: 'mul', value: 2 },
    ];
    const row = rowAt(rowsOf(roundTrip([poolRow(chain)])), 0);
    expect(row.mods).toEqual(chain);
  });

  it('arrives with no chain when it left with none', () => {
    const row = rowAt(rowsOf(roundTrip([sumRow(undefined)])), 0);
    expect('mods' in row).toBe(false);
  });

  it('leaves a check row with its modifier and no chain', () => {
    const row = rowAt(rowsOf(roundTrip([checkRow])), 0);
    expect(row.flatModifier).toBe(5);
    expect('mods' in row).toBe(false);
  });

  it('keeps each row its own chain in a mixed table', () => {
    const lone: ModStep[] = [{ op: 'add', value: 3 }];
    const longer: ModStep[] = [
      { op: 'add', value: 3 },
      { op: 'mul', value: 2 },
    ];
    const rows = rowsOf(roundTrip([sumRow(lone, 'a'), sumRow(longer, 'b'), sumRow(undefined, 'c')]));
    expect(rows.map((r) => r.mods)).toEqual([lone, longer, undefined]);
  });

  it('rolls the same numbers after the trip as before it', () => {
    // 2d6 + 3 lands on 5..15, doubled on 10, 12, ..., 30 with 2d6's weights.
    const row = rowAt(
      rowsOf(
        roundTrip([
          sumRow([
            { op: 'add', value: 3 },
            { op: 'mul', value: 2 },
          ]),
        ]),
      ),
      0,
    );
    expectDistribution(expressionDistribution(row), {
      10: 1 / 36,
      12: 2 / 36,
      14: 3 / 36,
      16: 4 / 36,
      18: 5 / 36,
      20: 6 / 36,
      22: 5 / 36,
      24: 4 / 36,
      26: 3 / 36,
      28: 2 / 36,
      30: 1 / 36,
    });
  });
});

describe('a hand-edited v5 payload', () => {
  function v5With(row: Record<string, unknown>): string {
    return JSON.stringify({ format: EXPORT_FORMAT_TAG, exportVersion: 5, rolls: [row] });
  }

  const base = {
    name: 'Greatsword',
    parts: [{ count: 2, sides: 6 }],
    rollMode: 'normal',
    mode: 'sum',
  };

  it('refuses a sum row carrying both a modifier and a chain', () => {
    const json = v5With({ ...base, flatModifier: 3, mods: [{ op: 'mul', value: 2 }] });
    expect(decodeFromJsonString(json)).toEqual({ ok: false, error: 'invalid-shape' });
  });

  it('refuses a chain longer than three steps', () => {
    const json = v5With({
      ...base,
      flatModifier: 0,
      mods: [
        { op: 'add', value: 1 },
        { op: 'add', value: 1 },
        { op: 'add', value: 1 },
        { op: 'add', value: 1 },
      ],
    });
    expect(decodeFromJsonString(json)).toEqual({ ok: false, error: 'invalid-shape' });
  });

  it('refuses a divide by zero', () => {
    const json = v5With({ ...base, flatModifier: 0, mods: [{ op: 'div', value: 0 }] });
    expect(decodeFromJsonString(json)).toEqual({ ok: false, error: 'invalid-shape' });
  });

  it('drops a chain left on a check row rather than refusing the table', () => {
    const json = v5With({
      name: 'Saving throw',
      parts: [{ count: 1, sides: 20 }],
      flatModifier: 5,
      mods: [{ op: 'mul', value: 2 }],
      rollMode: 'normal',
      mode: 'check',
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [{ count: 1, sides: 4 }], flatModifier: 0 },
        onSuccess: 'full',
        onFailure: 'none',
      },
    });
    const row = rowAt(rowsOf(decodeFromJsonString(json)), 0);
    expect('mods' in row).toBe(false);
    expect(row.flatModifier).toBe(5);
  });
});

describe('a link from a newer build', () => {
  const future = { format: EXPORT_FORMAT_TAG, exportVersion: EXPORT_VERSION + 1, rolls: [] };

  it('is recognised as from the future', () => {
    expect(isFutureExportVersion(future)).toBe(true);
  });

  it('is not confused with this build’s own version', () => {
    expect(isFutureExportVersion({ ...future, exportVersion: EXPORT_VERSION })).toBe(false);
  });

  it('is refused as too new when opened as a link', () => {
    expect(decodeFromHashFragment(asLink(future))).toEqual({
      ok: false,
      error: 'version-too-new',
    });
  });

  it('is refused as too new when opened as a file', () => {
    expect(decodeFromJsonString(JSON.stringify(future))).toEqual({
      ok: false,
      error: 'version-too-new',
    });
  });

  it('is how a build from before the chain sees a link at this version', () => {
    // An older build runs the same check against its own version, 4, so a link
    // written at this version is "newer" to it and refused, not read without
    // its chain.
    expect(EXPORT_VERSION).toBeGreaterThan(LAST_VERSION_BEFORE_CHAIN);
  });

  it('stamps a link that carries a chain with a version an older build refuses', () => {
    const hash = encodeRollsToHash([
      sumRow([
        { op: 'add', value: 3 },
        { op: 'mul', value: 2 },
      ]),
    ]);
    const envelope: unknown = JSON.parse(
      decompressFromEncodedURIComponent(hash.slice(HASH_PREFIX.length)),
    );
    expect(isRecord(envelope) ? envelope.exportVersion : null).toBeGreaterThan(
      LAST_VERSION_BEFORE_CHAIN,
    );
  });
});

describe('link size with a chain', () => {
  function hundredRows(mods: ModStep[]): Expression[] {
    return Array.from({ length: 100 }, (_, i) => ({
      id: `expr-${i}`,
      name: `Roll number ${i}`,
      parts: [{ id: `part-${i}`, count: 2, sides: 6 }],
      flatModifier: 0,
      mods,
      rollMode: 'normal' as const,
      mode: 'sum' as const,
    }));
  }

  it('keeps a hundred rows of a lone +3 under 3,000 characters', () => {
    expect(encodeRollsToHash(hundredRows([{ op: 'add', value: 3 }])).length).toBeLessThan(3000);
  });

  it('keeps a hundred rows of +3 then x2 under 5,000 characters', () => {
    const hash = encodeRollsToHash(
      hundredRows([
        { op: 'add', value: 3 },
        { op: 'mul', value: 2 },
      ]),
    );
    // Measured at 3,848 characters, against 2,647 for the lone +3: a chain that
    // cannot travel as flatModifier pays for its mods array on every row.
    expect(hash.length).toBeLessThan(5000);
  });
});
