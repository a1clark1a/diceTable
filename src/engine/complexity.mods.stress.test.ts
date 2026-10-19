import { describe, expect, it } from 'vitest';
import type { DicePart, Distribution, Expression, ModStep } from '../types';
import { expressionTooComplex, MAX_SUPPORT_WORK, supportWidth } from './complexity';
import { totalMass } from './distribution';
import { expressionDistribution } from './expression';

const dice = (count: number, sides: number, extra: Partial<DicePart> = {}): DicePart => ({
  id: `${count}d${sides}`,
  count,
  sides,
  ...extra,
});

const signedStep = (amount: number): ModStep =>
  amount < 0 ? { op: 'sub', value: -amount } : { op: 'add', value: amount };

function withMods(row: Expression, mods: ModStep[] | undefined): Expression {
  if (mods === undefined) return row;
  return { ...row, mods };
}

const sumRow = (parts: DicePart[], extra: Partial<Expression> = {}): Expression => ({
  id: 'sum',
  name: 'sum',
  parts,
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
  ...extra,
});

const poolRow = (parts: DicePart[], threshold: number): Expression => ({
  id: 'pool',
  name: 'pool',
  parts,
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'pool',
  successThreshold: { direction: 'gte', value: threshold },
});

function drawnSpan(dist: Distribution): number {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const k of dist.keys()) {
    if (k < lo) lo = k;
    if (k > hi) hi = k;
  }
  return hi - lo + 1;
}

const describeChain = (mods: readonly ModStep[]): string =>
  mods.map((s) => `${s.op} ${s.value}`).join(', ');

const SIGNED_AMOUNTS = [0, 1, -1, 999, -999, 1e6, -1e6];

// Every modifier a row carried before the chain becomes one add or subtract
// step, and a longer chain of them is still only a shift.
const ADD_SUB_CHAINS: ModStep[][] = [
  ...SIGNED_AMOUNTS.map((amount) => [signedStep(amount)]),
  [signedStep(1e6), signedStep(-999)],
  [signedStep(-1), signedStep(0), signedStep(-1e6)],
  [signedStep(999), signedStep(999), signedStep(999)],
];

const SUM_COUNTS = Array.from({ length: 60 }, (_, i) => i + 1);
// 1000 is there so the sweep crosses the width edge (8d1000 is 7,993 wide)
// and both verdicts are exercised.
const SUM_SIDES = [2, 3, 4, 6, 8, 10, 12, 20, 100, 1000];

function sumShapes(): { label: string; row: Expression }[] {
  const shapes: { label: string; row: Expression }[] = [];
  for (const count of SUM_COUNTS) {
    for (const sides of SUM_SIDES) {
      const n = Math.ceil(count / 2);
      shapes.push(
        { label: `${count}d${sides}`, row: sumRow([dice(count, sides)]) },
        {
          label: `${count}d${sides} keep highest ${n}`,
          row: sumRow([dice(count, sides, { keep: { type: 'highest', n } })]),
        },
        {
          label: `${count}d${sides} exploding on ${sides}`,
          row: sumRow([dice(count, sides, { explode: { onFaces: [sides], depthCap: 3 } })]),
        },
        {
          label: `${count}d${sides} + 1d20 keep lowest ${n}`,
          row: sumRow([dice(count, sides), dice(1, 20)], { keepAcross: { type: 'lowest', n } }),
        },
      );
    }
  }
  return shapes;
}

const POOL_COUNTS = [...Array.from({ length: 60 }, (_, i) => i + 1), 100, 200, 316, 317, 500, 1000];
const POOL_SIDES = [2, 4, 6, 8, 10, 12, 20, 100];

function poolShapes(): { label: string; row: Expression }[] {
  const shapes: { label: string; row: Expression }[] = [];
  for (const count of POOL_COUNTS) {
    for (const sides of POOL_SIDES) {
      const threshold = Math.ceil(sides / 2);
      shapes.push(
        { label: `${count}d${sides} pool`, row: poolRow([dice(count, sides)], threshold) },
        {
          label: `${count}d${sides} + ${count}d10 pool`,
          row: poolRow([dice(count, sides), dice(count, 10)], threshold),
        },
      );
    }
  }
  return shapes;
}

function verdictChanges(shapes: { label: string; row: Expression }[]): {
  changed: string[];
  admitted: number;
  refused: number;
} {
  const changed: string[] = [];
  let admitted = 0;
  let refused = 0;
  for (const { label, row } of shapes) {
    const before = expressionTooComplex(row);
    if (before) refused++;
    else admitted++;
    for (const mods of ADD_SUB_CHAINS) {
      if (expressionTooComplex(withMods(row, mods)) !== before) {
        changed.push(`${label} [${describeChain(mods)}]`);
      }
    }
  }
  return { changed, admitted, refused };
}

