import { describe, expect, it } from 'vitest';
import { partitionTooltipRows } from './tooltipRows';

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, value: i }));

describe('partitionTooltipRows', () => {
  it('lifts the lit row out of the list rather than leaving it to the cap', () => {
    const ordered = rows(12);
    const { pinned, shown, hidden } = partitionTooltipRows(ordered, 'r11', 8);
    expect(pinned?.id).toBe('r11');
    expect(shown.map((r) => r.id)).not.toContain('r11');
    expect(shown).toHaveLength(8);
    expect(hidden).toBe(3);
  });

  it('is a no-op with nothing lit', () => {
    // A regression pin, not a new behaviour: this is every tooltip on the rail
    // and every tooltip on a phone.
    const ordered = rows(12);
    const { pinned, shown, hidden } = partitionTooltipRows(ordered, null, 8);
    expect(pinned).toBeNull();
    expect(shown).toEqual(ordered.slice(0, 8));
    expect(hidden).toBe(4);
  });

  it('treats the other panel pick as no pick at all', () => {
    const ordered = rows(12);
    expect(partitionTooltipRows(ordered, 'not-here', 8)).toEqual(
      partitionTooltipRows(ordered, null, 8),
    );
  });

  it('adds the lit row above the cap instead of displacing one', () => {
    // A capped bar's true number is promised to be on the tooltip, and the
    // order puts those rows first to keep that promise. The lit row is a ninth
    // row, so lighting one up can never push a capped bar off.
    const ordered = rows(9);
    const { pinned, shown, hidden } = partitionTooltipRows(ordered, 'r8', 8);
    expect(pinned?.id).toBe('r8');
    expect(shown).toHaveLength(8);
    expect(hidden).toBe(0);
  });
});
