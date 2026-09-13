interface Support {
  min: number;
  max: number;
}

/**
 * The x positions one series actually needs inside a shared [lo, hi] domain:
 * its own support, plus at most two flat anchors a side.
 *
 * Outside its support a series is constant, so a far-away neighbour should
 * widen the axis with two extra points rather than thousands of samples. Two a
 * side and not one: with a single anchor at lo, `type="monotone"` ramps
 * gradually across the empty region instead of holding flat until the support
 * starts. TargetCurves already draws its rows this way.
 */
export function seriesXs(s: Support, lo: number, hi: number): number[] {
  const xs: number[] = [];
  if (lo < s.min) {
    xs.push(lo);
    if (s.min - 1 > lo) xs.push(s.min - 1);
  }
  for (let x = s.min; x <= s.max; x++) xs.push(x);
  if (hi > s.max) {
    if (s.max + 1 < hi) xs.push(s.max + 1);
    xs.push(hi);
  }
  return xs;
}
