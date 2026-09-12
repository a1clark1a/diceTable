import { useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 48em)';

// Not a device class: the rolls table's own min-content width. Below this it
// cannot lay out its columns without a horizontal scroll, and the first thing
// that scroll puts out of reach is the row actions column, so a narrower
// viewport gets the cards instead. Raise this if the table gains a column.
const TABLE_QUERY = '(min-width: 62em)';

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
