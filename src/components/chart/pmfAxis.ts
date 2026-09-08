export interface PmfYAxis {
  domainMax: number;
  ticks: number[];
}

const NICE_STEPS = [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.15, 0.2, 0.25];

// PMF probabilities have no fixed ceiling, so let the axis end on a round
// fraction with evenly spaced ticks instead of whatever the raw peak happens to
// be (which produced awkward 0 / 6 / 11 / 17 / 23 %). The peak comes from the
// zero-spike plan rather than the data, so a capped miss bar cannot set it.
export function buildPmfYAxis(max: number): PmfYAxis {
  if (max <= 0) return { domainMax: 0.1, ticks: [0, 0.05, 0.1] };
  const rawStep = max / 4;
  const step = NICE_STEPS.find((s) => s >= rawStep) ?? 0.25;
  const domainMax = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= domainMax + 1e-9; t += step) {
    ticks.push(Number(t.toFixed(4)));
  }
  return { domainMax, ticks };
}
