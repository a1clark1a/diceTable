import { describe, expect, it } from 'vitest';
import type {
  CheckSpec,
  DicePart,
  ExplodeRule,
  Expression,
  RerollRule,
  RollMode,
} from '../types';
import { checkDistribution, checkOutcomeChances } from './check';
import { totalMass } from './distribution';

let nextId = 0;
const part = (count: number, sides: number, extra: Partial<DicePart> = {}): DicePart => ({
  id: `p${nextId++}`,
  count,
  sides,
  ...extra,
});

const checkExpr = (
  parts: DicePart[],
  spec: Partial<CheckSpec>,
  rollMode: RollMode = 'normal',
): Expression => ({
  id: 'e',
  name: 'row',
  parts,
  flatModifier: 0,
  rollMode,
  mode: 'check',
  check: {
    threshold: { direction: 'gte', value: 1 },
    effect: { parts: [part(1, 8)], flatModifier: 0 },
    onSuccess: 'full',
    onFailure: 'none',
    ...spec,
  },
});

interface SweepShape {
  label: string;
  parts: () => DicePart[];
  minTotal: number;
  maxTotal: number;
}

// Every multi-die shape in a bounded grid, plus a few mixed-part rolls. With a
// threshold every total clears, IEEE summation used to leave a ~1e-16 failure
// residue that put a phantom point mass on 0 downstream.
const allSucceedShapes: SweepShape[] = [];
for (let dice = 2; dice <= 8; dice++) {
  for (let sides = 2; sides <= 12; sides++) {
    allSucceedShapes.push({
      label: `${dice}d${sides}`,
      parts: () => [part(dice, sides)],
      minTotal: dice,
      maxTotal: dice * sides,
    });
  }
}
allSucceedShapes.push(
  { label: '1d4 + 1d6', parts: () => [part(1, 4), part(1, 6)], minTotal: 2, maxTotal: 10 },
  { label: '2d6 + 1d8', parts: () => [part(2, 6), part(1, 8)], minTotal: 3, maxTotal: 20 },
  {
    label: '1d6 + 1d8 + 1d10',
    parts: () => [part(1, 6), part(1, 8), part(1, 10)],
    minTotal: 3,
    maxTotal: 24,
  },
);

describe('checkOutcomeChances — checks that cannot fail leave no float residue', () => {
  it('a gte threshold at the minimum total gives failure exactly 0 for every shape', () => {
    for (const shape of allSucceedShapes) {
      const chances = checkOutcomeChances(
        checkExpr(shape.parts(), {
          threshold: { direction: 'gte', value: shape.minTotal },
        }),
      );
      expect(chances.failure, `${shape.label} failure`).toBe(0);
      expect(chances.crit, `${shape.label} crit`).toBe(0);
      expect(
        chances.success + chances.crit + chances.failure,
        `${shape.label} chances sum`,
      ).toBeCloseTo(1, 12);
    }
  });

  it('an lte threshold at the maximum total gives failure exactly 0 for every shape', () => {
    for (const shape of allSucceedShapes) {
      const chances = checkOutcomeChances(
        checkExpr(shape.parts(), {
          threshold: { direction: 'lte', value: shape.maxTotal },
        }),
      );
      expect(chances.failure, `${shape.label} failure`).toBe(0);
      expect(chances.crit, `${shape.label} crit`).toBe(0);
      expect(
        chances.success + chances.crit + chances.failure,
        `${shape.label} chances sum`,
      ).toBeCloseTo(1, 12);
    }
  });

  it('advantage and disadvantage keep the failure snap on all-succeed checks', () => {
    for (const dice of [2, 5]) {
      for (let sides = 2; sides <= 12; sides++) {
        for (const rollMode of ['advantage', 'disadvantage'] as const) {
          const chances = checkOutcomeChances(
            checkExpr(
              [part(dice, sides)],
              { threshold: { direction: 'gte', value: dice } },
              rollMode,
            ),
          );
          const label = `${dice}d${sides} ${rollMode}`;
          expect(chances.failure, `${label} failure`).toBe(0);
          expect(
            chances.success + chances.crit + chances.failure,
            `${label} chances sum`,
          ).toBeCloseTo(1, 12);
        }
      }
    }
  });
});

describe('checkDistribution — no phantom zero on checks that cannot fail', () => {
  it('gte at the minimum total: the distribution starts at the effect minimum', () => {
    for (const shape of allSucceedShapes) {
      const dist = checkDistribution(
        checkExpr(shape.parts(), {
          threshold: { direction: 'gte', value: shape.minTotal },
        }),
      );
      expect(dist.size, `${shape.label} size`).toBeGreaterThan(0);
      expect(dist.has(0), `${shape.label} phantom zero`).toBe(false);
      const minKey = Math.min(...dist.keys());
      expect(minKey, `${shape.label} min key`).toBe(1);
      expect(totalMass(dist), `${shape.label} mass`).toBeCloseTo(1, 12);
    }
  });

  it('lte at the maximum total: the distribution starts at the effect minimum', () => {
    for (const shape of allSucceedShapes) {
      const dist = checkDistribution(
        checkExpr(shape.parts(), {
          threshold: { direction: 'lte', value: shape.maxTotal },
        }),
      );
      expect(dist.size, `${shape.label} size`).toBeGreaterThan(0);
      expect(dist.has(0), `${shape.label} phantom zero`).toBe(false);
      const minKey = Math.min(...dist.keys());
      expect(minKey, `${shape.label} min key`).toBe(1);
      expect(totalMass(dist), `${shape.label} mass`).toBeCloseTo(1, 12);
    }
  });
});

interface GridCell {
  label: string;
  expr: Expression;
}

