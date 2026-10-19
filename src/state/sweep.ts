import { expressionTooComplex } from '../engine/complexity';
import { everyFaceExplodes, validatePart } from '../components/editor/validatePart';
import type { DicePart, Expression, ModStep } from '../types';
import { applyPartPatch, sidesPatch } from './defaultPart';
import { MOD_FACTOR_BOUNDS, modsForModifier, signedStep, signedValue } from './modChain';
import { normalizeExpression } from './normalize';
import { ROW_PALETTE_LIGHT } from '../components/chart/palette';

/**
 * The one value a sweep varies. Parts are addressed by id, as the editor does;
 * a chain step by its place in the chain. A row with no chain offers step 0 as
 * a modifier of 0, which is what the Mod box shows for it.
 */
export type SweepTarget =
  | { kind: 'count'; partId: string }
  | { kind: 'sides'; partId: string }
  | { kind: 'keepN'; partId: string }
  | { kind: 'modifier'; step: number }
  | { kind: 'poolThreshold' };

/**
 * Colour and dash come from row position and repeat every palette length.
 * The source takes the first slot of its family, so one fewer than the
 * palette keeps every member, source included, on its own colour and dash.
 */
export const MAX_SWEEP_VARIANTS = ROW_PALETTE_LIGHT.length - 1;

/** Bounds the editor's own controls already enforce, so a sweep cannot exceed them. */
export const SWEEP_BOUNDS: Record<SweepTarget['kind'], { min: number; max: number }> = {
  count: { min: 1, max: 999 },
  sides: { min: 2, max: 1000 },
  keepN: { min: 1, max: 999 },
  modifier: { min: -999, max: 999 },
  poolThreshold: { min: 1, max: 1000 },
};

/** The step a modifier target points at, or undefined for a row with no chain. */
function targetStep(expr: Expression, target: { step: number }): ModStep | undefined {
  return expr.mods?.[target.step];
}

function scales(step: ModStep | undefined): boolean {
  return step?.op === 'mul' || step?.op === 'div';
}

export function sweepBounds(
  expr: Expression,
  target: SweepTarget,
): { min: number; max: number } {
  if (target.kind === 'modifier' && scales(targetStep(expr, target))) {
    return MOD_FACTOR_BOUNDS;
  }
  return SWEEP_BOUNDS[target.kind];
}

export type SweepSkipReason =
  | 'source'
  | 'keepOverCount'
  | 'thresholdOffDie'
  | 'endless'
  | 'allRerolled'
  | 'invalid'
  | 'tooComplex'
  | 'overLimit'
  | 'noRoom';

export interface SweepVariant {
  value: number;
  expr: Expression;
  /**
   * The new die cannot show every reroll or explode face the source picked,
   * so those faces were cleared, as the editor clears them on a hand resize.
   */
  clearedFaces: boolean;
}

export interface SweepPlan {
  variants: SweepVariant[];
  skipped: { value: number; reason: SweepSkipReason }[];
}

function findPart(expr: Expression, partId: string): DicePart | undefined {
  return expr.parts.find((p) => p.id === partId);
}

/**
 * Every value a row offers to sweep, in the order the editor shows them. A
 * check row offers none: its dice, bar and effect are three different knobs
 * and the check editor has no single number for "the" value.
 */
export function sweepTargets(expr: Expression): SweepTarget[] {
  if (expr.mode === 'check') return [];
  const targets: SweepTarget[] = [];
  for (const part of expr.parts) {
    targets.push({ kind: 'count', partId: part.id });
    targets.push({ kind: 'sides', partId: part.id });
    if (part.keep) targets.push({ kind: 'keepN', partId: part.id });
  }
  const steps = Math.max(1, expr.mods?.length ?? 0);
  for (let step = 0; step < steps; step++) targets.push({ kind: 'modifier', step });
  if (expr.mode === 'pool' && expr.successThreshold) {
    targets.push({ kind: 'poolThreshold' });
  }
  return targets;
}

export function sameSweepTarget(a: SweepTarget, b: SweepTarget): boolean {
  if (a.kind !== b.kind) return false;
  if ('partId' in a && 'partId' in b) return a.partId === b.partId;
  if ('step' in a && 'step' in b) return a.step === b.step;
  return true;
}

