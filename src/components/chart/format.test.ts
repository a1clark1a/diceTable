import { describe, expect, it } from 'vitest';
import { formatPercentCompact, targetLabelFits } from './format';

describe('formatPercentCompact', () => {
  it('drops the redundant trailing .0 from whole percentages', () => {
    expect(formatPercentCompact(0.1)).toBe('10%');
    expect(formatPercentCompact(1)).toBe('100%');
  });

  it('keeps decimals for values that need them', () => {
    expect(formatPercentCompact(0.125)).toBe('12.5%');
    expect(formatPercentCompact(0.3333)).toBe('33.3%');
  });
});

describe('targetLabelFits', () => {
  it('allows a short label in a narrow bar', () => {
    expect(targetLabelFits(2, 20)).toBe(true);
  });

  it('hides the whole label group when the longest label does not fit', () => {
    expect(targetLabelFits(10, 20)).toBe(false);
  });

  it('treats the exact fit boundary as fitting', () => {
    const fitChars = 4;
    const width = fitChars * 6.1 - 2;
    expect(targetLabelFits(fitChars, width)).toBe(true);
  });
});
