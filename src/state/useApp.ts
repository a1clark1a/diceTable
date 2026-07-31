import { createContext, useContext } from 'react';
import type {
  ChartView,
  Expression,
  ExpressionMode,
  ExplodeRule,
  KeepRule,
  RerollRule,
  RollMode,
  SuccessThreshold,
  TargetRuling,
  TargetState,
  WorkshopView,
} from '../types';

export type ExpressionPatch = {
  name?: string;
  flatModifier?: number;
  rollMode?: RollMode;
  mode?: ExpressionMode;
  successThreshold?: SuccessThreshold | undefined;
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
  chartView: ChartView;
  target: TargetState;
  view: WorkshopView;
  poolTarget: number;
  setExpandedId: (id: string | null) => void;
  setChartView: (view: ChartView) => void;
  setView: (view: WorkshopView) => void;
  setTarget: (patch: TargetPatch) => void;
  setPoolTarget: (value: number) => void;
  addExpression: () => void;
  duplicateExpression: (id: string) => void;
  deleteExpression: (id: string) => void;
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
