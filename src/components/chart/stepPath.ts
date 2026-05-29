export interface Point {
  x: number;
  y: number;
}

export interface StepOpts {
  stepWidth: number;
}

export function buildStepPath(points: Point[], opts: StepOpts): string {
  if (points.length === 0) return '';
  const { stepWidth } = opts;
  const first = points[0]!;
  let d = `M ${first.x} ${first.y} L ${first.x + stepWidth} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const prevEnd = prev.x + stepWidth;
    if (curr.x !== prevEnd) {
      d += ` L ${curr.x} ${prev.y}`;
    }
    if (curr.y !== prev.y) {
      d += ` L ${curr.x} ${curr.y}`;
    }
    d += ` L ${curr.x + stepWidth} ${curr.y}`;
  }
  return d;
}

export function buildStepAreaPath(
  points: Point[],
  baselineY: number,
  opts: StepOpts,
): string {
  if (points.length === 0) return '';
  const top = buildStepPath(points, opts);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const rightX = last.x + opts.stepWidth;
  return `${top} L ${rightX} ${baselineY} L ${first.x} ${baselineY} Z`;
}
