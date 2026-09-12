import {
  MAX_EXPRESSIONS,
  MAX_TARGETS,
  type ChartSurface,
  type ChartView,
  type CheckEffect,
  type CheckSpec,
  type CritEffect,
  type CritRule,
  type DicePart,
  type EffectScale,
  type Expression,
  type ExpressionMode,
  type GridSort,
  type ExplodeRule,
  type KeepRule,
  type PersistedState,
  type RerollRule,
  type RollMode,
  type RollOffSort,
  type SuccessThreshold,
  type TargetKindFilter,
  type TargetRuling,
  type TargetState,
  type TargetSubView,
  type WorkshopView,
} from '../types';
import { isSingleDieCheck } from '../engine/critEffect';

// The inner schema version, deliberately decoupled from the useLocalStorage
// envelope version in AppContext. The envelope gate rejects any version it does
// not recognise before validation ever runs, so bumping both together would wipe
// every saved table instead of migrating it.
export const SCHEMA_VERSION = 6;

const ACCEPTED_SCHEMA_VERSIONS: readonly number[] = [2, 3, 4, 5, 6];

const ROLL_MODES: readonly RollMode[] = ['normal', 'advantage', 'disadvantage'];
const EXPRESSION_MODES: readonly ExpressionMode[] = ['sum', 'pool', 'check'];
const THRESHOLD_DIRECTIONS: readonly SuccessThreshold['direction'][] = ['gte', 'lte'];
const CHART_VIEWS: readonly ChartView[] = ['pmf', 'cdf', 'ccdf', 'target'];
const WORKSHOP_VIEWS: readonly WorkshopView[] = ['table', 'target', 'rolloff', 'matrix'];
const TARGET_SUB_VIEWS: readonly TargetSubView[] = ['grid', 'curves', 'bars'];
const TARGET_FILTERS: readonly TargetKindFilter[] = ['all', 'sum', 'pool'];
const ROLL_OFF_SORTS: readonly RollOffSort[] = ['win', 'table'];
const SORT_DIRECTIONS: readonly GridSort['dir'][] = ['desc', 'asc'];
const TARGET_RULINGS: readonly TargetRuling[] = ['gte', 'gt', 'lte', 'lt', 'eq'];
const KEEP_TYPES: readonly KeepRule['type'][] = ['highest', 'lowest'];
const REROLL_MODES: readonly RerollRule['mode'][] = ['once', 'always'];
const EFFECT_SCALES: readonly EffectScale[] = ['none', 'half', 'full'];
const CRIT_EFFECTS: readonly CritEffect[] = ['doubleDice', 'extraDie', 'maxPlusRoll'];

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

function validateCritRule(v: unknown): CritRule | null {
  if (!isRecord(v)) return null;
  if (!isOneOf(v.effect, CRIT_EFFECTS)) return null;
  // An empty face list is a critical that can never happen: a rule the math
  // would ignore, which is the one thing the stored shape must never hold.
  if (!isIntArray(v.onFaces) || v.onFaces.length === 0) return null;
  if (v.onFaces.some((f) => f < 1)) return null;
  return { onFaces: [...v.onFaces], effect: v.effect };
}

function validateCheckEffect(v: unknown): CheckEffect | null {
  if (!isRecord(v)) return null;
  if (!Array.isArray(v.parts) || v.parts.length === 0) return null;
  if (typeof v.flatModifier !== 'number' || !Number.isFinite(v.flatModifier)) {
    return null;
  }

  const parts: DicePart[] = [];
  for (const rawPart of v.parts) {
    const part = validatePart(rawPart);
    if (part === null) return null;
    parts.push(part);
  }

  const effect: CheckEffect = { parts, flatModifier: v.flatModifier };

  if (v.keepAcross !== undefined) {
    const keepAcross = validateKeep(v.keepAcross);
    if (keepAcross === null) return null;
    if (parts.some((p) => p.keep !== undefined)) return null;
    effect.keepAcross = keepAcross;
  }

  return effect;
}

