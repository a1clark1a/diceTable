/**
 * The band down the left edge of a row means exactly one thing: this is the
 * pinned baseline. Roll mode already has its own chip on every row and card, so
 * a band that also encoded mode read as two different legends for the same data
 * depending on which layout the viewport happened to be showing.
 */
export const BASELINE_BAND_WIDTH = '3px';
export const BASELINE_BAND_COLOR = 'blue.solid';

/**
 * Cards draw it as an inset shadow rather than a border: a 3px border would
 * push their content 2px out of line with every unpinned card in the stack.
 */
export const BASELINE_BAND_SHADOW = 'inset 3px 0 0 {colors.blue.solid}';
