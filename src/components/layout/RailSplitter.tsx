import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { Box } from '@chakra-ui/react';

// The chart takes whatever the table leaves, so this floor is what stops a
// wide table squeezing the chart out of usable existence.
export const RAIL_MIN = 340;
// The table's own width is what the drag changes. The floor is about where
// the fixed columns stop fitting; the ceiling is past any content it has.
const TABLE_MIN = 900;
const TABLE_MAX = 1800;
// Where the table stops needing width: measured as the point past which a
// check row's chips no longer wrap beside its dice notation.
export const TABLE_WIDTH = 1280;
const STEP = 32;

interface RailSplitterProps {
  width: number;
  onWidth: (next: number) => void;
  /**
   * The row the drag divides and the column it grows. Measured rather than
   * recomputed here, because the page padding and the gap between the columns
   * are styling decisions that would silently drift out of any arithmetic this
   * component kept of its own.
   */
  gridRef: RefObject<HTMLDivElement | null>;
  trackRef: RefObject<HTMLDivElement | null>;
}

/**
 * Drags the boundary between the table and the chart. What it sets is the
 * table's width; the chart takes the rest of the row, so widening one always
 * narrows the other. Pointer capture rather than window listeners, so a fast
 * drag that leaves the element still tracks, and the pointer keeps its grab
 * when it re-enters.
 */
export function RailSplitter({
  width,
  onWidth,
  gridRef,
  trackRef,
}: RailSplitterProps) {
  const self = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; width: number } | null>(null);
  // What the grid can actually hand the table. Past this the requested width is
  // a number nothing on screen answers to, which is what left the divider
  // standing still under a moving pointer at any viewport under 1645px.
  const [ceiling, setCeiling] = useState(TABLE_MAX);

  const measureCeiling = useCallback((): number => {
    const grid = gridRef.current;
    const el = self.current;
    if (grid === null || el === null || el.offsetParent === null) return TABLE_MAX;
    const style = window.getComputedStyle(el);
    const span =
      el.getBoundingClientRect().width +
      Number.parseFloat(style.marginLeft) +
      Number.parseFloat(style.marginRight);
    const room = grid.getBoundingClientRect().width - span - RAIL_MIN;
    return Math.min(TABLE_MAX, Math.max(TABLE_MIN, room));
  }, [gridRef]);

  useEffect(() => {
    const grid = gridRef.current;
    if (grid === null) return;
    const sync = () => setCeiling(measureCeiling());
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(grid);
    return () => {
      observer.disconnect();
    };
  }, [gridRef, measureCeiling]);

  // A viewport that shrank past the current request has to pull it down, or the
  // divider sits at the ceiling while the control still reports something wider.
  useEffect(() => {
    if (width > ceiling) onWidth(ceiling);
  }, [width, ceiling, onWidth]);

  const clamp = useCallback(
    (n: number): number => Math.min(ceiling, Math.max(TABLE_MIN, n)),
    [ceiling],
  );

  // Both input paths start from the track the grid produced, so a drag cannot
  // compound a width the layout already refused.
  const rendered = useCallback((): number => {
    const track = trackRef.current;
    return track === null ? width : track.getBoundingClientRect().width;
  }, [trackRef, width]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = { x: e.clientX, width: rendered() };
    },
    [rendered],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const from = start.current;
      if (from === null) return;
      // A gesture the browser ended without an up event leaves the ref set, and
      // without this the next plain hover would resize the table.
      if (e.buttons === 0) {
        start.current = null;
        return;
      }
      // The table is on the left, so the separator tracks the pointer.
      onWidth(clamp(from.width + (e.clientX - from.x)));
    },
    [clamp, onWidth],
  );

  const endGesture = useCallback((e: PointerEvent<HTMLDivElement>) => {
    start.current = null;
    // Releasing a capture the browser already took back throws, and the throw
    // would skip the reset above if it came first.
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      onWidth(clamp(rendered() + (e.key === 'ArrowRight' ? STEP : -STEP)));
    },
    [clamp, onWidth, rendered],
  );

  return (
    <Box
      ref={self}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the table"
      aria-valuenow={Math.round(Math.min(width, ceiling))}
      aria-valuemin={TABLE_MIN}
      aria-valuemax={Math.round(ceiling)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onLostPointerCapture={endGesture}
      onKeyDown={onKeyDown}
      cursor="col-resize"
      // Only meaningful once the chart has a column of its own to trade with.
      display={{ base: 'none', '2xl': 'flex' }}
      // A 1px rule is the visible affordance; the padding around it is what a
      // pointer actually has to hit.
      w="11px"
      mx="-5px"
      flexShrink={0}
      alignItems="stretch"
      justifyContent="center"
      css={{ touchAction: 'none' }}
      _focusVisible={{
        outlineWidth: '2px',
        outlineStyle: 'solid',
        outlineColor: 'blue.solid',
        outlineOffset: '-2px',
      }}
      _hover={{ '& > div': { bg: 'blue.solid' } }}
      zIndex={1}
    >
      <Box w="1px" bg="border" transition="background 0.12s" />
    </Box>
  );
}
