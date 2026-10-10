import { cloneElement, useEffect, useState, type PointerEvent, type ReactElement } from 'react';
import { Tooltip } from '../ui/tooltip';

// Long enough to read a two-sentence tip, short enough not to linger over the
// next tap.
const TOUCH_TIP_MS = 3000;

interface TapTipProps {
  tip: string;
  children: ReactElement<{ onPointerDown?: (e: PointerEvent<HTMLElement>) => void }>;
}

/**
 * A tooltip for a control that is blocked and says why. The tooltip machine
 * ignores touch pointers, so on a phone a blocked button would do nothing and
 * explain nothing; a tap holds the tip open for a few seconds instead. Hover
 * and keyboard focus behave exactly as any other tooltip.
 */
export function TapTip({ tip, children }: TapTipProps) {
  const [hoverOpen, setHoverOpen] = useState(false);
  // The tap's timestamp, so a second tap restarts the hold; 0 is no hold.
  const [heldSince, setHeldSince] = useState(0);

  useEffect(() => {
    if (heldSince === 0) return;
    const timer = setTimeout(() => setHeldSince(0), TOUCH_TIP_MS);
    return () => clearTimeout(timer);
  }, [heldSince]);

  const childPointerDown = children.props.onPointerDown;
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    childPointerDown?.(e);
    if (e.pointerType === 'touch') setHeldSince(e.timeStamp || 1);
  };

  return (
    <Tooltip
      content={tip}
      // The pointer leaving and the click that follow a tap would each close
      // the tip at once; a held tip ignores them until its time is up.
      open={hoverOpen || heldSince !== 0}
      onOpenChange={(d) => setHoverOpen(d.open)}
      closeOnClick={false}
      closeOnPointerDown={false}
    >
      {cloneElement(children, { onPointerDown })}
    </Tooltip>
  );
}
