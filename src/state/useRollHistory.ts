import { createContext, useContext } from 'react';
import type { Distribution } from '../types';

export const HISTORY_LIMIT = 10;

export interface RollHistoryValue {
  roll: (exprId: string, dist: Distribution) => number | null;
  rollMany: (exprId: string, dist: Distribution, count: number) => number[];
  getHistory: (exprId: string) => readonly number[];
  lastResult: (exprId: string) => number | null;
  clearHistory: (exprId: string) => void;
}

export const RollHistoryContext = createContext<RollHistoryValue | null>(null);

export function useRollHistory(): RollHistoryValue {
  const ctx = useContext(RollHistoryContext);
  if (ctx === null) {
    throw new Error('useRollHistory must be used within RollHistoryProvider');
  }
  return ctx;
}
