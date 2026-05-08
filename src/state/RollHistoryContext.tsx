import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { Distribution } from '../types';
import { sampleDistribution } from '../engine/sample';
import { useApp } from './useApp';
import {
  HISTORY_LIMIT,
  RollHistoryContext,
  type RollHistoryValue,
} from './useRollHistory';

const EMPTY_HISTORY: readonly number[] = Object.freeze([]);

function pruneHistories(
  histories: Map<string, number[]>,
  validIds: Set<string>,
): Map<string, number[]> {
  let needsPrune = false;
  for (const id of histories.keys()) {
    if (!validIds.has(id)) {
      needsPrune = true;
      break;
    }
  }
  if (!needsPrune) return histories;
  const next = new Map<string, number[]>();
  for (const [id, hist] of histories) {
    if (validIds.has(id)) next.set(id, hist);
  }
  return next;
}

export function RollHistoryProvider({ children }: { children: ReactNode }) {
  const { expressions } = useApp();
  const [histories, setHistories] = useState<Map<string, number[]>>(
    () => new Map(),
  );
  const [lastIdSig, setLastIdSig] = useState('');

  const idSig = expressions.map((e) => e.id).join('|');
  if (idSig !== lastIdSig) {
    setLastIdSig(idSig);
    if (histories.size > 0) {
      const validIds = new Set(expressions.map((e) => e.id));
      const pruned = pruneHistories(histories, validIds);
      if (pruned !== histories) setHistories(pruned);
    }
  }

  const roll = useCallback(
    (exprId: string, dist: Distribution): number | null => {
      const result = sampleDistribution(dist);
      if (result === null) return null;
      setHistories((prev) => {
        const next = new Map(prev);
        const existing = next.get(exprId) ?? [];
        next.set(exprId, [result, ...existing].slice(0, HISTORY_LIMIT));
        return next;
      });
      return result;
    },
    [],
  );

  const rollMany = useCallback(
    (exprId: string, dist: Distribution, count: number): number[] => {
      if (count <= 0 || dist.size === 0) return [];
      const results: number[] = [];
      for (let i = 0; i < count; i++) {
        const r = sampleDistribution(dist);
        if (r === null) break;
        results.push(r);
      }
      if (results.length === 0) return [];
      setHistories((prev) => {
        const next = new Map(prev);
        const existing = next.get(exprId) ?? [];
        const reversed = results.slice().reverse();
        next.set(exprId, [...reversed, ...existing].slice(0, HISTORY_LIMIT));
        return next;
      });
      return results;
    },
    [],
  );

  const getHistory = useCallback(
    (exprId: string): readonly number[] => histories.get(exprId) ?? EMPTY_HISTORY,
    [histories],
  );

  const lastResult = useCallback(
    (exprId: string): number | null => histories.get(exprId)?.[0] ?? null,
    [histories],
  );

  const clearHistory = useCallback((exprId: string): void => {
    setHistories((prev) => {
      if (!prev.has(exprId)) return prev;
      const next = new Map(prev);
      next.delete(exprId);
      return next;
    });
  }, []);

  const value = useMemo<RollHistoryValue>(
    () => ({ roll, rollMany, getHistory, lastResult, clearHistory }),
    [roll, rollMany, getHistory, lastResult, clearHistory],
  );

  return (
    <RollHistoryContext.Provider value={value}>
      {children}
    </RollHistoryContext.Provider>
  );
}
