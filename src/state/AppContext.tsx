import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { SCHEMA_VERSION, validatePersistedState } from './persistedSchema';
import { normalizeExpression } from './normalize';
import { applyPartPatch, defaultPart, newId } from './defaultPart';
import { renameCollisions } from '../share/rename';
import { toaster } from '../components/share/toaster-store';
import {
  AppContext,
  type AppContextValue,
  type ExpressionPatch,
  type PartPatch,
  type TargetPatch,
} from './useApp';
import {
  MAX_EXPRESSIONS,
  MAX_TARGETS,
  type ChartSurface,
  type ChartView,
  type CheckSpec,
  type DicePart,
  type Expression,
  type GridSort,
  type PersistedState,
  type RollMode,
  type RollOffSort,
  type SuccessThreshold,
  type TargetKindFilter,
  type TargetState,
  type TargetSubView,
  type WorkshopView,
} from '../types';

const STORAGE_KEY = 'dicetable.v2';

// Frozen. useLocalStorage gates reads on an exact envelope-version match and no
// migrate is wired, so raising this discards every saved table. Schema changes
// ride SCHEMA_VERSION inside the envelope instead, where the validator can accept
// the older shape and normalise it.
const ENVELOPE_VERSION = 2;

// A first visit starts with zero rolls so the "Start with an example" panel
// greets new users; nothing is persisted until their first edit.
const initialState: PersistedState = {
  version: SCHEMA_VERSION,
  expressions: [],
  ui: {
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
  },
};

const DEFAULT_ROLL_NAME = 'New roll';

// Keep added rows distinct ("New roll", "New roll 2", …) so table rows and the
// chart legend don't collapse into identical labels. Picks the lowest free
// suffix rather than a running counter, so deleting and re-adding reuses gaps.
function nextDefaultName(existing: Expression[]): string {
  const taken = new Set(existing.map((e) => e.name));
  if (!taken.has(DEFAULT_ROLL_NAME)) return DEFAULT_ROLL_NAME;
  let n = 2;
  while (taken.has(`${DEFAULT_ROLL_NAME} ${n}`)) n++;
  return `${DEFAULT_ROLL_NAME} ${n}`;
}

