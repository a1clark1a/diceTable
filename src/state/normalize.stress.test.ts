import { describe, expect, it } from 'vitest';
import { normalizeExpression } from './normalize';
import { SCHEMA_VERSION, validatePersistedState } from './persistedSchema';
import { isSingleDieCheck } from '../engine/critEffect';
import type { CheckSpec, Expression, PersistedState } from '../types';

// The defect grid this file sweeps: every malformed shape an old envelope or a
// buggy mutation could hand the app. Point tests in normalize.test.ts pin the
// individual repairs; this file asserts the four contract invariants hold for
// every member at once, so a future edit to one branch of the repair cannot
// silently break another.

function checkSpec(overrides: Partial<CheckSpec> = {}): CheckSpec {
  return {
    threshold: { direction: 'gte', value: 10 },
    effect: { parts: [{ id: 'fx0', count: 1, sides: 6 }], flatModifier: 0 },
    onSuccess: 'full',
    onFailure: 'none',
    ...overrides,
  };
}

function sumRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e0',
    name: 'Sum row',
    parts: [{ id: 'p0', count: 1, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function poolRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e0',
    name: 'Pool row',
    parts: [{ id: 'p0', count: 4, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 4 },
    ...overrides,
  };
}

function checkRow(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e0',
    name: 'Check row',
    parts: [{ id: 'p0', count: 1, sides: 20 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'check',
    check: checkSpec(),
    ...overrides,
  };
}

interface CorpusMember {
  name: string;
  make: () => Expression;
}

const malformedCorpus: CorpusMember[] = [
  {
    name: 'a crit face above the die',
    make: () =>
      checkRow({
        parts: [{ id: 'p0', count: 1, sides: 6 }],
        check: checkSpec({ crit: { onFaces: [7], effect: 'doubleDice' } }),
      }),
  },
  {
    name: 'crit faces all below 1',
    make: () =>
      checkRow({
        parts: [{ id: 'p0', count: 1, sides: 6 }],
        check: checkSpec({ crit: { onFaces: [0, -2], effect: 'extraDie' } }),
      }),
  },
  {
    name: 'crit faces mixing valid, low, and high',
    make: () =>
      checkRow({
        parts: [{ id: 'p0', count: 1, sides: 6 }],
        check: checkSpec({ crit: { onFaces: [0, 3, 99], effect: 'maxPlusRoll' } }),
      }),
  },
  {
    name: 'a crit on a two-dice check part',
    make: () =>
      checkRow({
        parts: [{ id: 'p0', count: 2, sides: 20 }],
        check: checkSpec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
      }),
  },
  {
    name: 'a crit on a two-part check',
    make: () =>
      checkRow({
        parts: [
          { id: 'p0', count: 1, sides: 20 },
          { id: 'p1', count: 1, sides: 4 },
        ],
        check: checkSpec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
      }),
  },
  {
    name: 'keep and keepAcross both set at row level',
    make: () =>
      sumRow({
        parts: [
          { id: 'p0', count: 2, sides: 6, keep: { type: 'highest', n: 1 } },
          { id: 'p1', count: 1, sides: 8 },
        ],
        keepAcross: { type: 'highest', n: 2 },
      }),
  },
  {
    name: 'keep and keepAcross both set inside a check effect',
    make: () =>
      checkRow({
        check: checkSpec({
          effect: {
            parts: [
              { id: 'fx0', count: 2, sides: 6, keep: { type: 'lowest', n: 1 } },
              { id: 'fx1', count: 1, sides: 8 },
            ],
            flatModifier: 0,
            keepAcross: { type: 'highest', n: 2 },
          },
        }),
      }),
  },
  {
    name: 'a pool threshold left over on a sum row',
    make: () => sumRow({ successThreshold: { direction: 'gte', value: 4 } }),
  },
  {
    name: 'a check left over on a sum row',
    make: () => sumRow({ check: checkSpec() }),
  },
  {
    name: 'a sum keepAcross left over on a pool row',
    make: () => poolRow({ keepAcross: { type: 'highest', n: 2 } }),
  },
  {
    name: 'a check left over on a pool row',
    make: () => poolRow({ check: checkSpec() }),
  },
  {
    name: 'per-part keep and explode left over on a pool row',
    make: () =>
      poolRow({
        parts: [
          {
            id: 'p0',
            count: 4,
            sides: 6,
            keep: { type: 'highest', n: 3 },
            explode: { onFaces: [6], depthCap: 10 },
          },
        ],
      }),
  },
  {
    name: 'a pool threshold left over on a check row',
    make: () => checkRow({ successThreshold: { direction: 'gte', value: 4 } }),
  },
  {
    name: 'a sum keepAcross left over on a check row',
    make: () => checkRow({ keepAcross: { type: 'lowest', n: 1 } }),
  },
  {
    name: 'a pool row carrying every leftover at once',
    make: () =>
      poolRow({
        parts: [
          {
            id: 'p0',
            count: 4,
            sides: 6,
            keep: { type: 'highest', n: 3 },
            explode: { onFaces: [6], depthCap: 10 },
            reroll: { values: [1], mode: 'once' },
          },
        ],
        keepAcross: { type: 'highest', n: 2 },
        check: checkSpec(),
      }),
  },
  {
    name: 'a check row carrying every defect at once',
    make: () =>
      checkRow({
        parts: [{ id: 'p0', count: 1, sides: 6 }],
        successThreshold: { direction: 'lte', value: 3 },
        keepAcross: { type: 'highest', n: 1 },
        check: checkSpec({
          crit: { onFaces: [0, 4, 40], effect: 'extraDie' },
          effect: {
            parts: [
              { id: 'fx0', count: 3, sides: 6, keep: { type: 'highest', n: 2 } },
            ],
            flatModifier: 1,
            keepAcross: { type: 'highest', n: 2 },
          },
        }),
      }),
  },
  {
    name: 'a multi-die crit next to an effect keep conflict',
    make: () =>
      checkRow({
        parts: [{ id: 'p0', count: 3, sides: 6 }],
        check: checkSpec({
          crit: { onFaces: [6], effect: 'doubleDice' },
          effect: {
            parts: [
              { id: 'fx0', count: 2, sides: 8, keep: { type: 'lowest', n: 1 } },
            ],
            flatModifier: 0,
            keepAcross: { type: 'lowest', n: 1 },
          },
        }),
      }),
  },
];

const cleanCorpus: CorpusMember[] = [
  { name: 'a plain sum row', make: () => sumRow() },
  {
    name: 'a sum row with only a per-part keep',
    make: () =>
      sumRow({
        parts: [{ id: 'p0', count: 4, sides: 6, keep: { type: 'highest', n: 3 } }],
      }),
  },
  {
    name: 'a sum row with only a keepAcross',
    make: () =>
      sumRow({
        parts: [
          { id: 'p0', count: 2, sides: 6 },
          { id: 'p1', count: 1, sides: 8 },
        ],
        keepAcross: { type: 'highest', n: 2 },
      }),
  },
  {
    name: 'a pool row with a threshold and a reroll',
    make: () =>
      poolRow({
        parts: [
          { id: 'p0', count: 4, sides: 6, reroll: { values: [1], mode: 'always' } },
        ],
      }),
  },
  {
    name: 'a check row with a valid crit',
    make: () =>
      checkRow({
        check: checkSpec({ crit: { onFaces: [20], effect: 'doubleDice' } }),
      }),
  },
  {
    name: 'a check row with only an effect keepAcross',
    make: () =>
      checkRow({
        check: checkSpec({
          effect: {
            parts: [
              { id: 'fx0', count: 2, sides: 6 },
              { id: 'fx1', count: 1, sides: 8 },
            ],
            flatModifier: 0,
            keepAcross: { type: 'highest', n: 2 },
          },
        }),
      }),
  },
];

function persistedWith(expr: Expression): PersistedState {
  return {
    version: SCHEMA_VERSION,
    expressions: [expr],
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [], ruling: 'gte' },
      view: 'table',
      poolTargets: [1],
      baselineId: null,
    },
  };
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}