function validateCheckSpec(v: unknown, checkParts: readonly DicePart[]): CheckSpec | null {
  if (!isRecord(v)) return null;

  const threshold = validateSuccessThreshold(v.threshold);
  if (threshold === null) return null;

  const effect = validateCheckEffect(v.effect);
  if (effect === null) return null;

  if (!isOneOf(v.onSuccess, EFFECT_SCALES)) return null;
  if (!isOneOf(v.onFailure, EFFECT_SCALES)) return null;

  const spec: CheckSpec = {
    threshold,
    effect,
    onSuccess: v.onSuccess,
    onFailure: v.onFailure,
  };

  if (v.crit !== undefined) {
    const crit = validateCritRule(v.crit);
    if (crit === null) return null;
    // A critical is read off the face one die shows, so there is no face to read
    // on a check rolling more than one die.
    if (!isSingleDieCheck(checkParts)) return null;
    spec.crit = crit;
  }

  return spec;
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

  if (v.keepAcross !== undefined) {
    const keepAcross = validateKeep(v.keepAcross);
    if (keepAcross === null) return null;
    // Counting successes never reads keepAcross, and keeping across parts
    // replaces the per-part rule rather than stacking with it. Either pairing
    // would store a rule the math ignores, so both are corruption.
    if (mode !== 'sum') return null;
    if (parts.some((p) => p.keep !== undefined)) return null;
    expression.keepAcross = keepAcross;
  }

  // A check row without a check has no effect to apply, and a check on any other
  // row is a rule nothing reads. Both are corruption rather than something to
  // patch up, so the row is rejected either way.
  if (mode === 'check') {
    const check = validateCheckSpec(v.check, parts);
    if (check === null) return null;
    expression.check = check;
  } else if (v.check !== undefined) {
    return null;
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

// Mirrors validateTarget's list handling, minus the ruling: pool targets are
// always "at least n successes". A pool row's Hit % is not opt-in the way a sum
// row's is, so anything unreadable lands on [1] rather than an empty list.
function validatePoolTargets(v: Record<string, unknown>): number[] {
  if (Array.isArray(v.poolTargets)) {
    const seen = new Set<number>();
    const values: number[] = [];
    for (const raw of v.poolTargets) {
      if (!isInt(raw)) continue;
      const value = Math.max(1, raw);
      if (seen.has(value)) continue;
      seen.add(value);
      values.push(value);
      if (values.length >= MAX_TARGETS) break;
    }
    if (values.length > 0) return values.sort((a, b) => a - b);
  }
  // Envelopes written before the list existed carry a single scalar.
  if (isInt(v.poolTarget) && v.poolTarget >= 1) return [v.poolTarget];
  return [1];
}

// The grid's sort points at a columnKey, which goes stale as targets and
// filters change. The view already drops a sort whose column is gone, so the
// only job here is to reject a shape that is not a sort at all.
function validateGridSort(v: unknown): GridSort | null {
  if (!isRecord(v)) return null;
  if (!isNonEmptyString(v.key)) return null;
  if (!isOneOf(v.dir, SORT_DIRECTIONS)) return null;
  return { key: v.key, dir: v.dir };
}

// A function, not a shared constant: validatePersistedState edits the ui object
// it returns (it drops a dangling baselineId), so every caller has to get its
// own arrays and objects rather than aliases into one module-level default.
function defaultUi(): PersistedState['ui'] {
  return {
    expandedId: null,
    chartViews: { totals: 'pmf', successes: 'pmf', shape: 'pmf' },
    target: { values: [], ruling: 'gte' },
    view: 'table',
    poolTargets: [1],
    baselineId: null,
    targetSubView: 'grid',
    targetFilter: 'all',
    targetSort: null,
    rollOffSort: 'win',
  };
}

// Envelopes written before the views split carried one `chartView` for every
// surface. Seeding all three from it keeps a saved choice instead of snapping a
// returning user back to the default.
function validateChartViews(
  v: Record<string, unknown>,
): Record<ChartSurface, ChartView> {
  const legacy = isOneOf(v.chartView, CHART_VIEWS) ? v.chartView : 'pmf';
  const raw = v.chartViews;
  const pick = (surface: ChartSurface): ChartView =>
    isRecord(raw) && isOneOf(raw[surface], CHART_VIEWS) ? raw[surface] : legacy;
  return {
    totals: pick('totals'),
    successes: pick('successes'),
    shape: pick('shape'),
  };
}

function validateUi(v: unknown): PersistedState['ui'] {
  if (!isRecord(v)) return defaultUi();
  const expandedId =
    v.expandedId === null
      ? null
      : typeof v.expandedId === 'string'
        ? v.expandedId
        : null;
  const chartViews = validateChartViews(v);
  const target = validateTarget(v.target);
  const view = isOneOf(v.view, WORKSHOP_VIEWS) ? v.view : 'table';
  const poolTargets = validatePoolTargets(v);
  const baselineId = typeof v.baselineId === 'string' ? v.baselineId : null;
  // Envelopes written before these existed fall back to the view's own
  // defaults, which is what an untouched control shows anyway.
  const targetSubView = isOneOf(v.targetSubView, TARGET_SUB_VIEWS)
    ? v.targetSubView
    : 'grid';
  const targetFilter = isOneOf(v.targetFilter, TARGET_FILTERS)
    ? v.targetFilter
    : 'all';
  const targetSort = validateGridSort(v.targetSort);
  const rollOffSort = isOneOf(v.rollOffSort, ROLL_OFF_SORTS)
    ? v.rollOffSort
    : 'win';
  return {
    expandedId,
    chartViews,
    target,
    view,
    poolTargets,
    baselineId,
    targetSubView,
    targetFilter,
    targetSort,
    rollOffSort,
  };
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

  const ui = validateUi(raw.ui);
  // A baseline pointing at a row that didn't survive validation would pin
  // nothing forever; drop it here so consumers can trust the id resolves.
  if (
    ui.baselineId !== null &&
    !expressions.some((e) => e.id === ui.baselineId)
  ) {
    ui.baselineId = null;
  }

  return {
    version: SCHEMA_VERSION,
    expressions,
    ui,
  };
}
