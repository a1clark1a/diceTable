import { describe, expect, it } from 'vitest';
import { seriesXs } from './seriesXs';

describe('seriesXs', () => {
  it('emits one x per value of its own support when it spans the whole domain', () => {
    expect(seriesXs({ min: 1, max: 10 }, 1, 10)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('emits a single x for a roll whose result never varies', () => {
    expect(seriesXs({ min: 5, max: 5 }, 5, 5)).toEqual([5]);
  });

  it('costs its own support plus two anchors rather than the whole domain', () => {
    // A 3d6 row sharing an axis with a 20d100 row. The domain is 1,998 wide;
    // this row pays for 16 values and two anchors, not 1,998.
    const xs = seriesXs({ min: 3, max: 18 }, 3, 2000);
    expect(xs).toHaveLength(18);
    expect(xs.slice(0, 3)).toEqual([3, 4, 5]);
    expect(xs.slice(-2)).toEqual([19, 2000]);
  });

  it('anchors twice on the near side so a curve holds flat instead of ramping', () => {
    // One anchor at lo would let a monotone curve rise gradually across the
    // empty region; the second pins it flat until the support starts.
    expect(seriesXs({ min: 20, max: 25 }, 1, 25)).toEqual([
      1, 19, 20, 21, 22, 23, 24, 25,
    ]);
  });

  it('anchors twice on the far side for the same reason', () => {
    expect(seriesXs({ min: 1, max: 5 }, 1, 40)).toEqual([
      1, 2, 3, 4, 5, 6, 40,
    ]);
  });

  it('adds no anchor where the support already reaches the domain edge', () => {
    const xs = seriesXs({ min: 20, max: 2000 }, 3, 2000);
    expect(xs.slice(0, 3)).toEqual([3, 19, 20]);
    // The far edge is the support's own max, so nothing is appended past it.
    expect(xs[xs.length - 1]).toBe(2000);
    expect(xs).toHaveLength(1983);
  });

  it('does not duplicate the edge when the gap is one value wide', () => {
    // min - 1 === lo and max + 1 === hi, so the near anchors are the edges
    // themselves and must not be emitted twice.
    expect(seriesXs({ min: 5, max: 5 }, 4, 6)).toEqual([4, 5, 6]);
  });

  it('emits strictly increasing values', () => {
    const xs = seriesXs({ min: 30, max: 60 }, 1, 500);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
    }
  });

  it('handles a support that sits entirely in negative territory', () => {
    expect(seriesXs({ min: -5, max: -3 }, -20, 0)).toEqual([
      -20, -6, -5, -4, -3, -2, 0,
    ]);
  });
});