/** The row's current value for the target, or null when the target does not apply. */
export function sweepSourceValue(expr: Expression, target: SweepTarget): number | null {
  switch (target.kind) {
    case 'count':
      return findPart(expr, target.partId)?.count ?? null;
    case 'sides':
      return findPart(expr, target.partId)?.sides ?? null;
    case 'keepN':
      return findPart(expr, target.partId)?.keep?.n ?? null;
    case 'modifier': {
      const step = targetStep(expr, target);
      if (step === undefined) return target.step === 0 && expr.mods === undefined ? 0 : null;
      return signedValue(step) ?? step.value;
    }
    case 'poolThreshold':
      return expr.successThreshold?.value ?? null;
  }
}

function withStep(expr: Expression, index: number, value: number): Expression | null {
  const mods = expr.mods;
  const step = mods?.[index];
  // A lone add or subtract, or no chain at all, is what the Mod box edits, and
  // sweeping it to 0 leaves the row with no chain rather than a "+ 0".
  if (mods === undefined || (mods.length === 1 && !scales(step))) {
    if (index !== 0) return null;
    const next: Expression = { ...expr };
    const chain = modsForModifier(value);
    if (chain) next.mods = chain;
    else delete next.mods;
    return next;
  }
  if (step === undefined) return null;
  const changed = scales(step) ? { op: step.op, value } : signedStep(value);
  return { ...expr, mods: mods.map((s, i) => (i === index ? changed : s)) };
}

function mapPart(
  expr: Expression,
  partId: string,
  change: (part: DicePart) => DicePart | null,
): Expression | null {
  const part = findPart(expr, partId);
  if (part === undefined) return null;
  const changed = change(part);
  if (changed === null) return null;
  return { ...expr, parts: expr.parts.map((p) => (p.id === partId ? changed : p)) };
}

function withValue(expr: Expression, target: SweepTarget, value: number): Expression | null {
  switch (target.kind) {
    case 'count':
      return mapPart(expr, target.partId, (p) => applyPartPatch(p, { count: value }));
    case 'sides':
      return mapPart(expr, target.partId, (p) => applyPartPatch(p, sidesPatch(p, value)));
    case 'keepN':
      return mapPart(expr, target.partId, (p) =>
        p.keep ? applyPartPatch(p, { keep: { ...p.keep, n: value } }) : null,
      );
    case 'modifier':
      return withStep(expr, target.step, value);
    case 'poolThreshold':
      return expr.successThreshold
        ? { ...expr, successThreshold: { ...expr.successThreshold, value } }
        : null;
  }
}

// Why the row would compute something other than what its notation says, or
// null when it would not. An emptied face list is not on this list: shrinking
// a die under its explode face leaves the same empty rule in the editor, and
// the row computes honestly as plain dice.
function whyMisleading(expr: Expression): SweepSkipReason | null {
  let dice = 0;
  let maxSides = 0;
  for (const part of expr.parts) {
    const errors = validatePart(part);
    if (errors.count !== undefined || errors.sides !== undefined) return 'invalid';
    if (errors.keepN !== undefined) return 'keepOverCount';
    if (everyFaceExplodes(part)) return 'endless';
    if (everyFaceRerolled(part)) return 'allRerolled';
    dice += part.count;
    maxSides = Math.max(maxSides, part.sides);
  }
  if (expr.keepAcross !== undefined && expr.keepAcross.n > dice) return 'keepOverCount';
  // Only "at or above" can sit out of reach. "At or below" a number past the
  // largest face makes every die succeed, which is exactly what it says.
  const threshold = expr.mode === 'pool' ? expr.successThreshold : undefined;
  if (threshold?.direction === 'gte' && threshold.value > maxSides) return 'thresholdOffDie';
  return null;
}

// Rerolling "always" on every face the die has means it never lands, and the
// row draws nothing. The editor can reach this by hand too; a sweep must not
// make one without saying so.
function everyFaceRerolled(part: DicePart): boolean {
  if (part.reroll?.mode !== 'always') return false;
  const rerolled = new Set(part.reroll.values);
  for (let face = 1; face <= part.sides; face++) {
    if (!rerolled.has(face)) return false;
  }
  return true;
}

