import { describe, expect, it } from 'vitest';
import { buildStepAreaPath, buildStepPath } from './stepPath';

describe('buildStepPath', () => {
  it('returns an empty string for no points', () => {
    expect(buildStepPath([], { stepWidth: 10 })).toBe('');
  });

  it('renders a single point as one horizontal segment of stepWidth', () => {
    expect(buildStepPath([{ x: 5, y: 12 }], { stepWidth: 8 })).toBe(
      'M 5 12 L 13 12',
    );
  });

  it('emits a vertical edge between two contiguous buckets at different heights', () => {
    const d = buildStepPath(
      [
        { x: 0, y: 20 },
        { x: 10, y: 5 },
      ],
      { stepWidth: 10 },
    );
    expect(d).toBe('M 0 20 L 10 20 L 10 5 L 20 5');
  });

  it('omits the vertical edge when consecutive points share a height', () => {
    const d = buildStepPath(
      [
        { x: 0, y: 7 },
        { x: 4, y: 7 },
        { x: 8, y: 7 },
      ],
      { stepWidth: 4 },
    );
    expect(d).toBe('M 0 7 L 4 7 L 8 7 L 12 7');
    expect(d.includes('L 4 7 L 4 7')).toBe(false);
  });

  it('inserts a horizontal connector when points have a gap on the x axis', () => {
    const d = buildStepPath(
      [
        { x: 0, y: 10 },
        { x: 30, y: 4 },
      ],
      { stepWidth: 10 },
    );
    expect(d).toBe('M 0 10 L 10 10 L 30 10 L 30 4 L 40 4');
  });

  it('preserves negative and fractional coordinates verbatim (caller rounds)', () => {
    const d = buildStepPath(
      [
        { x: -2.5, y: -1.25 },
        { x: 0.5, y: 3.75 },
      ],
      { stepWidth: 3 },
    );
    expect(d).toBe('M -2.5 -1.25 L 0.5 -1.25 L 0.5 3.75 L 3.5 3.75');
  });
});

describe('buildStepAreaPath', () => {
  it('returns an empty string for no points', () => {
    expect(buildStepAreaPath([], 20, { stepWidth: 10 })).toBe('');
  });

  it('closes a single-point path into a rectangle down to the baseline', () => {
    expect(
      buildStepAreaPath([{ x: 0, y: 4 }], 24, { stepWidth: 6 }),
    ).toBe('M 0 4 L 6 4 L 6 24 L 0 24 Z');
  });

  it('closes a multi-point stepped top into a filled area', () => {
    const d = buildStepAreaPath(
      [
        { x: 0, y: 10 },
        { x: 5, y: 2 },
      ],
      20,
      { stepWidth: 5 },
    );
    expect(d).toBe('M 0 10 L 5 10 L 5 2 L 10 2 L 10 20 L 0 20 Z');
  });
});
