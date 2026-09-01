import { describe, expect, it } from 'vitest';
import {
  formatMissPercent,
  missDescription,
  missProbability,
  planZeroSpikes,
  rowPeak,
  type ZeroSpikeMarker,
  type ZeroSpikeRow,
} from './zeroSpike';
import type { Distribution } from '../../types';

function dist(entries: readonly (readonly [number, number])[]): Distribution {
  return new Map(entries);
}

function row(over: Partial<ZeroSpikeRow>): ZeroSpikeRow {
  return {
    id: 'r',
    name: 'Roll',
    color: '#2563eb',
    canMiss: false,
    dist: dist([[1, 1]]),
    ...over,
  };
}

describe('missProbability', () => {
  it('returns 0 for a row that cannot come up empty even when zero has mass', () => {
    expect(missProbability(dist([[0, 0.4], [1, 0.6]]), false)).toBe(0);
  });

  it('returns the mass sitting on zero for a row that can come up empty', () => {
    expect(missProbability(dist([[0, 0.4], [1, 0.6]]), true)).toBeCloseTo(0.4, 12);
  });

  it('returns 0 when a row that can come up empty has no zero bucket', () => {
    expect(missProbability(dist([[3, 0.5], [4, 0.5]]), true)).toBe(0);
  });

  it('returns 0 for an empty distribution', () => {
    expect(missProbability(dist([]), true)).toBe(0);
  });
});

describe('rowPeak', () => {
  it('returns 0 for an empty distribution', () => {
    expect(rowPeak(dist([]), false)).toBe(0);
  });

  it('returns the only bar of a single-value distribution', () => {
    expect(rowPeak(dist([[7, 1]]), false)).toBe(1);
  });

  it('counts the zero bar for a row that cannot come up empty', () => {
    expect(rowPeak(dist([[0, 0.9], [1, 0.1]]), false)).toBeCloseTo(0.9, 12);
  });

  it('leaves the miss bar out of the peak for a row that can come up empty', () => {
    expect(rowPeak(dist([[0, 0.9], [1, 0.06], [2, 0.04]]), true)).toBeCloseTo(0.06, 12);
  });

  it('asks for nothing when missing is all the row ever does', () => {
    // The lone-row fallback lives in planZeroSpikes; per row this must stay 0
    // so one all-miss row cannot set the shared scale for the whole chart.
    expect(rowPeak(dist([[0, 1]]), true)).toBe(0);
  });

  it('returns 0 for an empty distribution on a row that can come up empty', () => {
    expect(rowPeak(dist([]), true)).toBe(0);
  });

  it('takes the tallest bar even when an earlier bar is shorter', () => {
    expect(rowPeak(dist([[1, 0.1], [2, 0.6], [3, 0.3]]), false)).toBeCloseTo(0.6, 12);
  });

  it('takes the tallest bar past the miss bar, not the first one after it', () => {
    expect(rowPeak(dist([[0, 0.3], [1, 0.1], [2, 0.4], [3, 0.2]]), true)).toBeCloseTo(0.4, 12);
  });
});