// d4 / d6 / d20, crit on the max face, face 1, and a mid face; explode sets
// overlapping and disjoint from the crit; a reroll overlapping the crit; all
// three roll modes. 162 cells in all.
function buildGrid(): GridCell[] {
  const cells: GridCell[] = [];
  for (const sides of [4, 6, 20]) {
    const mid = Math.ceil(sides / 2);
    for (const critFace of [sides, 1, mid]) {
      const disjointFace = critFace === sides ? 1 : sides;
      const explodes: (ExplodeRule | undefined)[] = [
        undefined,
        { onFaces: [critFace], depthCap: 3 },
        { onFaces: [disjointFace], depthCap: 3 },
      ];
      const rerolls: (RerollRule | undefined)[] = [
        undefined,
        { values: [critFace], mode: 'once' },
      ];
      for (const explode of explodes) {
        for (const reroll of rerolls) {
          for (const rollMode of ['normal', 'advantage', 'disadvantage'] as const) {
            const extra: Partial<DicePart> = {
              ...(explode ? { explode } : {}),
              ...(reroll ? { reroll } : {}),
            };
            cells.push({
              label:
                `d${sides} crit[${critFace}]` +
                ` explode[${explode ? explode.onFaces.join(',') : '-'}]` +
                ` reroll[${reroll ? critFace : '-'}] ${rollMode}`,
              expr: checkExpr(
                [part(1, sides, extra)],
                {
                  threshold: { direction: 'gte', value: sides - 1 },
                  crit: { onFaces: [critFace], effect: 'doubleDice' },
                },
                rollMode,
              ),
            });
          }
        }
      }
    }
  }
  return cells;
}

const grid = buildGrid();

describe('single-die checks — crit / explode / reroll / roll-mode grid', () => {
  it('the three outcome chances are non-negative and sum to 1 in every cell', () => {
    for (const { label, expr } of grid) {
      const c = checkOutcomeChances(expr);
      expect(c.success, `${label} success`).toBeGreaterThanOrEqual(0);
      expect(c.crit, `${label} crit`).toBeGreaterThanOrEqual(0);
      expect(c.failure, `${label} failure`).toBeGreaterThanOrEqual(0);
      expect(c.success + c.crit + c.failure, `${label} sum`).toBeCloseTo(1, 12);
    }
  });

  it('the crit chance stays positive in every cell', () => {
    // Reroll-once keeps pIn * p mass on the crit face, advantage and
    // disadvantage never empty a face that has base mass, and stripping crit
    // faces from the explode rule preserves their natural-face mass. So every
    // cell of this grid leaves the crit face some probability.
    for (const { label, expr } of grid) {
      const c = checkOutcomeChances(expr);
      expect(c.crit, label).toBeGreaterThan(0);
    }
  });

  it('the outcome mix keeps full probability mass in every cell', () => {
    for (const { label, expr } of grid) {
      const dist = checkDistribution(expr);
      expect(dist.size, `${label} size`).toBeGreaterThan(0);
      expect(totalMass(dist), `${label} mass`).toBeCloseTo(1, 12);
    }
  });
});

describe('single-die checks — hand-computed anchors', () => {
  it('d20 crit on 20 rerolling 20s once: the final face is 20 only 1/400 of the time', () => {
    const c = checkOutcomeChances(
      checkExpr(
        [part(1, 20, { reroll: { values: [20], mode: 'once' } })],
        {
          threshold: { direction: 'gte', value: 15 },
          crit: { onFaces: [20], effect: 'doubleDice' },
        },
      ),
    );
    // The natural 20 is always rerolled, so the final face is 20 only when the
    // reroll lands 20 again. Every other face carries 21/400.
    expect(c.crit).toBeCloseTo(1 / 400, 12);
    expect(c.success).toBeCloseTo(105 / 400, 12);
    expect(c.failure).toBeCloseTo(294 / 400, 12);
  });

  it('d20 crit on 20 exploding 20s under advantage: crit is 1 - (19/20)^2', () => {
    const c = checkOutcomeChances(
      checkExpr(
        [part(1, 20, { explode: { onFaces: [20], depthCap: 10 } })],
        {
          threshold: { direction: 'gte', value: 15 },
          crit: { onFaces: [20], effect: 'doubleDice' },
        },
        'advantage',
      ),
    );
    // The crit face is stripped from the explode rule, so the die is a plain
    // d20 under advantage: a 20 comes up 1 - (19/20)^2 = 39/400 of the time.
    expect(c.crit).toBeCloseTo(1 - (19 / 20) ** 2, 12);
    expect(c.success).toBeCloseTo(165 / 400, 12);
    expect(c.failure).toBeCloseTo(196 / 400, 12);
  });

  it('d20 crit on 1 under disadvantage: crit is 39/400', () => {
    const c = checkOutcomeChances(
      checkExpr(
        [part(1, 20)],
        {
          threshold: { direction: 'gte', value: 15 },
          crit: { onFaces: [1], effect: 'doubleDice' },
        },
        'disadvantage',
      ),
    );
    expect(c.crit).toBeCloseTo(39 / 400, 12);
    expect(c.success + c.crit + c.failure).toBeCloseTo(1, 12);
  });

  it('d6 crit on 1 exploding 6s against 7+: success comes only from exploded chains', () => {
    const c = checkOutcomeChances(
      checkExpr(
        [part(1, 6, { explode: { onFaces: [6], depthCap: 10 } })],
        {
          threshold: { direction: 'gte', value: 7 },
          crit: { onFaces: [1], effect: 'doubleDice' },
        },
      ),
    );
    // Faces 2..5 can never reach 7; every exploded 6-chain totals at least 7.
    expect(c.crit).toBeCloseTo(1 / 6, 12);
    expect(c.success).toBeCloseTo(1 / 6, 12);
    expect(c.failure).toBeCloseTo(4 / 6, 12);
  });
});
