export const EM_DASH = '—';

export function formatNumber(value: number, fractionDigits: number): string {
  if (!Number.isFinite(value)) return EM_DASH;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** formatPercent without a redundant trailing .0, for space-tight chart labels. */
export function formatPercentCompact(value: number): string {
  return formatPercent(value).replace('.0%', '%');
}

// True minus (U+2212), same advance width as + in tabular figures; a hyphen
// would make negative deltas visually narrower than positive ones.
const MINUS_SIGN = '−';

/** Signed delta; a value that rounds to zero renders unsigned so it never claims a direction. */
export function formatDelta(value: number, fractionDigits: number): string {
  if (!Number.isFinite(value)) return EM_DASH;
  const magnitude = formatNumber(Math.abs(value), fractionDigits);
  if (magnitude === formatNumber(0, fractionDigits)) return magnitude;
  return (value > 0 ? '+' : MINUS_SIGN) + magnitude;
}

/** Signed percentage-point delta, one decimal; zero renders unsigned. */
export function formatPercentDelta(value: number): string {
  if (!Number.isFinite(value)) return EM_DASH;
  const points = Math.abs(value * 100).toFixed(1);
  if (points === '0.0') return '0.0%';
  return (value > 0 ? '+' : MINUS_SIGN) + points + '%';
}

export type DeltaTone = 'good' | 'bad' | 'same';

/** Pick eps at half the last printed decimal so a delta that prints as zero tones as 'same'. */
export function deltaTone(value: number, eps: number): DeltaTone {
  if (!Number.isFinite(value) || Math.abs(value) < eps) return 'same';
  return value > 0 ? 'good' : 'bad';
}

// ~px per glyph of 10px ui-monospace; used to decide whether a label fits.
const LABEL_CHAR_WIDTH = 6.1;
// Adjacent bars sit one intra-group gap (4px) apart; keep 2px of whitespace
// between neighboring labels.
const LABEL_PITCH_SLACK = 2;

/** fitChars is the longest label in the chart, so labels turn on or off as one group. */
export function targetLabelFits(fitChars: number, width: number): boolean {
  return fitChars * LABEL_CHAR_WIDTH <= width + LABEL_PITCH_SLACK;
}
