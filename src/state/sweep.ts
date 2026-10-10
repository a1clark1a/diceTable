import { expressionTooComplex } from '../engine/complexity';
import { everyFaceExplodes, validatePart } from '../components/editor/validatePart';
import type { DicePart, Expression } from '../types';
import { applyPartPatch, sidesPatch } from './defaultPart';
import { normalizeExpression } from './normalize';

/** The one value a sweep varies. Parts are addressed by id, as the editor does. */
export type SweepTarget =
  | { kind: 'count'; partId: string }
  | { kind: 'sides'; partId: string }
  | { kind: 'keepN'; partId: string }
  | { kind: 'modifier' }
  | { kind: 'poolThreshold' };

/**
 * Eight is the number of palette slots, so a family never repeats a colour and
 * dash pair on the chart.
 */
export const MAX_SWEEP_VARIANTS = 8;

/** Bounds the editor's own controls already enforce, so a sweep cannot exceed them. */
export const SWEEP_BOUNDS: Record<SweepTarget['kind'], { min: number; max: number }> = {
  count: { min: 1, max: 999 },
  sides: { min: 2, max: 1000 },
  keepN: { min: 1, max: 999 },
  modifier: { min: -999, max: 999 },
  poolThreshold: { min: 1, max: 1000 },
};

export type SweepSkipReason =
  | 'source'
  | 'keepOverCount'
  | 'thresholdOffDie'
  | 'endless'
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
  targets.push({ kind: 'modifier' });
  if (expr.mode === 'pool' && expr.successThreshold) {
    targets.push({ kind: 'poolThreshold' });
  }
  return targets;
}

export function sameSweepTarget(a: SweepTarget, b: SweepTarget): boolean {
  if (a.kind !== b.kind) return false;
  if ('partId' in a && 'partId' in b) return a.partId === b.partId;
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
    case 'modifier':
      return expr.flatModifier;
    case 'poolThreshold':
      return expr.successThreshold?.value ?? null;
  }
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
      return { ...expr, flatModifier: value };
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
    dice += part.count;
    maxSides = Math.max(maxSides, part.sides);
  }
  if (expr.keepAcross !== undefined && expr.keepAcross.n > dice) return 'keepOverCount';
  if (expr.mode === 'pool' && expr.successThreshold !== undefined) {
    const { value } = expr.successThreshold;
    if (value < 1 || value > maxSides) return 'thresholdOffDie';
  }
  return null;
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
  const bounds = SWEEP_BOUNDS[target.kind];
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
