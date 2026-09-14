import { describe, expect, it } from 'vitest';
import { CHART_ROW_CAP_RAIL } from '../../types';
import { CHART_FIELD_THRESHOLD, fieldPen, LIT_CLASS } from './fieldPen';

describe('fieldPen', () => {
  it('leaves the existing path alone at and below the threshold', () => {
    expect(fieldPen(CHART_FIELD_THRESHOLD, 'pmf')).toBeNull();
    expect(fieldPen(CHART_FIELD_THRESHOLD, 'cdf')).toBeNull();
    expect(fieldPen(1, 'ccdf')).toBeNull();
  });

  it('hands back the same object every time', () => {
    // By reference, not by value. A pen rebuilt per call would hand emotion a
    // fresh object on every render, re-serializing the class and giving up the
    // one property the field is built on: that a focus change touches no
    // series prop at all.
    expect(fieldPen(31, 'cdf')).toBe(fieldPen(100, 'ccdf'));
    expect(fieldPen(31, 'pmf')).toBe(fieldPen(100, 'pmf'));
    expect(fieldPen(31, 'pmf')).not.toBe(fieldPen(31, 'cdf'));
  });

  it('draws a step curve thinner than a monotone one', () => {
    const step = fieldPen(100, 'pmf');
    const monotone = fieldPen(100, 'cdf');
    expect(step).toEqual({
      restOpacity: 0.45,
      dimOpacity: 0.25,
      width: 1,
      litWidth: 2.5,
      css: expect.any(Object),
    });
    expect(monotone?.width).toBe(1.25);
    expect(monotone?.litWidth).toBe(3);
  });

  it('keeps the field out of reach of every surface that pages at twenty', () => {
    // The rail and the narrow dialog draw a page of CHART_ROW_CAP_RAIL, so a
    // threshold at or below it would put them on a code path calibrated for a
    // canvas they do not have.
    expect(CHART_FIELD_THRESHOLD).toBeGreaterThan(CHART_ROW_CAP_RAIL);
  });

  it('excludes the lit overlay from both opacity rules', () => {
    const pen = fieldPen(100, 'cdf');
    const keys = Object.keys(pen?.css ?? {});
    expect(keys).toHaveLength(2);
    for (const key of keys) expect(key).toContain(`:not(.${LIT_CLASS})`);

    const dim = keys.find((k) => k.includes('[data-lit]'));
    const rest = keys.find((k) => !k.includes('[data-lit]'));
    expect(pen?.css[dim!]).toEqual({ strokeOpacity: pen?.dimOpacity });
    expect(pen?.css[rest!]).toEqual({ strokeOpacity: pen?.restOpacity });
    // The dimmed rule carries one extra compound, so it beats the resting one
    // outright and source order never has to be reasoned about.
    expect(dim!.length).toBeGreaterThan(rest!.length);
  });
});
