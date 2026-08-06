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

// ~px per glyph of 10px ui-monospace; used to decide whether a label fits.
const LABEL_CHAR_WIDTH = 6.1;
// Adjacent bars sit one intra-group gap (4px) apart; keep 2px of whitespace
// between neighboring labels.
const LABEL_PITCH_SLACK = 2;

/** fitChars is the longest label in the chart, so labels turn on or off as one group. */
export function targetLabelFits(fitChars: number, width: number): boolean {
  return fitChars * LABEL_CHAR_WIDTH <= width + LABEL_PITCH_SLACK;
}
