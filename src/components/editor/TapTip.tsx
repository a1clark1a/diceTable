import { Box } from '@chakra-ui/react';
import { cloneElement, useEffect, useState, type PointerEvent, type ReactElement } from 'react';
import { Tooltip } from '../ui/tooltip';

// Long enough to read a two-sentence tip, short enough not to linger over the
// next tap.
const TOUCH_TIP_MS = 3000;

interface TapTipProps {
  tip: string;
  /**
   * Whether a tap holds the tip open. Off for a control whose tap does
   * something, where the action is the answer; on for a blocked control or a
   * marker, whose tip is all a tap can give.
   */
  hold?: boolean;
  /**
   * Hang the tooltip on a wrapper instead of on the child. Needed when the
   * child is already a popover or dialog trigger: each machine finds its
   * trigger by the same data attributes, so on one element the tooltip's
   * overwrite the overlay's and it loses its anchor and its focus return. The
   * child then carries the tip itself as its description.
   */
  wrap?: boolean;
  children: ReactElement<{ onPointerDown?: (e: PointerEvent<HTMLElement>) => void }>;
}

/**
 * A tooltip a tap can open. The tooltip machine ignores touch pointers, so on
 * a phone a blocked button would do nothing and explain nothing; a tap holds
 * the tip open for a few seconds instead. Hover and keyboard focus behave
 * exactly as any other tooltip. A control that can switch between blocked and
 * live keeps this one wrapper in both states and flips `hold`, because
 * swapping wrappers would remount the button and drop its focus.
 */
export function TapTip({ tip, hold = true, wrap = false, children }: TapTipProps) {
  const [hoverOpen, setHoverOpen] = useState(false);
  // The tap's timestamp, so a second tap restarts the hold; 0 is no hold.
  const [heldSince, setHeldSince] = useState(0);

  useEffect(() => {
    if (heldSince === 0) return;
    const timer = setTimeout(() => setHeldSince(0), TOUCH_TIP_MS);
    return () => clearTimeout(timer);
  }, [heldSince]);

  const holdOnTouch = (e: PointerEvent<HTMLElement>) => {
    if (hold && e.pointerType === 'touch') setHeldSince(e.timeStamp || 1);
  };
  const childPointerDown = children.props.onPointerDown;

  return (
    <Tooltip
      content={tip}
      // The pointer leaving and the click that follow a tap would each close
      // the tip at once; a held tip ignores them until its time is up.
      open={hoverOpen || heldSince !== 0}
      onOpenChange={(d) => setHoverOpen(d.open)}
      closeOnClick={!hold}
      closeOnPointerDown={!hold}
    >
      {wrap ? (
        <Box as="span" display="inline-flex" onPointerDown={holdOnTouch}>
          {children}
        </Box>
      ) : (
        cloneElement(children, {
          onPointerDown: (e: PointerEvent<HTMLElement>) => {
            childPointerDown?.(e);
            holdOnTouch(e);
          },
        })
      )}
    </Tooltip>
  );
}
