// The stepper sits inside an overflow:hidden pill, which clips an outer
// (positive-offset) focus ring down to a sliver. An inset ring stays inside the
// pill and visible; boxShadow:none drops the default ring so only this shows.
export const focusRingInset = {
  outline: '2px solid',
  outlineColor: 'blue.solid',
  outlineOffset: '-2px',
  boxShadow: 'none',
};

// Chips track colorPalette, so an unselected (gray) chip would show a gray focus
// ring while a selected (blue) chip shows blue. Pin the ring to blue so the
// keyboard cue reads the same regardless of selection state.
export const chipFocusRing = {
  outlineWidth: '2px',
  outlineStyle: 'solid',
  outlineColor: 'blue.solid',
  outlineOffset: '2px',
};

// A flushed field has no resting border but its bottom hairline. Chakra does
// give it a focus treatment, but as colorPalette.focusRing, which is gray by
// default and measures 2.2:1 on the panel. Pin it to the blue the chips use.
export const flushedFocusRing = {
  borderColor: 'blue.solid',
  boxShadow: '0px 1px 0px 0px var(--chakra-colors-blue-solid)',
};
