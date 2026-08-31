import type { ChartView, Distribution } from '../../types';

// One home for how a row's distribution turns into chart points, shared by the
// live overlay chart and the share-image renderer so an exported chart can
// never disagree with the one on screen.
export interface SeriesEval {
  dist: Distribution;
  min: number;
  max: number;
  /** Dense running total over [min, max]; cdf[i] = P(X <= min + i). */
  cdf: Float64Array;
}

export function buildSeriesEval(
  dist: Distribution,
  min: number,
  max: number,
): SeriesEval {
  const span = max - min + 1;
  const cdf = new Float64Array(span);
  let cum = 0;
  for (let i = 0; i < span; i++) {
    cum += dist.get(min + i) ?? 0;
    cdf[i] = cum;
  }
  return { dist, min, max, cdf };
}

// The cumulative views clamp at the ends instead of reading the array, so a
// running total that lands on 0.9999999 still draws a curve that reaches 1.
export function evalSeriesAt(s: SeriesEval, x: number, view: ChartView): number {
  switch (view) {
    case 'pmf':
    case 'target':
      return s.dist.get(x) ?? 0;
    case 'cdf': {
      if (x < s.min) return 0;
      if (x >= s.max) return 1;
      return s.cdf[x - s.min] ?? 0;
    }
    case 'ccdf': {
      if (x <= s.min) return 1;
      if (x > s.max) return 0;
      return 1 - (s.cdf[x - 1 - s.min] ?? 0);
    }
  }
}
