import {
  MAX_EXPRESSIONS,
  MAX_TARGETS,
  type ChartView,
  type DicePart,
  type Expression,
  type ExpressionMode,
  type ExplodeRule,
  type KeepRule,
  type PersistedState,
  type RerollRule,
  type RollMode,
  type SuccessThreshold,
  type TargetRuling,
  type TargetState,
  type WorkshopView,
} from '../types';

// The inner schema version, deliberately decoupled from the useLocalStorage
// envelope version in AppContext. The envelope gate rejects any version it does
// not recognise before validation ever runs, so bumping both together would wipe
// every saved table instead of migrating it.
export const SCHEMA_VERSION = 3;

const ACCEPTED_SCHEMA_VERSIONS: readonly number[] = [2, 3];

const ROLL_MODES: readonly RollMode[] = ['normal', 'advantage', 'disadvantage'];
const EXPRESSION_MODES: readonly ExpressionMode[] = ['sum', 'pool'];
const THRESHOLD_DIRECTIONS: readonly SuccessThreshold['direction'][] = ['gte', 'lte'];
const CHART_VIEWS: readonly ChartView[] = ['pmf', 'cdf', 'ccdf', 'target'];
const WORKSHOP_VIEWS: readonly WorkshopView[] = ['table', 'target', 'rolloff', 'matrix'];
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

function validateSuccessThreshold(v: unknown): SuccessThreshold | null {
  if (!isRecord(v)) return null;
  if (!isOneOf(v.direction, THRESHOLD_DIRECTIONS)) return null;
  if (!isInt(v.value) || v.value < 1) return null;
  return { direction: v.direction, value: v.value };
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

  // Absent means a payload written before pool mode existed; present but
  // unrecognised is corruption, and is rejected like any other bad enum.
  let mode: ExpressionMode = 'sum';
  if (v.mode !== undefined) {
    if (!isOneOf(v.mode, EXPRESSION_MODES)) return null;
    mode = v.mode;
  }

  const parts: DicePart[] = [];
  for (const rawPart of v.parts) {
    const part = validatePart(rawPart);
    if (part === null) return null;
    // Keep and explode have no honest meaning when counting successes, so a pool
    // row carrying either is rejected rather than computed with them ignored.
    if (mode === 'pool' && (part.keep !== undefined || part.explode !== undefined)) {
      return null;
    }
    parts.push(part);
  }

  const expression: Expression = {
    id: v.id,
    name: v.name,
    parts,
    flatModifier: v.flatModifier,
    rollMode: v.rollMode,
    mode,
  };

  if (mode === 'pool') {
    const threshold = validateSuccessThreshold(v.successThreshold);
    if (threshold === null) return null;
    expression.successThreshold = threshold;
  }

  return expression;
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
    return {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [], ruling: 'gte' },
      view: 'table',
      poolTarget: 1,
    };
  }
  const expandedId =
    v.expandedId === null
      ? null
      : typeof v.expandedId === 'string'
        ? v.expandedId
        : null;
  const chartView = isOneOf(v.chartView, CHART_VIEWS) ? v.chartView : 'pmf';
  const target = validateTarget(v.target);
  const view = isOneOf(v.view, WORKSHOP_VIEWS) ? v.view : 'table';
  const poolTarget = isInt(v.poolTarget) && v.poolTarget >= 1 ? v.poolTarget : 1;
  return { expandedId, chartView, target, view, poolTarget };
}

export function validatePersistedState(raw: unknown): PersistedState | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.version !== 'number') return null;
  if (!ACCEPTED_SCHEMA_VERSIONS.includes(raw.version)) return null;
  if (!Array.isArray(raw.expressions)) return null;

  const expressions: Expression[] = [];
  for (const rawExpr of raw.expressions) {
    const expr = validateExpression(rawExpr);
    if (expr === null) return null;
    expressions.push(expr);
    if (expressions.length >= MAX_EXPRESSIONS) break;
  }

  return {
    version: SCHEMA_VERSION,
    expressions,
    ui: validateUi(raw.ui),
  };
}
