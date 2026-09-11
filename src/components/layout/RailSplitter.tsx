import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Box } from '@chakra-ui/react';

// The chart takes whatever the table leaves, so this floor is what stops a
// wide table squeezing the chart out of usable existence.
export const RAIL_MIN = 340;
// The table's own width is what the drag changes. The floor is about where
// the fixed columns stop fitting; the ceiling is past any content it has.
export const TABLE_MIN = 900;
export const TABLE_MAX = 1800;
// Where the table stops needing width: measured as the point past which a
// check row's chips no longer wrap beside its dice notation.
export const TABLE_WIDTH = 1280;
const STEP = 32;

interface RailSplitterProps {
  width: number;
  onWidth: (next: number) => void;
}

const clamp = (n: number): number => Math.min(TABLE_MAX, Math.max(TABLE_MIN, n));

/**
 * Drags the boundary between the table and the chart. What it sets is the
 * table's width; the chart takes the rest of the row, so widening one always
 * narrows the other. Pointer capture rather than window listeners, so a fast
 * drag that leaves the element still tracks, and the pointer keeps its grab
 * when it re-enters.
 */
export function RailSplitter({ width, onWidth }: RailSplitterProps) {
  const start = useRef<{ x: number; width: number } | null>(null);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = { x: e.clientX, width };
    },
    [width],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const from = start.current;
      if (from === null) return;
      // The table is on the left, so the separator tracks the pointer.
      onWidth(clamp(from.width + (e.clientX - from.x)));
    },
    [onWidth],
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    start.current = null;
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onWidth(clamp(width - STEP));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onWidth(clamp(width + STEP));
      }
    },
    [onWidth, width],
  );

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the table"
      aria-valuenow={Math.round(width)}
      aria-valuemin={TABLE_MIN}
      aria-valuemax={TABLE_MAX}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