// Everything the validator would reject, restated as assertions on the repaired
// row: the repair must leave nothing behind that only another mode reads.
function expectModeInvariants(e: Expression): void {
  if (e.mode === 'sum') {
    expect(e.successThreshold).toBeUndefined();
    expect(e.check).toBeUndefined();
    if (e.keepAcross !== undefined) {
      expect(e.parts.every((p) => p.keep === undefined)).toBe(true);
    }
  } else if (e.mode === 'pool') {
    expect(e.keepAcross).toBeUndefined();
    expect(e.check).toBeUndefined();
    expect(
      e.parts.every((p) => p.keep === undefined && p.explode === undefined),
    ).toBe(true);
  } else {
    expect(e.successThreshold).toBeUndefined();
    expect(e.keepAcross).toBeUndefined();
    expect(e.check).toBeDefined();
    const check = e.check!;
    if (check.crit !== undefined) {
      expect(isSingleDieCheck(e.parts)).toBe(true);
      const sides = e.parts[0]!.sides;
      expect(check.crit.onFaces.length).toBeGreaterThan(0);
      expect(check.crit.onFaces.every((f) => f >= 1 && f <= sides)).toBe(true);
    }
    if (check.effect.keepAcross !== undefined) {
      expect(check.effect.parts.every((p) => p.keep === undefined)).toBe(true);
    }
  }
}