describe('planZeroSpikes', () => {
  it('returns a zero peak, the fallback axis, and no markers for an empty table', () => {
    expect(planZeroSpikes([])).toEqual({
      peak: 0,
      axis: { domainMax: 0.1, ticks: [0, 0.05, 0.1] },
      markers: [],
    });
  });

  it('returns the plain global maximum when no row can come up empty', () => {
    // 1d2 is the tall-single-spike case: a plain sum row is never capped, so a
    // 50% bar still sets the axis even beside a flat 1d20.
    const d20 = Array.from({ length: 20 }, (_, i) => [i + 1, 0.05] as const);
    const plan = planZeroSpikes([
      row({ id: 'coin', dist: dist([[1, 0.5], [2, 0.5]]) }),
      row({ id: 'd20', dist: dist(d20) }),
    ]);
    expect(plan.peak).toBeCloseTo(0.5, 12);
  });

  it('leaves a tall single spike unmarked when no row can come up empty', () => {
    const plan = planZeroSpikes([row({ id: 'coin', dist: dist([[1, 0.5], [2, 0.5]]) })]);
    expect(plan.markers).toEqual([]);
  });

  it('excludes a check row miss bar from the peak', () => {
    // A 60% miss beside a plain row whose tallest bar is 50%.
    const check = row({
      id: 'check',
      canMiss: true,
      dist: dist([[0, 0.6], [5, 0.2], [6, 0.2]]),
    });
    const sum = row({ id: 'sum', dist: dist([[5, 0.5], [6, 0.5]]) });
    expect(planZeroSpikes([check, sum]).peak).toBeCloseTo(0.5, 12);
  });

  it('marks a miss bar that towers over the axis top', () => {
    // The 0.5 peak rounds up to a 0.6 axis, so the miss has to clear 0.6.
    const check = row({
      id: 'check',
      name: 'Longsword',
      color: '#ea580c',
      canMiss: true,
      dist: dist([[0, 0.7], [5, 0.15], [6, 0.15]]),
    });
    const sum = row({ id: 'sum', dist: dist([[5, 0.5], [6, 0.5]]) });
    const plan = planZeroSpikes([check, sum]);
    expect(plan.axis.domainMax).toBeCloseTo(0.6, 12);
    expect(plan.markers).toEqual([
      { id: 'check', name: 'Longsword', color: '#ea580c', probability: 0.7 },
    ]);
  });

  it('does not mark a miss bar that already fits under the peak', () => {
    const check = row({
      id: 'check',
      canMiss: true,
      dist: dist([[0, 0.05], [4, 0.5], [5, 0.45]]),
    });
    const plan = planZeroSpikes([check]);
    expect(plan.peak).toBeCloseTo(0.5, 12);
    expect(plan.markers).toEqual([]);
  });

  it('does not mark a miss bar exactly as tall as the peak', () => {
    const plan = planZeroSpikes([
      row({ id: 'check', canMiss: true, dist: dist([[0, 0.5], [4, 0.5]]) }),
    ]);
    expect(plan.markers).toEqual([]);
  });

  it('does not mark a miss bar that fits inside the axis headroom above the peak', () => {
    // A 0.19 peak rounds up to a 0.2 axis; a 0.195 miss renders at full
    // height inside it, so claiming it was cut off would be false.
    const plan = planZeroSpikes([
      row({
        id: 'check',
        canMiss: true,
        dist: dist([[0, 0.195], [4, 0.19], [5, 0.19], [6, 0.19], [7, 0.19], [8, 0.045]]),
      }),
    ]);
    expect(plan.peak).toBeCloseTo(0.19, 12);
    expect(plan.axis.domainMax).toBeCloseTo(0.2, 12);
    expect(plan.markers).toEqual([]);
  });

  it('marks a miss bar that clears the axis top over the same peak', () => {
    const plan = planZeroSpikes([
      row({
        id: 'check',
        canMiss: true,
        dist: dist([[0, 0.25], [4, 0.19], [5, 0.19], [6, 0.19], [7, 0.12], [8, 0.06]]),
      }),
    ]);
    expect(plan.axis.domainMax).toBeCloseTo(0.2, 12);
    expect(plan.markers).toHaveLength(1);
    expect(plan.markers[0]!.probability).toBeCloseTo(0.25, 12);
  });

  it('does not mark a miss bar that only floating point noise puts above the peak', () => {
    const noisyMiss = 0.1 + 0.2;
    // Guards the fixture: without the drift there is no tolerance to exercise.
    expect(noisyMiss).toBeGreaterThan(0.3);
    const plan = planZeroSpikes([
      row({
        id: 'check',
        canMiss: true,
        dist: dist([[0, noisyMiss], [4, 0.3], [5, 0.2], [6, 0.2]]),
      }),
    ]);
    expect(plan.markers).toEqual([]);
  });

  it('scales to a later bar that stands taller than the first one', () => {
    // The miss bar clears the row's first bar but not its tallest, so the row
    // fits under an honest axis and needs no marker.
    const plan = planZeroSpikes([
      row({ id: 'check', canMiss: true, dist: dist([[0, 0.3], [5, 0.2], [6, 0.5]]) }),
    ]);
    expect(plan.peak).toBeCloseTo(0.5, 12);
    expect(plan.markers).toEqual([]);
  });

  it('keeps a usable scale for a row that only ever comes up empty', () => {
    const plan = planZeroSpikes([row({ id: 'whiff', canMiss: true, dist: dist([[0, 1]]) })]);
    expect(plan.peak).toBe(1);
    expect(plan.axis.domainMax).toBe(1);
    expect(plan.markers).toEqual([]);
  });

  it('keeps a row that only ever misses from squashing the other rows', () => {
    // Both check outcomes set to "nothing" is a legal stored state; its miss
    // bar must be capped and marked, not allowed to set the shared scale.
    const whiff = row({ id: 'whiff', name: 'Whiff', canMiss: true, dist: dist([[0, 1]]) });
    const sum = row({ id: 'sum', dist: dist([[5, 0.5], [6, 0.5]]) });
    const plan = planZeroSpikes([whiff, sum]);
    expect(plan.peak).toBeCloseTo(0.5, 12);
    expect(plan.axis.domainMax).toBeCloseTo(0.6, 12);
    expect(plan.markers.map((m) => m.id)).toEqual(['whiff']);
    expect(plan.markers[0]!.probability).toBe(1);
  });

  it('ignores zero mass on a row that cannot come up empty', () => {
    const plan = planZeroSpikes([
      row({ id: 'sum', dist: dist([[0, 0.8], [1, 0.2]]) }),
      row({ id: 'other', dist: dist([[3, 0.5], [4, 0.5]]) }),
    ]);
    expect(plan.peak).toBeCloseTo(0.8, 12);
    expect(plan.markers).toEqual([]);
  });

  it('sorts markers from the most often empty to the least', () => {
    const plan = planZeroSpikes([
      row({
        id: 'small',
        name: 'Small',
        canMiss: true,
        // The 0.35 peak rounds up to a 0.4 axis, so the smallest marked miss
        // has to clear 0.4.
        dist: dist([[0, 0.45], [9, 0.35], [10, 0.2]]),
      }),
      row({ id: 'big', name: 'Big', canMiss: true, dist: dist([[0, 0.8], [9, 0.2]]) }),
      row({
        id: 'mid',
        name: 'Mid',
        canMiss: true,
        dist: dist([[0, 0.6], [9, 0.2], [10, 0.2]]),
      }),
    ]);
    expect(plan.markers.map((m) => m.name)).toEqual(['Big', 'Mid', 'Small']);
  });
});

