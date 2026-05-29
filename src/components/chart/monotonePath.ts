import type { Point } from './stepPath';

export function buildMonotonePath(points: Point[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) {
    const p = points[0]!;
    return `M ${p.x} ${p.y}`;
  }
  if (n === 2) {
    const a = points[0]!;
    const b = points[1]!;
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }

  const m = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b.x - a.x;
    m[i] = dx === 0 ? 0 : (b.y - a.y) / dx;
  }

  const t = new Array<number>(n);
  t[0] = m[0]!;
  t[n - 1] = m[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    const m0 = m[i - 1]!;
    const m1 = m[i]!;
    t[i] = m0 * m1 <= 0 ? 0 : (m0 + m1) / 2;
  }

  for (let i = 0; i < n - 1; i++) {
    const mi = m[i]!;
    if (mi === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i]! / mi;
    const b = t[i + 1]! / mi;
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * mi;
      t[i + 1] = k * b * mi;
    }
  }

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = (b.x - a.x) / 3;
    const cp1x = a.x + dx;
    const cp1y = a.y + t[i]! * dx;
    const cp2x = b.x - dx;
    const cp2y = b.y - t[i + 1]! * dx;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${b.x} ${b.y}`;
  }
  return d;
}
