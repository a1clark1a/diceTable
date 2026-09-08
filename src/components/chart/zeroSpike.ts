import type { Distribution } from '../../types';
import { formatWholePercent } from './format';
import { buildPmfYAxis, type PmfYAxis } from './pmfAxis';

// A check row that misses two times in three puts two thirds of its mass on a
// single result. Scaled honestly, that one bar is three times taller than any
// other row's peak and flattens every curve on the chart into a floor. Capping
// it keeps the comparison readable; the exact number is never hidden, it moves
// to the marker's label, the tooltip, and the description below the chart.
const MISS_VALUE = 0;

const EPSILON = 1e-9;

export interface ZeroSpikeRow {
  id: string;
  name: string;
  color: string;
  /** Only rows that can come up empty pile mass on a single "nothing" result. */
  canMiss: boolean;
  dist: Distribution;
}

export interface ZeroSpikeMarker {
  id: string;
  name: string;
  color: string;
  probability: number;
}

export interface ZeroSpikePlan {
  /** The highest probability the axis has to show. */
  peak: number;
  /**
   * The y-axis rounded up from the peak. Bars actually render against its
   * domainMax, so markers are gated on that top rather than the raw peak, and
   * consumers must draw this axis instead of rebuilding one from `peak`.
   */
  axis: PmfYAxis;
  /** Miss bars taller than the axis, tallest first. */
  markers: ZeroSpikeMarker[];
}

export function missProbability(dist: Distribution, canMiss: boolean): number {
  if (!canMiss) return 0;
  return dist.get(MISS_VALUE) ?? 0;
}

/**
 * The tallest bar one row asks the axis for. A row that can miss leaves its
 * miss bar out; a row that only ever misses asks for nothing, so it cannot
 * squash every other row's curve, and the plan restores its miss bar as the
 * scale only when no row sets one.
 */
export function rowPeak(dist: Distribution, canMiss: boolean): number {
  let peak = 0;
  for (const [value, p] of dist) {
    if (canMiss && value === MISS_VALUE) continue;
    if (p > peak) peak = p;
  }
  return peak;
}

export function planZeroSpikes(rows: readonly ZeroSpikeRow[]): ZeroSpikePlan {
  let peak = 0;
  let tallestMiss = 0;
  for (const row of rows) {
    const rowMax = rowPeak(row.dist, row.canMiss);
    if (rowMax > peak) peak = rowMax;
    const miss = missProbability(row.dist, row.canMiss);
    if (miss > tallestMiss) tallestMiss = miss;
  }
  // A table where missing is all any row ever does has nothing else to scale
  // against; the tallest miss bar sets the axis rather than rendering nothing.
  if (peak === 0) peak = tallestMiss;

  const axis = buildPmfYAxis(peak);

  const markers: ZeroSpikeMarker[] = [];
  for (const row of rows) {
    const miss = missProbability(row.dist, row.canMiss);
    // The axis top is rounded up from the peak, so a miss bar inside that
    // headroom renders at full height and a "cut off" note would be a lie.
    if (miss > axis.domainMax + EPSILON) {
      markers.push({
        id: row.id,
        name: row.name,
        color: row.color,
        probability: miss,
      });
    }
  }
  markers.sort((a, b) => b.probability - a.probability);

  return { peak, axis, markers };
}

/** Marker labels and the chart description share the hedged whole-percent voice. */
export const formatMissPercent = formatWholePercent;

export function missDescription(markers: readonly ZeroSpikeMarker[]): string {
  if (markers.length === 0) return '';
  const parts = markers.map(
    (m) => `${m.name} comes up empty ${formatMissPercent(m.probability)} of the time`,
  );
  return `${parts.join('. ')}. Those bars are cut off so the other rolls stay readable.`;
}