function facesCleared(before: DicePart | undefined, after: DicePart | undefined): boolean {
  if (before === undefined || after === undefined) return false;
  const lost = (was: number[] | undefined, now: number[] | undefined) =>
    was !== undefined && now !== undefined && now.length < was.length;
  return (
    lost(before.reroll?.values, after.reroll?.values) ||
    lost(before.explode?.onFaces, after.explode?.onFaces)
  );
}

/** The largest die across a row's parts: the ceiling a pool threshold can reach. */
export function largestSides(expr: Expression): number {
  return expr.parts.reduce((max, p) => Math.max(max, p.sides), 0);
}

/** The value as it reads in the row's notation: "d10", "+3", "kh2", "≥8". */
export function sweepValueLabel(
  expr: Expression,
  target: SweepTarget,
  value: number,
): string {
  switch (target.kind) {
    case 'count': {
      const sides = findPart(expr, target.partId)?.sides;
      return sides === undefined ? String(value) : `${value}d${sides}`;
    }
    case 'sides':
      return `d${value}`;
    case 'keepN': {
      const keep = findPart(expr, target.partId)?.keep;
      return `${keep?.type === 'lowest' ? 'kl' : 'kh'}${value}`;
    }
    case 'modifier': {
      const step = targetStep(expr, target);
      if (step !== undefined && scales(step)) {
        return `${step.op === 'mul' ? '×' : '÷'}${value}`;
      }
      const signed = value < 0 ? `−${Math.abs(value)}` : `+${value}`;
      return expr.mode === 'pool' ? `${signed} auto` : signed;
    }
    case 'poolThreshold':
      return `${expr.successThreshold?.direction === 'lte' ? '≤' : '≥'}${value}`;
  }
}

/**
 * Turns one row into a family of rows that differ only in the target's value.
 * Pure, and reads no distribution: the complexity guard is a function of the
 * row alone, so the preview can run on every keystroke. Variants keep the
 * source's id and part ids; whoever inserts them re-ids them. `room` is how
 * many rows the table can still take.
 */
export function planSweep(
  expr: Expression,
  target: SweepTarget,
  values: readonly number[],
  room: number,
): SweepPlan {
  const variants: SweepVariant[] = [];
  const skipped: SweepPlan['skipped'] = [];
  const source = expr.mode === 'check' ? null : sweepSourceValue(expr, target);
  const bounds = sweepBounds(expr, target);
  const cap = Math.min(MAX_SWEEP_VARIANTS, Math.max(0, room));
  const seen = new Set<number>();

  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    if (value === source) {
      skipped.push({ value, reason: 'source' });
      continue;
    }
    const inBounds =
      Number.isInteger(value) && value >= bounds.min && value <= bounds.max;
    const changed = source === null || !inBounds ? null : withValue(expr, target, value);
    const variant = changed === null ? null : normalizeExpression(changed);
    if (variant === null) {
      skipped.push({ value, reason: 'invalid' });
      continue;
    }
    const broken = whyMisleading(variant);
    if (broken !== null) {
      skipped.push({ value, reason: broken });
      continue;
    }
    if (expressionTooComplex(variant)) {
      skipped.push({ value, reason: 'tooComplex' });
      continue;
    }
    if (variants.length >= cap) {
      skipped.push({ value, reason: cap < MAX_SWEEP_VARIANTS ? 'noRoom' : 'overLimit' });
      continue;
    }
    variants.push({
      value,
      expr: { ...variant, name: `${expr.name} · ${sweepValueLabel(expr, target, value)}` },
      clearedFaces:
        target.kind === 'sides' &&
        facesCleared(findPart(expr, target.partId), findPart(variant, target.partId)),
    });
  }
  return { variants, skipped };
}

/** from, to and step as a list, either direction, capped so a typo cannot spin. */
export function rangeValues(from: number, to: number, step: number, limit = 64): number[] {
  if (![from, to, step].every(Number.isInteger) || step < 1) return [];
  const dir = to >= from ? 1 : -1;
  const values: number[] = [];
  for (let v = from; dir > 0 ? v <= to : v >= to; v += dir * step) {
    values.push(v);
    if (values.length >= limit) break;
  }
  return values;
}
