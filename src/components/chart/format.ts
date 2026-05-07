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
