import {
  MAX_EXPRESSIONS,
  MAX_TARGETS,
  type ChartView,
  type DicePart,
  type Expression,
  type ExplodeRule,
  type KeepRule,
  type PersistedState,
  type RerollRule,
  type RollMode,
  type TargetRuling,
  type TargetState,
} from '../types';

const ROLL_MODES: readonly RollMode[] = ['normal', 'advantage', 'disadvantage'];
const CHART_VIEWS: readonly ChartView[] = ['pmf', 'cdf', 'ccdf', 'target'];
const TARGET_RULINGS: readonly TargetRuling[] = ['gte', 'gt', 'lte', 'lt', 'eq'];
const KEEP_TYPES: readonly KeepRule['type'][] = ['highest', 'lowest'];
const REROLL_MODES: readonly RerollRule['mode'][] = ['once', 'always'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isIntArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every(isInt);
}

function isOneOf<T extends string>(v: unknown, options: readonly T[]): v is T {
  return typeof v === 'string' && (options as readonly string[]).includes(v);
}

function validateKeep(v: unknown): KeepRule | null {
  if (!isRecord(v)) return null;
  if (!isOneOf(v.type, KEEP_TYPES)) return null;
  if (!isInt(v.n) || v.n < 1) return null;
  return { type: v.type, n: v.n };
}

function validateReroll(v: unknown): RerollRule | null {
  if (!isRecord(v)) return null;
  if (!isIntArray(v.values)) return null;
  if (!isOneOf(v.mode, REROLL_MODES)) return null;
  return { values: [...v.values], mode: v.mode };
}

function validateExplode(v: unknown): ExplodeRule | null {
  if (!isRecord(v)) return null;
  if (!isIntArray(v.onFaces)) return null;
  if (!isInt(v.depthCap) || v.depthCap < 0) return null;
  return { onFaces: [...v.onFaces], depthCap: v.depthCap };
}

function validatePart(v: unknown): DicePart | null {
  if (!isRecord(v)) return null;
  if (!isNonEmptyString(v.id)) return null;
  if (!isInt(v.count) || v.count < 1) return null;
  if (!isInt(v.sides) || v.sides < 2) return null;

  const part: DicePart = { id: v.id, count: v.count, sides: v.sides };

  if (v.keep !== undefined) {
    const keep = validateKeep(v.keep);
    if (keep === null) return null;
    part.keep = keep;
  }
  if (v.reroll !== undefined) {
    const reroll = validateReroll(v.reroll);
    if (reroll === null) return null;
    part.reroll = reroll;
  }
  if (v.explode !== undefined) {
    const explode = validateExplode(v.explode);
    if (explode === null) return null;
    part.explode = explode;
  }
  return part;
}

export function validateExpression(v: unknown): Expression | null {
  if (!isRecord(v)) return null;
  if (!isNonEmptyString(v.id)) return null;
  if (typeof v.name !== 'string') return null;
  if (!Array.isArray(v.parts) || v.parts.length === 0) return null;
  if (typeof v.flatModifier !== 'number' || !Number.isFinite(v.flatModifier)) {
    return null;
  }
  if (!isOneOf(v.rollMode, ROLL_MODES)) return null;

  const parts: DicePart[] = [];
  for (const rawPart of v.parts) {
    const part = validatePart(rawPart);
    if (part === null) return null;
    parts.push(part);
  }
  return {
    id: v.id,
    name: v.name,
    parts,
    flatModifier: v.flatModifier,
    rollMode: v.rollMode,
  };
}

function validateTarget(v: unknown): TargetState {
  if (!isRecord(v)) return { values: [], ruling: 'gte' };
  const ruling = isOneOf(v.ruling, TARGET_RULINGS) ? v.ruling : 'gte';

  let values: number[] = [];
  if (Array.isArray(v.values)) {
    const seen = new Set<number>();
    for (const raw of v.values) {
      if (!isInt(raw)) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      values.push(raw);
      if (values.length >= MAX_TARGETS) break;
    }
    values.sort((a, b) => a - b);
  } else if (isInt(v.value)) {
    values = [v.value];
  }

  return { values, ruling };
}

function validateUi(v: unknown): PersistedState['ui'] {
  if (!isRecord(v)) {
    return { expandedId: null, chartView: 'pmf', target: { values: [], ruling: 'gte' } };
  }
  const expandedId =
    v.expandedId === null
      ? null
      : typeof v.expandedId === 'string'
        ? v.expandedId
        : null;
  const chartView = isOneOf(v.chartView, CHART_VIEWS) ? v.chartView : 'pmf';
  const target = validateTarget(v.target);
  return { expandedId, chartView, target };
}

export function validatePersistedState(raw: unknown): PersistedState | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 2) return null;
  if (!Array.isArray(raw.expressions)) return null;

  const expressions: Expression[] = [];
  for (const rawExpr of raw.expressions) {
    const expr = validateExpression(rawExpr);
    if (expr === null) return null;
    expressions.push(expr);
    if (expressions.length >= MAX_EXPRESSIONS) break;
  }

  return {
    version: 2,
    expressions,
    ui: validateUi(raw.ui),
  };
}
