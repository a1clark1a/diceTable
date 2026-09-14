import {
  deltaTone,
  formatDelta,
  formatNumber,
  formatPercent,
  formatPercentDelta,
  type DeltaTone,
} from '../chart/format';
import { rulingPlainLabel } from '../targetRulingMeta';
import type { RowStats } from '../../state/rowStats';
import type { TargetState } from '../../types';
import {
  HIT_DELTA_EPS,
  STAT_DELTA_EPS,
  type BaselineComparison,
} from './comparison';
import { buildVerdict, verdictSpeech } from './verdict';

export interface CompareRow {
  label: string;
  /** This roll. */
  value: string;
  /** The pinned baseline. */
  base: string;
  delta: string;
  tone: DeltaTone;
  /** Spread has no good direction, the same rule DeltaValue follows. */
  neutral?: boolean;
}

export interface RowCompare {
  baselineName: string;
  /** The printed sentence, middots and all. */
  verdict: string;
  /** The same sentence with commas, for an accessible name. */
  speech: string;
  crossScale: boolean;
  crossScaleTip: 'differentScale' | 'differentScaleHit';
  rows: CompareRow[];
}

export interface RowCompareInput {
  stats: RowStats;
  isPool: boolean;
  sameScale: boolean;
  hasHitValue: boolean;
  /** Pool rows: the pool-target hit. Null when no targets are set. */
  firstHit: number | null;
  comparison: BaselineComparison;
  target: TargetState;
  poolTargets: number[];
}

// Across scales the two hit numbers answer different questions, so naming one
// target for both would be a lie.
function hitLabel(input: RowCompareInput): string {
  if (!input.sameScale) return 'Hit chance';
  if (input.isPool) {
    const first = input.poolTargets[0];
    return first === undefined ? 'Hit chance' : `Hit ${first}+ successes`;
  }
  const first = input.target.values[0];
  return first === undefined
    ? 'Hit chance'
    : `Hit ${rulingPlainLabel(input.target.ruling, first)}`;
}

/**
 * One builder for both layouts. The table and the cards had drifted into
 * describing the same comparison two different ways, and the table was throwing
 * the cross-scale verdict away entirely.
 */
export function buildRowCompare(input: RowCompareInput): RowCompare {
  const { stats, isPool, sameScale, comparison } = input;
  const verdict = buildVerdict({
    mean: stats.mean,
    stddev: stats.stddev,
    isPool,
    firstHit: input.firstHit,
    baseMean: comparison.stats.mean,
    baseStddev: comparison.stats.stddev,
    baseIsPool: comparison.isPool,
    baseFirstHit: comparison.hits?.[0] ?? null,
  });

  const rows: CompareRow[] = [];
  if (sameScale) {
    const meanDelta = stats.mean - comparison.stats.mean;
    rows.push({
      label: 'Average',
      value: formatNumber(stats.mean, 2),
      base: formatNumber(comparison.stats.mean, 2),
      delta: formatDelta(meanDelta, 2),
      tone: deltaTone(meanDelta, STAT_DELTA_EPS),
    });
    const sigmaDelta = stats.stddev - comparison.stats.stddev;
    rows.push({
      label: 'Spread',
      value: formatNumber(stats.stddev, 2),
      base: formatNumber(comparison.stats.stddev, 2),
      delta: formatDelta(sigmaDelta, 2),
      tone: deltaTone(sigmaDelta, STAT_DELTA_EPS),
      neutral: true,
    });
  }

  const baseHit = comparison.hits?.[0];
  if (input.firstHit !== null && baseHit !== undefined) {
    const hitDelta = input.firstHit - baseHit;
    rows.push({
      label: hitLabel(input),
      value: formatPercent(input.firstHit),
      base: formatPercent(baseHit),
      delta: formatPercentDelta(hitDelta),
      tone: deltaTone(hitDelta, HIT_DELTA_EPS),
    });
  }

  return {
    baselineName: comparison.name,
    verdict,
    speech: verdictSpeech(verdict),
    crossScale: !sameScale,
    crossScaleTip: input.hasHitValue ? 'differentScaleHit' : 'differentScale',
    rows,
  };
}