describe('normalizeExpression malformed corpus', () => {
  it.each(malformedCorpus)(
    'repairing $name yields a row the persisted-state validator accepts',
    ({ make }) => {
      const repaired = normalizeExpression(make());
      const round = JSON.parse(JSON.stringify(persistedWith(repaired))) as unknown;
      expect(validatePersistedState(round)).not.toBeNull();
    },
  );

  it.each(malformedCorpus)(
    'repairing $name leaves no field a different mode owns',
    ({ make }) => {
      expectModeInvariants(normalizeExpression(make()));
    },
  );

  it.each(malformedCorpus)('repairing $name is idempotent', ({ make }) => {
    const once = normalizeExpression(make());
    expect(normalizeExpression(once)).toBe(once);
  });

  it.each(malformedCorpus)('repairing $name never mutates the input', ({ make }) => {
    const input = make();
    const before = JSON.parse(JSON.stringify(input)) as unknown;
    deepFreeze(input);
    normalizeExpression(input);
    expect(input).toEqual(before);
  });
});

describe('normalizeExpression clean corpus', () => {
  it.each(cleanCorpus)('returns $name by reference', ({ make }) => {
    const clean = make();
    expect(normalizeExpression(clean)).toBe(clean);
  });
});

describe('normalizeExpression keeps what the mode reads', () => {
  it('pool cleanup keeps the threshold and the reroll while stripping the rest', () => {
    const monster = malformedCorpus.find(
      (m) => m.name === 'a pool row carrying every leftover at once',
    )!;
    const repaired = normalizeExpression(monster.make());
    expect(repaired.successThreshold).toEqual({ direction: 'gte', value: 4 });
    expect(repaired.parts[0]?.reroll).toEqual({ values: [1], mode: 'once' });
  });

  it('check cleanup keeps the surviving crit face and the effect keepAcross', () => {
    const monster = malformedCorpus.find(
      (m) => m.name === 'a check row carrying every defect at once',
    )!;
    const repaired = normalizeExpression(monster.make());
    expect(repaired.check?.crit).toEqual({ onFaces: [4], effect: 'extraDie' });
    expect(repaired.check?.effect.keepAcross).toEqual({ type: 'highest', n: 2 });
    expect(repaired.check?.effect.flatModifier).toBe(1);
    expect(repaired.check?.threshold).toEqual({ direction: 'gte', value: 10 });
  });
});
