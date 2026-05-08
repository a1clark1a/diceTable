import { createContext, useContext } from 'react';
import type {
  ChartView,
  Expression,
  ExplodeRule,
  KeepRule,
  RerollRule,
  RollMode,
  TargetRuling,
  TargetState,
} from '../types';

export type ExpressionPatch = {
  name?: string;
  flatModifier?: number;
  rollMode?: RollMode;
};

export type PartPatch = {
  count?: number;
  sides?: number;
  keep?: KeepRule | undefined;
  reroll?: RerollRule | undefined;
  explode?: ExplodeRule | undefined;
};

export type TargetPatch = {
  value?: number | null;
  ruling?: TargetRuling;
};

export interface AppContextValue {
  expressions: Expression[];
  expandedId: string | null;
  chartView: ChartView;
  target: TargetState;
  setExpandedId: (id: string | null) => void;
  setChartView: (view: ChartView) => void;
  setTarget: (patch: TargetPatch) => void;
  addExpression: () => void;
  duplicateExpression: (id: string) => void;
  deleteExpression: (id: string) => void;
  renameExpression: (id: string, name: string) => void;
  updateExpression: (id: string, patch: ExpressionPatch) => void;
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
