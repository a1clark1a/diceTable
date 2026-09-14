import { describe, expect, it } from 'vitest';
import { litSummary } from './litSummary';

const table = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    name: `Roll ${i + 1}`,
    mean: i,
  }));

describe('litSummary', () => {
  it('names the top and the bottom outright', () => {
    const rows = table(100);
    expect(litSummary(rows, 'r99')).toBe(
      'Roll 100 lit. Its average is the highest of all 100 rolls drawn.',
    );
    expect(litSummary(rows, 'r0')).toBe(
      'Roll 1 lit. Its average is the lowest of all 100 rolls drawn.',
    );
  });

  it('ranks the middle against the rest', () => {
    expect(litSummary(table(100), 'r62')).toBe(
      'Roll 63 lit. Its average is higher than 62 of the other 99 rolls drawn.',
    );
  });

  it('counts a tie as not beaten', () => {
    // Three rolls averaging the same thing are not each better than two others.
    const rows = [
      { id: 'a', name: 'A', mean: 7 },
      { id: 'b', name: 'B', mean: 7 },
      { id: 'c', name: 'C', mean: 7 },
    ];
    expect(litSummary(rows, 'b')).toContain('the lowest of all 3');
  });

  it('says nothing when nothing is lit, or when the pick is elsewhere', () => {
    expect(litSummary(table(5), null)).toBe('');
    expect(litSummary(table(5), 'somewhere-else')).toBe('');
  });

  it('reads plainly, with no em-dashes', () => {
    expect(litSummary(table(40), 'r20')).not.toContain('—');
  });
});