describe('an add or subtract chain never changes the guard verdict', () => {
  it('keeps the verdict of every sum row in the sweep', () => {
    const { changed, admitted, refused } = verdictChanges(sumShapes());
    expect(changed).toEqual([]);
    expect(admitted).toBeGreaterThan(1000);
    expect(refused).toBeGreaterThan(50);
  });

  it('keeps the verdict of every pool row in the sweep', () => {
    const { changed, admitted, refused } = verdictChanges(poolShapes());
    expect(changed).toEqual([]);
    expect(admitted).toBeGreaterThan(500);
    expect(refused).toBeGreaterThan(10);
  });

  it('prices a legacy modifier moved into the chain exactly as it was priced in place', () => {
    const changed: string[] = [];
    for (const { label, row } of [...sumShapes(), ...poolShapes()]) {
      for (const amount of SIGNED_AMOUNTS) {
        const legacy: Expression = { ...row, flatModifier: amount };
        const moved: Expression = { ...row, flatModifier: 0, mods: [signedStep(amount)] };
        if (
          expressionTooComplex(moved) !== expressionTooComplex(legacy) ||
          supportWidth(moved) !== supportWidth(legacy)
        ) {
          changed.push(`${label} modifier ${amount}`);
        }
      }
    }
    expect(changed).toEqual([]);
  });
});

const STEP_MENU: ModStep[] = [
  { op: 'mul', value: 2 },
  { op: 'mul', value: 3 },
  { op: 'mul', value: 10 },
  { op: 'mul', value: 100 },
  { op: 'div', value: 2 },
  { op: 'div', value: 3 },
  { op: 'div', value: 10 },
  { op: 'div', value: 100 },
  { op: 'add', value: 3 },
  { op: 'sub', value: 50 },
];

const CHAINS: ModStep[][] = [
  ...STEP_MENU.map((step) => [step]),
  ...STEP_MENU.flatMap((first) => STEP_MENU.map((second) => [first, second])),
];

const SCALED_SUM_ROWS: { label: string; row: Expression }[] = [
  { label: '1d6', row: sumRow([dice(1, 6)]) },
  { label: '2d6', row: sumRow([dice(2, 6)]) },
  { label: '3d8', row: sumRow([dice(3, 8)]) },
  { label: '4d10', row: sumRow([dice(4, 10)]) },
  { label: '10d6', row: sumRow([dice(10, 6)]) },
  { label: '20d6', row: sumRow([dice(20, 6)]) },
  { label: '1d100', row: sumRow([dice(1, 100)]) },
  { label: '4d6 keep highest 3', row: sumRow([dice(4, 6, { keep: { type: 'highest', n: 3 } })]) },
];

const SCALED_POOL_ROWS: { label: string; row: Expression }[] = [
  { label: '10d6 pool', row: poolRow([dice(10, 6)], 4) },
  { label: '100d6 pool', row: poolRow([dice(100, 6)], 5) },
];

describe('a multiplied or divided row and the guard agree', () => {
  it('draws every admitted row with full mass and no wider than it was priced', () => {
    const problems: string[] = [];
    let admitted = 0;
    for (const { label, row } of [...SCALED_SUM_ROWS, ...SCALED_POOL_ROWS]) {
      for (const mods of CHAINS) {
        const scaled = withMods(row, mods);
        if (expressionTooComplex(scaled)) continue;
        admitted++;
        const name = `${label} [${describeChain(mods)}]`;
        const width = supportWidth(scaled);
        const dist = expressionDistribution(scaled);
        if (dist.size === 0) {
          problems.push(`${name}: admitted but empty`);
          continue;
        }
        const mass = totalMass(dist);
        const drawn = drawnSpan(dist);
        if (Math.abs(mass - 1) > 1e-12) problems.push(`${name}: mass ${mass}`);
        if (drawn > width) problems.push(`${name}: drew ${drawn}, priced ${width}`);
        if (width * width > MAX_SUPPORT_WORK) problems.push(`${name}: admitted at width ${width}`);
      }
    }
    expect(problems).toEqual([]);
    expect(admitted).toBeGreaterThan(500);
  });

  it('returns every refused row as the empty distribution', () => {
    const problems: string[] = [];
    let refused = 0;
    for (const { label, row } of [...SCALED_SUM_ROWS, ...SCALED_POOL_ROWS]) {
      for (const mods of CHAINS) {
        const scaled = withMods(row, mods);
        if (!expressionTooComplex(scaled)) continue;
        refused++;
        if (expressionDistribution(scaled).size !== 0) {
          problems.push(`${label} [${describeChain(mods)}]`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(refused).toBeGreaterThan(10);
  });

  it('refuses a scaled row exactly when its priced width passes the edge', () => {
    const problems: string[] = [];
    for (const { label, row } of [...SCALED_SUM_ROWS, ...SCALED_POOL_ROWS]) {
      for (const mods of CHAINS) {
        const scaled = withMods(row, mods);
        const width = supportWidth(scaled);
        if (expressionTooComplex(scaled) !== width * width > MAX_SUPPORT_WORK) {
          problems.push(`${label} [${describeChain(mods)}] at width ${width}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('draws a sum chain with no divide exactly as wide as it was priced', () => {
    const problems: string[] = [];
    for (const { label, row } of SCALED_SUM_ROWS) {
      for (const mods of CHAINS) {
        if (mods.some((step) => step.op === 'div')) continue;
        const scaled = withMods(row, mods);
        if (expressionTooComplex(scaled)) continue;
        const drawn = drawnSpan(expressionDistribution(scaled));
        const width = supportWidth(scaled);
        if (drawn !== width) {
          problems.push(`${label} [${describeChain(mods)}]: drew ${drawn}, priced ${width}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
