import { describe, expect, it } from 'vitest';
import { buildPmfYAxis } from './pmfAxis';

// A spread of peaks a real table can produce: a 300-bucket pool (0.1%), a d20
// (5%), 2d6 (17%), 3d6-ish (23%), a coin (50%) and a near-certain result.
const PEAKS = [0.001, 0.05, 0.17, 0.23, 0.5, 0.99];

const ROUND_TO_FOUR_DECIMALS = /^\d+(\.\d{1,4})?$/;

// One peak per rung of the step ladder, so every rung is pinned to a
// hand-computed axis rather than only being reachable through the ladder's
// two ends. domainMax and ticks are worked out as
// step = smallest nice step >= peak / 4, domainMax = ceil(peak / step) * step.
const STEP_CASES = [
  {
    label: 'a 0.1 percent peak gets a half-percent step',
    peak: 0.001,
    domainMax: 0.005,
    ticks: [0, 0.005],
  },
  {
    label: 'a 4 percent peak sitting exactly on a step keeps the tighter one',
    peak: 0.04,
    domainMax: 0.04,
    ticks: [0, 0.01, 0.02, 0.03, 0.04],
  },
  {
    label: 'a d20 peak gets a 2 percent step',
    peak: 0.05,
    domainMax: 0.06,
    ticks: [0, 0.02, 0.04, 0.06],
  },
  {
    label: 'a 9 percent peak gets a 2.5 percent step',
    peak: 0.09,
    domainMax: 0.1,
    ticks: [0, 0.025, 0.05, 0.075, 0.1],
  },
  {
    label: 'a 2d6 peak gets a 5 percent step',
    peak: 0.17,
    domainMax: 0.2,
    ticks: [0, 0.05, 0.1, 0.15, 0.2],
  },
  {
    label: 'a 3d6 peak gets a 10 percent step',
    peak: 0.23,
    domainMax: 0.3,
    ticks: [0, 0.1, 0.2, 0.3],
  },
  {
    label: 'a coin flip gets a 15 percent step',
    peak: 0.5,
    domainMax: 0.6,
    ticks: [0, 0.15, 0.3, 0.45, 0.6],
  },
  {
    label: 'a 70 percent peak gets a 20 percent step',
    peak: 0.7,
    domainMax: 0.8,
    ticks: [0, 0.2, 0.4, 0.6, 0.8],
  },
  {
    label: 'a near-certain peak gets the largest step',
    peak: 0.99,
    domainMax: 1,
    ticks: [0, 0.25, 0.5, 0.75, 1],
  },
] as const;

describe('buildPmfYAxis', () => {
  it.each(PEAKS)('ends the domain at or above a peak of %s', (peak) => {
    expect(buildPmfYAxis(peak).domainMax).toBeGreaterThanOrEqual(peak);
  });

  it.each(PEAKS)('leaves at most one spare step above a peak of %s', (peak) => {
    // Without this the axis could always run to 1 and still satisfy every
    // other property here, burying a 0.1% peak on the floor of the chart.
    const { ticks } = buildPmfYAxis(peak);
    expect(ticks[ticks.length - 2]!).toBeLessThan(peak);
  });

  it.each(PEAKS)('starts the ticks at 0 for a peak of %s', (peak) => {
    expect(buildPmfYAxis(peak).ticks[0]).toBe(0);
  });

  it.each(PEAKS)('spaces the ticks evenly for a peak of %s', (peak) => {
    const { ticks } = buildPmfYAxis(peak);
    expect(ticks.length).toBeGreaterThan(1);
    const step = ticks[1]! - ticks[0]!;
    expect(step).toBeGreaterThan(0);
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i]! - ticks[i - 1]!).toBeCloseTo(step, 9);
    }
  });

  it.each(PEAKS)('ends the ticks on the top of the domain for a peak of %s', (peak) => {
    const { domainMax, ticks } = buildPmfYAxis(peak);
    expect(ticks[ticks.length - 1]!).toBeCloseTo(domainMax, 9);
  });

  it.each(PEAKS)('keeps every tick a round number for a peak of %s', (peak) => {
    for (const tick of buildPmfYAxis(peak).ticks) {
      expect(String(tick)).toMatch(ROUND_TO_FOUR_DECIMALS);
    }
  });

  it.each(STEP_CASES)('$label', ({ peak, domainMax, ticks }) => {
    const axis = buildPmfYAxis(peak);
    expect(axis.ticks).toEqual(ticks);
    expect(axis.domainMax).toBeCloseTo(domainMax, 12);
  });

  it('ignores float noise in a peak that already lands on a step', () => {
    // Convolving a d10 three ways into one bucket yields 0.30000000000000004,
    // not 0.3. Taken at face value that overshoots the 30% tick and buys a
    // whole spare row of axis nobody asked for.
    const noisyThirtyPercent = 0.1 + 0.1 + 0.1;
    expect(noisyThirtyPercent).toBeGreaterThan(0.3);

    const axis = buildPmfYAxis(noisyThirtyPercent);
    expect(axis.ticks).toEqual([0, 0.1, 0.2, 0.3]);
    expect(axis.domainMax).toBeCloseTo(0.3, 12);
  });

  it('leaves a peak that already lands on a step exactly at the top', () => {
    expect(buildPmfYAxis(0.2)).toEqual({
      domainMax: 0.2,
      ticks: [0, 0.05, 0.1, 0.15, 0.2],
    });
  });

  it('tops the axis at 1 for a certain result', () => {
    expect(buildPmfYAxis(1)).toEqual({ domainMax: 1, ticks: [0, 0.25, 0.5, 0.75, 1] });
  });

  it('falls back to a tenth for a peak of 0', () => {
    expect(buildPmfYAxis(0)).toEqual({ domainMax: 0.1, ticks: [0, 0.05, 0.1] });
  });

  it('falls back to a tenth for a negative peak', () => {
    expect(buildPmfYAxis(-0.5)).toEqual({ domainMax: 0.1, ticks: [0, 0.05, 0.1] });
  });
});
