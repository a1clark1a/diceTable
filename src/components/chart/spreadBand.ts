import { sortedKeys } from '../../engine/distribution';
import { middleRange } from '../../engine/stats';
import type { Distribution } from '../../types';

/**
 * The share of results the spread band covers, from the 10th percentile to the
 * 90th. The copy says "most" rather than a figure, because on discrete dice
 * the band always covers at least this much and usually more.
 */
export const SPREAD_BAND_MASS = 0.8;

/**
 * Low enough that the curve and its fill read through the band in both colour
 * modes, so the band frames the shape instead of competing with it.
 */
export const SPREAD_BAND_OPACITY = 0.1;

/**
 * Recharts paints by layer, not by order: above the grid (-100) so the band is
 * not hidden by it, below areas (100) and lines (400) so it never covers them.
 */
export const SPREAD_BAND_Z_INDEX = -50;

/**
 * Where the band sits, or null when it would cover every result: a flat roll
 * like 1d8 lands anywhere equally, and a band over all of it says nothing.
 */
export function spreadBand(dist: Distribution): [number, number] | null {
  if (dist.size === 0) return null;
  const keys = sortedKeys(dist);
  const [lo, hi] = middleRange(dist, SPREAD_BAND_MASS);
  if (lo === keys[0] && hi === keys[keys.length - 1]) return null;
  return [lo, hi];
}
