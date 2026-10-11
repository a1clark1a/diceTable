import { createContext, useContext } from 'react';
import type {
  ChartSurface,
  ChartView,
  CheckSpec,
  Expression,
  ExpressionMode,
  ExplodeRule,
  GridSort,
  KeepRule,
  ModStep,
  RerollRule,
  RollMode,
  RollOffSort,
  SuccessThreshold,
  TargetKindFilter,
  TargetSubView,
  TargetRuling,
  TargetState,
  WorkshopView,
} from '../types';
import type { SweepTarget } from './sweep';

export type ExpressionPatch = {
  /** The check roll's modifier. Sum and pool rows edit `mods` instead. */
  flatModifier?: number;
  mods?: ModStep[] | undefined;
  rollMode?: RollMode;
  mode?: ExpressionMode;
  successThreshold?: SuccessThreshold | undefined;
  keepAcross?: KeepRule | undefined;
  check?: CheckSpec | undefined;
  note?: string | undefined;
};

export type PartPatch = {
  count?: number;
  sides?: number;
  keep?: KeepRule | undefined;
  reroll?: RerollRule | undefined;
  explode?: ExplodeRule | undefined;
};

export type TargetPatch = {
  values?: number[];
  ruling?: TargetRuling;
};

export interface AppContextValue {
  expressions: Expression[];
  expandedId: string | null;
  chartViews: Record<ChartSurface, ChartView>;
  target: TargetState;
  view: WorkshopView;
  poolTargets: number[];
  baselineId: string | null;
  targetSubView: TargetSubView;
  targetFilter: TargetKindFilter;
  targetSort: GridSort | null;
  rollOffSort: RollOffSort;
  setExpandedId: (id: string | null) => void;
  setBaselineId: (id: string | null) => void;
  setChartView: (surface: ChartSurface, view: ChartView) => void;
  setView: (view: WorkshopView) => void;
  setTarget: (patch: TargetPatch) => void;
  setPoolTargets: (values: number[]) => void;
  setTargetSubView: (subView: TargetSubView) => void;
  setTargetFilter: (filter: TargetKindFilter) => void;
  setTargetSort: (sort: GridSort | null) => void;
  setRollOffSort: (sort: RollOffSort) => void;
  addExpression: () => void;
  deleteExpression: (id: string) => void;
  duplicateExpression: (id: string) => void;
  moveExpression: (id: string, delta: -1 | 1) => void;
  sweepExpression: (id: string, target: SweepTarget, values: readonly number[]) => void;
  renameExpression: (id: string, name: string) => void;
  updateExpression: (id: string, patch: ExpressionPatch) => void;
  setAllRollModes: (mode: RollMode) => void;
  addPart: (exprId: string) => void;
  removePart: (exprId: string, partId: string) => void;
  updatePart: (exprId: string, partId: string, patch: PartPatch) => void;
  replaceExpressions: (exprs: Expression[]) => void;
  addExpressions: (exprs: Expression[]) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (ctx === null) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}
