import { MAX_MODS, type Expression, type ModOp, type ModStep } from '../types';

export type ModStepProblem = 'notANumber' | 'notWhole' | 'belowOne' | 'aboveMax';

/**
 * What a multiply or divide step may hold, everywhere: the editor, the Variants
 * sweep and the validator. The complexity guard is what refuses a row spread
 * too wide to draw; this ceiling is what keeps a chain's totals exact, since
 * x1e300 then /1e300 cancels in the width sum and still rounds totals together.
 */
export const MOD_FACTOR_BOUNDS = { min: 1, max: 100 } as const;

/**
 * Why a step cannot be stored, or null when it can. The saved table, a share
 * link and the editor all ask this one function.
 *
 * Add and subtract accept what flatModifier always accepted, so no table that
 * loaded before the chain is refused for its modifier now. Multiply and divide
 * must be whole and at least 1: below that a step can turn a bigger total into
 * a smaller one, and the chain runs before advantage on the promise that it
 * never does. They are new, so their ceiling refuses nothing that loaded before.
 */
export function modStepProblem(op: ModOp, value: number): ModStepProblem | null {
  if (!Number.isFinite(value)) return 'notANumber';
  if (op === 'add' || op === 'sub') return null;
  if (!Number.isInteger(value)) return 'notWhole';
  if (value < MOD_FACTOR_BOUNDS.min) return 'belowOne';
  return value > MOD_FACTOR_BOUNDS.max ? 'aboveMax' : null;
}

/** A signed amount as the step that adds or subtracts it. */
export function signedStep(value: number): ModStep {
  return value < 0 ? { op: 'sub', value: -value } : { op: 'add', value };
}

/** What an add or subtract step does to the total, as one signed number. */
export function signedValue(step: ModStep): number | null {
  if (step.op === 'add') return step.value;
  if (step.op === 'sub') return -step.value;
  return null;
}

function canonicalStep(step: ModStep): ModStep {
  if ((step.op === 'add' || step.op === 'sub') && step.value < 0) {
    return { op: step.op === 'add' ? 'sub' : 'add', value: -step.value };
  }
  return step;
}

/**
 * The stored shape of a chain: add and subtract carry a size, not a sign, there
 * are at most MAX_MODS steps, and no steps is no array. A step whose value is 0
 * stays, since the editor adds a step before the user types its number.
 * Returns the input when it is already in that shape.
 */
export function canonicalMods(mods: ModStep[]): ModStep[] | undefined {
  if (mods.length === 0) return undefined;
  let changed = mods.length > MAX_MODS;
  const out = mods.slice(0, MAX_MODS).map((step) => {
    const next = canonicalStep(step);
    if (next !== step) changed = true;
    return next;
  });
  return changed ? out : mods;
}

/**
 * Sum and pool rows carried their modifier as `flatModifier` before the chain
 * existed. Moving it to the front of the chain is the whole migration: it was
 * added to the dice before anything else, so as the first step it lands on the
 * same totals. One helper for the saved table, the share decoder and every
 * edit, so the three cannot disagree. Returns the row untouched when there is
 * nothing to move.
 */
export function withLegacyModifierMoved(expr: Expression): Expression {
  if (expr.mode === 'check' || expr.flatModifier === 0) return expr;
  const next: Expression = { ...expr, flatModifier: 0 };
  const mods = canonicalMods([signedStep(expr.flatModifier), ...(expr.mods ?? [])]);
  if (mods) next.mods = mods;
  else delete next.mods;
  return next;
}

/**
 * The chain as the single signed modifier the Mod box edits, or null when the
 * chain is more than one add or subtract step. No chain reads as 0.
 */
export function singleModifier(mods: readonly ModStep[] | undefined): number | null {
  if (mods === undefined || mods.length === 0) return 0;
  if (mods.length > 1) return null;
  const only = mods[0];
  return only === undefined ? 0 : signedValue(only);
}

/** The chain a Mod box value stands for: one step, or none at 0. */
export function modsForModifier(value: number): ModStep[] | undefined {
  return value === 0 ? undefined : [signedStep(value)];
}

/**
 * What "Add a step" appends. Anyone reaching for a second step past the Mod
 * box wants more than adding, and doubling is the commonest thing a table does
 * to a total, so it starts there and the change shows at once.
 */
export const NEW_MOD_STEP: ModStep = { op: 'mul', value: 2 };

/**
 * A step with its operation swapped. A multiply or divide cannot hold all an
 * add might (0, a fraction, 500), so switching to one starts it at 2 below its
 * range and at the ceiling above it, rather than leaving a step the validator
 * refuses and the next load would drop the whole table over.
 */
export function withOp(step: ModStep, op: ModOp): ModStep {
  if (step.op === op) return step;
  const scales = op === 'mul' || op === 'div';
  if (scales && (!Number.isInteger(step.value) || step.value < MOD_FACTOR_BOUNDS.min)) {
    return { op, value: 2 };
  }
  if (scales && step.value > MOD_FACTOR_BOUNDS.max) {
    return { op, value: MOD_FACTOR_BOUNDS.max };
  }
  return { op, value: step.value };
}

/** The chain with step `index` moved one place, or the same chain at an end. */
export function withStepMoved(
  mods: readonly ModStep[],
  index: number,
  delta: -1 | 1,
): ModStep[] {
  const to = index + delta;
  const moving = mods[index];
  const other = mods[to];
  if (moving === undefined || other === undefined) return [...mods];
  const next = [...mods];
  next[index] = other;
  next[to] = moving;
  return next;
}

/**
 * A check row's Mod is one number on the check roll. A chain of only adds and
 * subtracts carries over as its net, which is what it did to a total; a chain
 * that multiplies or divides has no one-number reading, so the check starts
 * from 0.
 */
export function modsAsCheckModifier(mods: readonly ModStep[] | undefined): number {
  if (mods === undefined) return 0;
  let net = 0;
  for (const step of mods) {
    const v = signedValue(step);
    if (v === null) return 0;
    net += v;
  }
  return net;
}