describe('formatMissPercent', () => {
  it('shows a chance under half a percent as less than one percent', () => {
    expect(formatMissPercent(0.004)).toBe('<1%');
  });

  it('shows an exactly zero chance as zero percent', () => {
    expect(formatMissPercent(0)).toBe('0%');
  });

  it('rounds exactly half a percent up to one percent', () => {
    expect(formatMissPercent(0.005)).toBe('1%');
  });

  it('shows a certain miss as one hundred percent', () => {
    expect(formatMissPercent(1)).toBe('100%');
  });

  it('hedges a near-certain miss instead of claiming it always happens', () => {
    // A 399-in-400 miss still hits sometimes; 100% is reserved for certainty.
    expect(formatMissPercent(0.995)).toBe('>99%');
    expect(formatMissPercent(0.9975)).toBe('>99%');
  });

  it('still shows 99 percent just below the hundred percent cutoff', () => {
    expect(formatMissPercent(0.9949)).toBe('99%');
  });

  it('rounds an ordinary chance to the nearest whole percent', () => {
    expect(formatMissPercent(0.3549)).toBe('35%');
  });

  it('rounds a half percent share up to the next whole percent', () => {
    expect(formatMissPercent(0.125)).toBe('13%');
  });
});

describe('missDescription', () => {
  it('returns an empty string when nothing was capped', () => {
    expect(missDescription([])).toBe('');
  });

  it('names the row and how often it comes up empty', () => {
    const markers: ZeroSpikeMarker[] = [
      { id: 'a', name: 'Longsword', color: '#2563eb', probability: 0.35 },
    ];
    expect(missDescription(markers)).toBe(
      'Longsword comes up empty 35% of the time. Those bars are cut off so the other rolls stay readable.',
    );
  });

  it('names every capped row', () => {
    const markers: ZeroSpikeMarker[] = [
      { id: 'a', name: 'Longsword', color: '#2563eb', probability: 0.6 },
      { id: 'b', name: 'Dagger', color: '#ea580c', probability: 0.4 },
    ];
    expect(missDescription(markers)).toBe(
      'Longsword comes up empty 60% of the time. Dagger comes up empty 40% of the time. ' +
        'Those bars are cut off so the other rolls stay readable.',
    );
  });
});
