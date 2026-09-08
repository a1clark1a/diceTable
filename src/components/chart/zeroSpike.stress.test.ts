import { describe, expect, it } from 'vitest';
import { planZeroSpikes, type ZeroSpikeRow } from './zeroSpike';

// Mirrors the plan's own gate tolerance: a miss inside this window of the axis
// top renders at full height, so it must never be marked as cut off.
const EPSILON = 1e-9;

// A check row: miss mass on 0, its tallest honest bar on 1, and the rest of
// the mass spread over higher values in chunks no taller than that bar so the
// intended peak stays the peak.
function missRow(id: string, miss: number, peak: number): ZeroSpikeRow {
  const entries: [number, number][] = [];
  if (miss > 0) entries.push([0, miss]);
  if (peak > 0) entries.push([1, peak]);
  let remaining = 1 - miss - peak;
  let value = 2;
  while (peak > 0 && remaining > 1e-12) {
    const chunk = Math.min(peak, remaining);
    entries.push([value, chunk]);
    value += 1;
    remaining -= chunk;
  }
  return { id, name: id, color: '#2563eb', canMiss: true, dist: new Map(entries) };
}

// A plain sum row: no miss semantics, tallest bar on 1, remainder spread above.
function plainRow(id: string, peak: number): ZeroSpikeRow {
  const entries: [number, number][] = [[1, peak]];
  let remaining = 1 - peak;
  let value = 2;
  while (remaining > 1e-12) {
    const chunk = Math.min(peak, remaining);
    entries.push([value, chunk]);
    value += 1;
    remaining -= chunk;
  }
  return { id, name: id, color: '#ea580c', canMiss: false, dist: new Map(entries) };
}

function buildRowSets(): ZeroSpikeRow[][] {
  const sets: ZeroSpikeRow[][] = [];

  // Every honest peak from 1% to 95% against every miss from 0 to 1 that still
  // leaves room for a real distribution.
  for (let i = 1; i <= 95; i += 2) {
    for (let j = 0; j <= 20; j += 1) {
      const peak = i / 100;
      const miss = j / 20;
      if (miss + peak > 1 + 1e-12) continue;
      sets.push([missRow('check', miss, peak)]);
    }
  }

  // Mixes: a check row beside a plain row that may sit under, between, or over
  // the check row's own bars.
  for (let i = 5; i <= 95; i += 15) {
    for (let j = 0; j <= 20; j += 4) {
      const peak = i / 100;
      const miss = j / 20;
      if (miss + peak > 1 + 1e-12) continue;
      for (const plainPeak of [0.02, 0.35, 0.7]) {
        sets.push([missRow('check', miss, peak), plainRow('plain', plainPeak)]);
      }
    }
  }

  // Rows that only ever miss, alone and beside honest rows of both extremes.
  sets.push([missRow('whiff', 1, 0)]);
  sets.push([missRow('whiff-a', 1, 0), missRow('whiff-b', 1, 0)]);
  sets.push([missRow('whiff', 1, 0), plainRow('tiny', 0.02)]);
  sets.push([missRow('whiff', 1, 0), plainRow('tall', 0.95)]);

  // A row flagged as able to miss that happens to have no zero bucket.
  sets.push([missRow('no-zero', 0, 0.4)]);

  // The empty table.
  sets.push([]);

  return sets;
}

const ROW_SETS = buildRowSets();

function rowMiss(row: ZeroSpikeRow): number {
  return row.canMiss ? (row.dist.get(0) ?? 0) : 0;
}

function tallestHonestBar(rows: readonly ZeroSpikeRow[]): number {
  let tallest = 0;
  for (const row of rows) {
    for (const [value, p] of row.dist) {
      if (row.canMiss && value === 0) continue;
      if (p > tallest) tallest = p;
    }
  }
  return tallest;
}

describe('planZeroSpikes invariant sweep', () => {
  it('never claims a miss bar was cut off when it fits at or under the axis top', () => {
    for (const rows of ROW_SETS) {
      const plan = planZeroSpikes(rows);
      const marked = new Set(plan.markers.map((m) => m.id));
      for (const row of rows) {
        if (marked.has(row.id)) continue;
        expect(rowMiss(row)).toBeLessThanOrEqual(plan.axis.domainMax + EPSILON);
      }
    }
  });

  it('marks every miss bar that towers over the axis top, with its honest probability', () => {
    for (const rows of ROW_SETS) {
      const plan = planZeroSpikes(rows);
      for (const row of rows) {
        const miss = rowMiss(row);
        if (miss <= plan.axis.domainMax + EPSILON) continue;
        const marker = plan.markers.find((m) => m.id === row.id);
        expect(marker).toBeDefined();
        expect(marker!.probability).toBe(miss);
        expect(marker!.probability).toBeGreaterThan(plan.axis.domainMax);
      }
    }
  });

  it('keeps the axis top at or above the tallest honest bar in every set', () => {
    for (const rows of ROW_SETS) {
      const plan = planZeroSpikes(rows);
      expect(plan.axis.domainMax).toBeGreaterThanOrEqual(tallestHonestBar(rows) - EPSILON);
    }
  });

  it('always plans a drawable axis with positive height, even for an empty table', () => {
    for (const rows of ROW_SETS) {
      expect(planZeroSpikes(rows).axis.domainMax).toBeGreaterThan(0);
    }
  });

  it('keeps ticks ascending from zero to the axis top in every plan', () => {
    for (const rows of ROW_SETS) {
      const { axis } = planZeroSpikes(rows);
      expect(axis.ticks.length).toBeGreaterThan(1);
      expect(axis.ticks[0]).toBe(0);
      for (let i = 1; i < axis.ticks.length; i += 1) {
        expect(axis.ticks[i]!).toBeGreaterThan(axis.ticks[i - 1]!);
        expect(axis.ticks[i]!).toBeLessThanOrEqual(axis.domainMax + EPSILON);
      }
      expect(axis.ticks[axis.ticks.length - 1]!).toBeCloseTo(axis.domainMax, 9);
    }
  });

  it('lists markers tallest miss first in every plan', () => {
    for (const rows of ROW_SETS) {
      const { markers } = planZeroSpikes(rows);
      for (let i = 1; i < markers.length; i += 1) {
        expect(markers[i]!.probability).toBeLessThanOrEqual(markers[i - 1]!.probability);
      }
    }
  });
});
