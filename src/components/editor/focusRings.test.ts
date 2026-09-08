import { describe, expect, it } from 'vitest';
import { chipFocusRing, focusRingInset } from './focusRings';

const HEX_LITERAL = /#[0-9a-fA-F]{3,8}/;

// Asserting each property's literal value would only restate the constant.
// What is worth guarding is the project rule the file has to obey: hex is
// allowed only in palette.ts, so a ring color has to be a theme token.
describe('editor focus rings', () => {
  it('give the inset ring a theme token rather than a hex literal', () => {
    expect(JSON.stringify(focusRingInset)).not.toMatch(HEX_LITERAL);
    expect(focusRingInset.outlineColor).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
  });

  it('give the chip ring a theme token rather than a hex literal', () => {
    expect(JSON.stringify(chipFocusRing)).not.toMatch(HEX_LITERAL);
    expect(chipFocusRing.outlineColor).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
  });

  // Chips switch colorPalette with selection, so a ring that followed the
  // palette would be gray on an unselected chip and blue on a selected one.
  it('pin the chip ring to one color instead of tracking colorPalette', () => {
    expect(JSON.stringify(chipFocusRing)).not.toContain('colorPalette');
  });
});
