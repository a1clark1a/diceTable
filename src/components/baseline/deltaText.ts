import { formatNumber, type DeltaTone } from '../chart/format';

export function deltaToneColor(
  tone: DeltaTone,
): 'hit.good' | 'hit.bad' | 'fg.muted' {
  if (tone === 'good') return 'hit.good';
  if (tone === 'bad') return 'hit.bad';
  return 'fg.muted';
}

export function avgDeltaAria(delta: number, tone: DeltaTone): string {
  if (tone === 'same') return 'same average as baseline';
  const direction = delta > 0 ? 'higher' : 'lower';
  return `${formatNumber(Math.abs(delta), 2)} ${direction} than baseline`;
}

export function spreadDeltaAria(delta: number, tone: DeltaTone): string {
  if (tone === 'same') return 'same spread as baseline';
  const direction = delta > 0 ? 'more' : 'less';
  return `${formatNumber(Math.abs(delta), 2)} ${direction} spread than baseline`;
}

export function hitDeltaAria(delta: number, tone: DeltaTone): string {
  if (tone === 'same') return 'hits about as often as baseline';
  const direction = delta > 0 ? 'more' : 'less';
  return `hits ${Math.abs(delta * 100).toFixed(1)} points ${direction} often than baseline`;
}
