import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Box } from '@chakra-ui/react';

export const RAIL_MIN = 300;
export const RAIL_MAX = 900;
const STEP = 32;

interface RailSplitterProps {
  width: number;
  onWidth: (next: number) => void;
}

const clamp = (n: number): number => Math.min(RAIL_MAX, Math.max(RAIL_MIN, n));

/**
 * Drags the boundary between the table and the chart rail. Pointer capture
 * rather than window listeners, so a fast drag that leaves the element still
 * tracks, and the pointer keeps its grab when it re-enters.
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
      // The rail is on the right, so dragging left widens it.
      onWidth(clamp(from.width + (from.x - e.clientX)));
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
        onWidth(clamp(width + STEP));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onWidth(clamp(width - STEP));
      }
    },
    [onWidth, width],
  );

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the chart"
      aria-valuenow={Math.round(width)}
      aria-valuemin={RAIL_MIN}
      aria-valuemax={RAIL_MAX}
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
