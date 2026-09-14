import { useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 48em)';

// Not a device class: the rolls table's own min-content width. Below this it
// cannot lay out its columns without a horizontal scroll, and the first thing
// that scroll puts out of reach is the row actions column, so a narrower
// viewport gets the cards instead. Raise this if the table gains a column.
const TABLE_QUERY = '(min-width: 62em)';

/**
 * Not the table's threshold. The comparison dialog is maxW 1200px, so from this
 * viewport up its canvas is pinned at its maximum, which is the size the field
 * pen was calibrated against. 62em would hand the field a canvas less than half
 * that area.
 */
const WIDE_CHART_QUERY = '(min-width: 75em)';

/**
 * The field is discovered by pointing at names and watching one curve light up.
 * A device with no hover has no route in, whatever its width, so a touch tablet
 * keeps the paged twenty rather than a hundred curves it cannot single out.
 */
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

function readMatch(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia(query).matches;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => readMatch(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}

export function useTableFits(): boolean {
  return useMediaQuery(TABLE_QUERY);
}

export function useWideChart(): boolean {
  return useMediaQuery(WIDE_CHART_QUERY);
}

export function useFinePointer(): boolean {
  return useMediaQuery(FINE_POINTER_QUERY);
}
