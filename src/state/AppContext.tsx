import { useCallback, useMemo, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { validatePersistedState } from './persistedSchema';
import { defaultPart, newId } from './defaultPart';
import { renameCollisions } from '../share/rename';
import {
  AppContext,
  type AppContextValue,
  type ExpressionPatch,
  type PartPatch,
  type TargetPatch,
} from './useApp';
import type {
  ChartView,
  DicePart,
  Expression,
  PersistedState,
  TargetState,
} from '../types';

const STORAGE_KEY = 'dicetable.v2';
const STATE_VERSION = 2;

const seedExpression: Expression = {
  id: 'seed-4d6kh3',
  name: '4d6kh3 + 2 (adv)',
  parts: [
    {
      id: 'seed-4d6kh3-part',
      count: 4,
      sides: 6,
      keep: { type: 'highest', n: 3 },
    },
  ],
  flatModifier: 2,
  rollMode: 'advantage',
};

const initialState: PersistedState = {
  version: STATE_VERSION,
  expressions: [seedExpression],
  ui: {
    expandedId: null,
    chartView: 'pmf',
    target: { value: null, ruling: 'gte' },
  },
};

function defaultExpression(): Expression {
  return {
    id: newId('expr'),
    name: 'New roll',
    parts: [defaultPart()],
    flatModifier: 0,
    rollMode: 'normal',
  };
}

function reIdExpression(expr: Expression): Expression {
  return {
    ...expr,
    id: newId('expr'),
    parts: expr.parts.map((p) => ({ ...p, id: newId('part') })),
  };
}

function applyPartPatch(part: DicePart, patch: PartPatch): DicePart {
  const next: DicePart = { ...part };
  if (patch.count !== undefined) next.count = patch.count;
  if (patch.sides !== undefined) next.sides = patch.sides;
  if ('keep' in patch) {
    if (patch.keep) next.keep = patch.keep;
    else delete next.keep;
  }
  if ('reroll' in patch) {
    if (patch.reroll) next.reroll = patch.reroll;
    else delete next.reroll;
  }
  if ('explode' in patch) {
    if (patch.explode) next.explode = patch.explode;
    else delete next.explode;
  }
  return next;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<PersistedState>(
    STORAGE_KEY,
    initialState,
    { version: STATE_VERSION, validate: validatePersistedState },
  );

  const updateExpressionInList = useCallback(
    (id: string, mapper: (expr: Expression) => Expression) => {
      setState((prev) => ({
        ...prev,
        expressions: prev.expressions.map((e) => (e.id === id ? mapper(e) : e)),
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

  const setChartView = useCallback(
    (view: ChartView) => {
      setState((prev) => ({ ...prev, ui: { ...prev.ui, chartView: view } }));
    },
    [setState],
  );

  const setTarget = useCallback(
    (patch: TargetPatch) => {
      setState((prev) => {
        const next: TargetState = { ...prev.ui.target };
        if ('value' in patch) next.value = patch.value ?? null;
        if (patch.ruling !== undefined) next.ruling = patch.ruling;
        return { ...prev, ui: { ...prev.ui, target: next } };
      });
    },
    [setState],
  );

  const addExpression = useCallback(() => {
    const created = defaultExpression();
    setState((prev) => ({
      ...prev,
      expressions: [...prev.expressions, created],
      ui: { ...prev.ui, expandedId: created.id },
    }));
  }, [setState]);

  const duplicateExpression = useCallback(
    (id: string) => {
      setState((prev) => {
        const source = prev.expressions.find((e) => e.id === id);
        if (!source) return prev;
        const copy: Expression = {
          ...source,
          id: newId('expr'),
          name: `${source.name} (copy)`,
          parts: source.parts.map((p) => ({ ...p, id: newId('part') })),
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
        return {
          ...prev,
          expressions: remaining,
          ui: { ...prev.ui, expandedId: nextExpanded },
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
        return next;
      });
    },
    [updateExpressionInList],
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
      const fresh = incoming.map(reIdExpression);
      setState((prev) => ({
        ...prev,
        expressions: fresh,
        ui: { ...prev.ui, expandedId: null },
      }));
    },
    [setState],
  );

  const addExpressions = useCallback(
    (incoming: Expression[]) => {
      setState((prev) => {
        const renamed = renameCollisions(prev.expressions, incoming);
        const fresh = renamed.map(reIdExpression);
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
      chartView: state.ui.chartView,
      target: state.ui.target,
      setExpandedId,
      setChartView,
      setTarget,
      addExpression,
      duplicateExpression,
      deleteExpression,
      renameExpression,
      updateExpression,
      addPart,
      removePart,
      updatePart,
      replaceExpressions,
      addExpressions,
    }),
    [
      state,
      setExpandedId,
      setChartView,
      setTarget,
      addExpression,
      duplicateExpression,
      deleteExpression,
      renameExpression,
      updateExpression,
      addPart,
      removePart,
      updatePart,
      replaceExpressions,
      addExpressions,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
