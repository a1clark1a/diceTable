import { describe, expect, it } from 'vitest';
import {
  EM_DASH,
  deltaTone,
  formatDelta,
  formatNumber,
  formatPercent,
  formatPercentCompact,
  formatPercentDelta,
  formatWholePercent,
  targetLabelFits,
} from './format';
import { HIT_DELTA_EPS, STAT_DELTA_EPS } from '../baseline/comparison';

describe('formatNumber', () => {
  it('pads a mean out to the requested decimals', () => {
    // 3d6 averages exactly 10.5; the Mean cell shows two places.
    expect(formatNumber(10.5, 2)).toBe('10.50');
  });

  it('rounds a half up when trimming to one decimal', () => {
    expect(formatNumber(6.25, 1)).toBe('6.3');
  });

  it('renders an em-dash for non-finite values', () => {
    expect(formatNumber(NaN, 2)).toBe(EM_DASH);
    expect(formatNumber(Infinity, 2)).toBe(EM_DASH);
    expect(formatNumber(-Infinity, 2)).toBe(EM_DASH);
  });
});

describe('formatPercent', () => {
  it('renders one decimal place', () => {
    expect(formatPercent(0.125)).toBe('12.5%');
  });

  it('renders an impossible chance as 0.0%', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('rounds a near-certain chance up to 100.0% rather than hedging', () => {
    // 0.9999 * 100 = 99.99, one decimal rounds it to 100.0. This is the cell
    // format, so unlike formatWholePercent it does not print >99%.
    expect(formatPercent(0.9999)).toBe('100.0%');
  });
});

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

describe('formatWholePercent', () => {
  it('keeps exactly-certain values exact', () => {
    expect(formatWholePercent(0)).toBe('0%');
    expect(formatWholePercent(1)).toBe('100%');
  });

  it('clamps values outside the unit interval to the exact ends', () => {
    expect(formatWholePercent(-0.2)).toBe('0%');
    expect(formatWholePercent(1.2)).toBe('100%');
  });

  it('hedges a near-zero chance instead of rounding it away', () => {
    expect(formatWholePercent(0.0049)).toBe('<1%');
  });

  it('hedges a near-certain chance instead of claiming certainty', () => {
    expect(formatWholePercent(0.995)).toBe('>99%');
    expect(formatWholePercent(0.9999)).toBe('>99%');
  });

  it('rounds ordinary chances to the nearest whole percent', () => {
    expect(formatWholePercent(0.005)).toBe('1%');
    expect(formatWholePercent(0.3549)).toBe('35%');
    expect(formatWholePercent(0.125)).toBe('13%');
    expect(formatWholePercent(0.9949)).toBe('99%');
  });
});

describe('formatWholePercent boundary storm', () => {
  it.each([
    [0, '0%'],
    [-0.1, '0%'],
    [Number.EPSILON, '<1%'],
    [0.0049999, '<1%'],
    [0.005, '1%'],
    [0.0051, '1%'],
    [0.5, '50%'],
    [0.9449, '94%'],
    [0.945, '95%'],
    [0.9949999, '99%'],
    [0.995, '>99%'],
    [0.9999, '>99%'],
    [1, '100%'],
    [1 + Number.EPSILON, '100%'],
    [1.5, '100%'],
  ])('formats a chance of %d as %s', (value, expected) => {
    expect(formatWholePercent(value)).toBe(expected);
  });

  it('never claims impossibility or certainty for a chance strictly inside the unit interval', () => {
    const interior: number[] = [Number.EPSILON, 1e-300, 0.0049999999, 0.9950000001, 0.9999999999999999];
    for (let k = 1; k <= 9999; k += 1) interior.push(k / 10000);
    for (const value of interior) {
      const formatted = formatWholePercent(value);
      expect(formatted).not.toBe('0%');
      expect(formatted).not.toBe('100%');
    }
  });
});

describe('formatDelta', () => {
  it('prefixes positive deltas with a plus sign', () => {
    expect(formatDelta(1.2, 2)).toBe('+1.20');
  });

  it('prefixes negative deltas with a true minus sign, not a hyphen', () => {
    expect(formatDelta(-1.2, 2)).toBe('−1.20');
    expect(formatDelta(-1.2, 2)).not.toBe('-1.20');
  });

  it('renders exact zero unsigned', () => {
    expect(formatDelta(0, 2)).toBe('0.00');
  });

  it('renders a delta that rounds to zero unsigned, in both directions', () => {
    expect(formatDelta(0.004, 2)).toBe('0.00');
    expect(formatDelta(-0.004, 2)).toBe('0.00');
  });

  it('respects the fraction-digits argument', () => {
    expect(formatDelta(0.26, 1)).toBe('+0.3');
    expect(formatDelta(-0.26, 1)).toBe('−0.3');
  });

  it('renders an em-dash for non-finite values', () => {
    expect(formatDelta(NaN, 2)).toBe(EM_DASH);
    expect(formatDelta(Infinity, 2)).toBe(EM_DASH);
    expect(formatDelta(-Infinity, 2)).toBe(EM_DASH);
  });
});

describe('formatPercentDelta', () => {
  it('renders signed percentage points with one decimal', () => {
    expect(formatPercentDelta(0.18)).toBe('+18.0%');
    expect(formatPercentDelta(-0.046)).toBe('−4.6%');
  });

  it('renders exact zero unsigned', () => {
    expect(formatPercentDelta(0)).toBe('0.0%');
  });

  it('renders a delta that rounds to zero points unsigned', () => {
    expect(formatPercentDelta(0.0004)).toBe('0.0%');
    expect(formatPercentDelta(-0.0004)).toBe('0.0%');
  });

  it('renders an em-dash for non-finite values', () => {
    expect(formatPercentDelta(NaN)).toBe(EM_DASH);
    expect(formatPercentDelta(Infinity)).toBe(EM_DASH);
  });
});

describe('deltaTone', () => {
  it('tones a clearly positive delta good and a clearly negative delta bad', () => {
    expect(deltaTone(1.5, 5e-3)).toBe('good');
    expect(deltaTone(-1.5, 5e-3)).toBe('bad');
  });

  it('tones a delta inside the eps window as same', () => {
    expect(deltaTone(0.0049, 5e-3)).toBe('same');
    expect(deltaTone(-0.0049, 5e-3)).toBe('same');
    expect(deltaTone(0, 5e-3)).toBe('same');
  });

  it('tones a delta exactly at eps by its sign, matching the printed value', () => {
    expect(deltaTone(5e-3, 5e-3)).toBe('good');
    expect(deltaTone(-5e-3, 5e-3)).toBe('bad');
  });

  it('tones non-finite values as same', () => {
    expect(deltaTone(NaN, 5e-3)).toBe('same');
    expect(deltaTone(Infinity, 5e-3)).toBe('same');
  });
});

// The table pairs each printed delta with a tone colour, and the eps it hands
// deltaTone is half the last printed decimal (0.005 for two places, 0.0005 for
// one percentage-point decimal). A grey '+0.01' or a green '0.00' is the
// mismatch a user notices first, so sweep both sides of both boundaries.
function sweep(): number[] {
  const values: number[] = [];
  for (let k = -200; k <= 200; k += 1) values.push(k * 0.0001);
  values.push(STAT_DELTA_EPS, -STAT_DELTA_EPS, HIT_DELTA_EPS, -HIT_DELTA_EPS);
  return values;
}

describe('deltaTone agrees with the printed delta', () => {
  it('tones a two-decimal stat delta as same exactly when it prints as 0.00', () => {
    // 0.0049 prints 0.00 and tones same; 0.005 prints +0.01 and tones good.
    for (const v of sweep()) {
      const printsZero = formatDelta(v, 2) === '0.00';
      const tonesSame = deltaTone(v, STAT_DELTA_EPS) === 'same';
      expect(tonesSame, `delta ${v} prints ${formatDelta(v, 2)}`).toBe(printsZero);
    }
  });

  it('tones a hit delta as same exactly when it prints as 0.0%', () => {
    // 0.0004 prints 0.0% and tones same; 0.0005 prints +0.1% and tones good.
    for (const v of sweep()) {
      const printsZero = formatPercentDelta(v) === '0.0%';
      const tonesSame = deltaTone(v, HIT_DELTA_EPS) === 'same';
      expect(tonesSame, `delta ${v} prints ${formatPercentDelta(v)}`).toBe(printsZero);
    }
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