function defaultExpression(name: string = DEFAULT_ROLL_NAME): Expression {
  return {
    id: newId('expr'),
    name,
    parts: [defaultPart()],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
}

function freshParts(parts: DicePart[]): DicePart[] {
  return parts.map((p) => ({ ...p, id: newId('part') }));
}

// The effect's dice are addressed by id the same way the row's are, so a copy
// that reused them would leave two rows editing through the same handles.
function freshCheck(check: CheckSpec | undefined): CheckSpec | undefined {
  if (check === undefined) return undefined;
  return { ...check, effect: { ...check.effect, parts: freshParts(check.effect.parts) } };
}

function reIdExpression(expr: Expression): Expression {
  const next: Expression = {
    ...expr,
    id: newId('expr'),
    parts: freshParts(expr.parts),
  };
  const check = freshCheck(expr.check);
  if (check) next.check = check;
  return next;
}

// "Better than half" on the row's first die: 4+ on a d6, 6+ on a d10, 11+ on a
// d20. Lands near real dice-pool systems without being tuned to any one of them.
function seedSuccessThreshold(parts: DicePart[]): SuccessThreshold {
  const sides = parts[0]?.sides ?? 6;
  const value = Math.min(Math.max(Math.ceil(sides / 2) + 1, 1), sides);
  return { direction: 'gte', value };
}

// A check needs somewhere to start that reads as a whole mechanic on the first
// look: roll what the row already rolls, clear the bar half the time, then deal
// a small effect. Nothing here is tuned to a system; every piece is one control
// away from being changed.
function seedCheckSpec(parts: DicePart[]): CheckSpec {
  const sides = parts[0]?.sides ?? 20;
  return {
    threshold: { direction: 'gte', value: Math.min(10, sides) },
    effect: { parts: [{ id: newId('part'), count: 1, sides: 6 }], flatModifier: 0 },
    onSuccess: 'full',
    onFailure: 'none',
  };
}

// Envelopes written before the normalize choke point existed can carry rules
// the editors can no longer reach (a critical face the shrunken die cannot
// show); repairing them on the way in heals old saves instead of letting the
// stale rule persist. The validator itself stays as strict as it was, so
// nothing previously valid is wiped.
function validateAndNormalize(raw: unknown): PersistedState | null {
  const state = validatePersistedState(raw);
  if (state === null) return null;
  return { ...state, expressions: state.expressions.map(normalizeExpression) };
}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  // Spec name, legacy code (22), and Firefox-specific name.
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const quotaToastFired = useRef(false);

  const onWriteError = useCallback((err: unknown) => {
    if (!isQuotaError(err) || quotaToastFired.current) return;
    quotaToastFired.current = true;
    toaster.create({
      type: 'error',
      title: 'Browser storage is full',
      description:
        'Edits will stop saving until you free up space. Export your table from the Share menu to back it up.',
      duration: 10000,
    });
  }, []);

  const [state, setState] = useLocalStorage<PersistedState>(
    STORAGE_KEY,
    initialState,
    {
      version: ENVELOPE_VERSION,
      validate: validateAndNormalize,
      onWriteError,
    },
  );

  // Every row edit funnels through here, so normalizeExpression only has to be
  // right in one place for no mutation to be able to persist an invariant break.
  const updateExpressionInList = useCallback(
    (id: string, mapper: (expr: Expression) => Expression) => {
      setState((prev) => ({
        ...prev,
        expressions: prev.expressions.map((e) =>
          e.id === id ? normalizeExpression(mapper(e)) : e,
        ),
      }));
    },
    [setState],
  );

  const setExpandedId = useCallback(
    (id: string | null) => {
      setState((prev) => ({ ...prev, ui: { ...prev.ui, expandedId: id } }));
    },
    [setState],
  );

  const setBaselineId = useCallback(
    (id: string | null) => {
      setState((prev) => ({ ...prev, ui: { ...prev.ui, baselineId: id } }));
    },
    [setState],
  );

  const setChartView = useCallback(
    (surface: ChartSurface, view: ChartView) => {
      setState((prev) => ({
        ...prev,
        ui: { ...prev.ui, chartViews: { ...prev.ui.chartViews, [surface]: view } },
      }));
    },
    [setState],
  );

  const setTargetSubView = useCallback(
    (subView: TargetSubView) => {
      setState((prev) => ({ ...prev, ui: { ...prev.ui, targetSubView: subView } }));
    },
    [setState],
  );

  const setTargetFilter = useCallback(
    (filter: TargetKindFilter) => {
      setState((prev) => ({ ...prev, ui: { ...prev.ui, targetFilter: filter } }));
    },
    [setState],
  );

  const setTargetSort = useCallback(
    (sort: GridSort | null) => {
      setState((prev) => ({ ...prev, ui: { ...prev.ui, targetSort: sort } }));
    },
    [setState],
  );

  const setRollOffSort = useCallback(
    (sort: RollOffSort) => {
      setState((prev) => ({ ...prev, ui: { ...prev.ui, rollOffSort: sort } }));
    },
    [setState],
  );

  const setView = useCallback(
    (view: WorkshopView) => {
      setState((prev) => ({ ...prev, ui: { ...prev.ui, view } }));
    },
    [setState],
  );

  const setTarget = useCallback(
    (patch: TargetPatch) => {
      setState((prev) => {
        const next: TargetState = { ...prev.ui.target };
        if (patch.values !== undefined) {
          const seen = new Set<number>();
          const cleaned: number[] = [];
          for (const v of patch.values) {
            if (!Number.isInteger(v)) continue;
            if (seen.has(v)) continue;
            seen.add(v);
            cleaned.push(v);
            if (cleaned.length >= MAX_TARGETS) break;
          }
          cleaned.sort((a, b) => a - b);
          next.values = cleaned;
        }
        if (patch.ruling !== undefined) next.ruling = patch.ruling;
        return { ...prev, ui: { ...prev.ui, target: next } };
      });
    },
    [setState],
  );

  const setPoolTargets = useCallback(
    (values: number[]) => {
      setState((prev) => {
        const seen = new Set<number>();
        const cleaned: number[] = [];
        for (const v of values) {
          if (!Number.isInteger(v)) continue;
          const value = Math.max(1, v);
          if (seen.has(value)) continue;
          seen.add(value);
          cleaned.push(value);
          if (cleaned.length >= MAX_TARGETS) break;
        }
        // A pool row's Hit % is not opt-in the way a sum row's is, so emptying
        // the list would leave those rows with nothing to answer.
        if (cleaned.length === 0) return prev;
        cleaned.sort((a, b) => a - b);
        return { ...prev, ui: { ...prev.ui, poolTargets: cleaned } };
      });
    },
    [setState],
  );

  const addExpression = useCallback(() => {
    setState((prev) => {
      if (prev.expressions.length >= MAX_EXPRESSIONS) {
        toaster.create({
          type: 'info',
          title: `Up to ${MAX_EXPRESSIONS} rolls`,
          description: 'Delete a row to add another.',
        });
        return prev;
      }
      const created = defaultExpression(nextDefaultName(prev.expressions));
      return {
        ...prev,
        expressions: [...prev.expressions, created],
        ui: { ...prev.ui, expandedId: created.id },
      };
    });
  }, [setState]);

  const duplicateExpression = useCallback(
    (id: string) => {
      setState((prev) => {
        const source = prev.expressions.find((e) => e.id === id);
        if (!source) return prev;
        if (prev.expressions.length >= MAX_EXPRESSIONS) {
          toaster.create({
            type: 'info',
            title: `Up to ${MAX_EXPRESSIONS} rolls`,
            description: 'Delete a row to add another.',
          });
          return prev;
        }
        const copy: Expression = {
          ...reIdExpression(source),
          name: `${source.name} (copy)`,
        };
        const idx = prev.expressions.findIndex((e) => e.id === id);
        const next = [...prev.expressions];
        next.splice(idx + 1, 0, copy);
        return {
          ...prev,
          expressions: next,
          ui: { ...prev.ui, expandedId: copy.id },
        };
      });
    },
    [setState],
  );

  const deleteExpression = useCallback(
    (id: string) => {
      setState((prev) => {
        const remaining = prev.expressions.filter((e) => e.id !== id);
        const nextExpanded =
          prev.ui.expandedId === id ? null : prev.ui.expandedId;
        const nextBaseline =
          prev.ui.baselineId === id ? null : prev.ui.baselineId;
        return {
          ...prev,
          expressions: remaining,
          ui: { ...prev.ui, expandedId: nextExpanded, baselineId: nextBaseline },
        };
      });
    },
    [setState],
  );

  const renameExpression = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      const finalName = trimmed.length > 0 ? trimmed : 'Untitled';
      updateExpressionInList(id, (e) => ({ ...e, name: finalName }));
    },
    [updateExpressionInList],
  );

  const updateExpression = useCallback(
    (id: string, patch: ExpressionPatch) => {
      updateExpressionInList(id, (e) => {
        const next: Expression = { ...e };
        if (patch.name !== undefined) next.name = patch.name;
        if (patch.flatModifier !== undefined) next.flatModifier = patch.flatModifier;
        if (patch.rollMode !== undefined) next.rollMode = patch.rollMode;
        // Switching modes only seeds what the new mode needs; the fields the
        // new mode cannot read (threshold, check, keepAcross, per-part rules)
        // are stripped by normalizeExpression on the way into the list. The
        // row's dice become the check roll, which is the least surprising place
        // for them: the Mod column keeps meaning "the modifier on the roll you
        // make".
        if (patch.mode !== undefined && patch.mode !== e.mode) {
          next.mode = patch.mode;
          if (patch.mode === 'pool') {
            next.successThreshold = seedSuccessThreshold(e.parts);
          } else if (patch.mode === 'check') {
            next.check = e.check ?? seedCheckSpec(e.parts);
          }
        }
        if ('successThreshold' in patch) {
          if (patch.successThreshold) next.successThreshold = patch.successThreshold;
          else delete next.successThreshold;
        }
        if ('keepAcross' in patch) {
          if (patch.keepAcross) next.keepAcross = patch.keepAcross;
          else delete next.keepAcross;
        }
        if ('check' in patch) {
          if (patch.check) next.check = patch.check;
          else delete next.check;
        }
        return next;
      });
    },
    [updateExpressionInList],
  );

  const setAllRollModes = useCallback(
    (mode: RollMode) => {
      setState((prev) => {
        if (prev.expressions.every((e) => e.rollMode === mode)) return prev;
        return {
          ...prev,
          expressions: prev.expressions.map((e) =>
            e.rollMode === mode ? e : { ...e, rollMode: mode },
          ),
        };
      });
    },
    [setState],
  );

  const addPart = useCallback(
    (exprId: string) => {
      updateExpressionInList(exprId, (e) => ({
        ...e,
        parts: [...e.parts, defaultPart()],
      }));
    },
    [updateExpressionInList],
  );

  const removePart = useCallback(
    (exprId: string, partId: string) => {
      updateExpressionInList(exprId, (e) => ({
        ...e,
        parts: e.parts.filter((p) => p.id !== partId),
      }));
    },
    [updateExpressionInList],
  );

  const updatePart = useCallback(
    (exprId: string, partId: string, patch: PartPatch) => {
      updateExpressionInList(exprId, (e) => ({
        ...e,
        parts: e.parts.map((p) => (p.id === partId ? applyPartPatch(p, patch) : p)),
      }));
    },
    [updateExpressionInList],
  );

  const replaceExpressions = useCallback(
    (incoming: Expression[]) => {
      const capped = incoming.slice(0, MAX_EXPRESSIONS);
      // Imported rows bypass updateExpressionInList, so they get the same
      // repair pass here before they can reach the persisted envelope.
      const fresh = capped.map((e) => normalizeExpression(reIdExpression(e)));
      if (incoming.length > MAX_EXPRESSIONS) {
        toaster.create({
          type: 'info',
          title: `Kept the first ${MAX_EXPRESSIONS} rolls`,
          description: `The import had ${incoming.length}. Up to ${MAX_EXPRESSIONS} fit in one table.`,
        });
      }
      // replaceExpressions re-ids every row, so a spread-through baselineId
      // could never match again; null it here instead of leaking a stale id.
      setState((prev) => ({
        ...prev,
        expressions: fresh,
        ui: { ...prev.ui, expandedId: null, baselineId: null },
      }));
    },
    [setState],
  );

  const addExpressions = useCallback(
    (incoming: Expression[]) => {
      setState((prev) => {
        const room = MAX_EXPRESSIONS - prev.expressions.length;
        if (room <= 0) {
          toaster.create({
            type: 'info',
            title: `Up to ${MAX_EXPRESSIONS} rolls`,
            description: 'Delete some rows or replace the table to import more.',
          });
          return prev;
        }
        const accepted = incoming.slice(0, room);
        const renamed = renameCollisions(prev.expressions, accepted);
        const fresh = renamed.map((e) => normalizeExpression(reIdExpression(e)));
        if (incoming.length > room) {
          toaster.create({
            type: 'info',
            title: `Added ${accepted.length} of ${incoming.length} rolls`,
            description: `Table is now full at ${MAX_EXPRESSIONS}.`,
          });
        }
        return {
          ...prev,
          expressions: [...prev.expressions, ...fresh],
          ui: { ...prev.ui, expandedId: null },
        };
      });
    },
    [setState],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      expressions: state.expressions,
      expandedId: state.ui.expandedId,
      chartViews: state.ui.chartViews,
      target: state.ui.target,
      view: state.ui.view,
      poolTargets: state.ui.poolTargets,
      baselineId: state.ui.baselineId,
      targetSubView: state.ui.targetSubView,
      targetFilter: state.ui.targetFilter,
      targetSort: state.ui.targetSort,
      rollOffSort: state.ui.rollOffSort,
      setExpandedId,
      setBaselineId,
      setChartView,
      setView,
      setTargetSubView,
      setTargetFilter,
      setTargetSort,
      setRollOffSort,
      setTarget,
      setPoolTargets,
      addExpression,
      duplicateExpression,
      deleteExpression,
      renameExpression,
      updateExpression,
      setAllRollModes,
      addPart,
      removePart,
      updatePart,
      replaceExpressions,
      addExpressions,
    }),
    [
      state,
      setExpandedId,
      setBaselineId,
      setChartView,
      setView,
      setTargetSubView,
      setTargetFilter,
      setTargetSort,
      setRollOffSort,
      setTarget,
      setPoolTargets,
      addExpression,
      duplicateExpression,
      deleteExpression,
      renameExpression,
      updateExpression,
      setAllRollModes,
      addPart,
      removePart,
      updatePart,
      replaceExpressions,
      addExpressions,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
