/**
 * Controls are finger-sized wherever the cards render and go back to their
 * dense size wherever the table does. `lg` is 992px, the same threshold
 * `useTableFits` uses, so the two can never disagree about which layout is on
 * screen and leave a touch layout wearing desktop-sized controls.
 *
 * Inline targets are out of scope: a glossary term or a tappable number inside
 * a sentence cannot grow to 40px without breaking the text around it, and
 * WCAG 2.5.8 exempts them for exactly that reason.
 */
export function tapTarget(dense: string) {
  return { base: '40px', lg: dense } as const;
}
