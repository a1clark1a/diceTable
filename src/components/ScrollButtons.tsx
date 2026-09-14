import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { HStack, IconButton, type IconButtonProps } from '@chakra-ui/react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Tooltip } from './ui/tooltip';
import { tapTarget } from './tapTarget';

// Below md the sticky toolbar owns this pair, and above 2xl the table scrolls
// inside its own box with nothing to return to. This is the band in between.
const CAPTION_BAND = { base: 'none', md: 'inline-flex', '2xl': 'none' } as const;

interface ScrollButtonsProps {
  chartRef?: RefObject<HTMLDivElement | null> | undefined;
  /** Which widths this copy shows at; the sticky toolbar renders the other band. */
  display?: IconButtonProps['display'];
}

/**
 * Which element actually scrolls moves with the layout: the main region below
 * the two-column breakpoint, the table's own column above it. Walking up from
 * the button finds whichever it is rather than naming one and being wrong half
 * the time.
 */
function scrollerFor(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node !== null) {
    const overflow = getComputedStyle(node).overflowY;
    if (
      (overflow === 'auto' || overflow === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return document.querySelector('main');
}

interface ScrollState {
  /** False only when the scroller is measured and has nothing to travel. */
  scrollable: boolean;
  atTop: boolean;
  atBottom: boolean;
}

/**
 * Whether there is anywhere to go, and which way.
 *
 * An unmeasured scroller is *unknown*, not *empty*. jsdom reports every height
 * as 0 and stubs ResizeObserver as a no-op, so treating a zero reading as
 * "nothing to scroll" would take the whole control off the page in every test
 * that asserts it, and off any real layout that measures a frame late.
 */
function useScrollState(ref: RefObject<HTMLElement | null>): ScrollState {
  const [state, setState] = useState<ScrollState>({
    scrollable: true,
    atTop: true,
    atBottom: false,
  });

  useEffect(() => {
    const el = scrollerFor(ref.current);
    if (el === null) return;

    const read = () => {
      const room = el.scrollHeight - el.clientHeight;
      const measured = el.clientHeight > 0;
      setState({
        scrollable: !measured || room > 1,
        atTop: el.scrollTop <= 1,
        atBottom: measured && el.scrollTop >= room - 1,
      });
    };
    read();

    el.addEventListener('scroll', read, { passive: true });
    // The scroller's own box never changes height on these views; its content
    // does, so the child is the one worth watching when rows are added.
    const observer = new ResizeObserver(read);
    observer.observe(el);
    if (el.firstElementChild !== null) observer.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', read);
      observer.disconnect();
    };
  }, [ref]);

  return state;
}

export function ScrollButtons({
  chartRef,
  display = CAPTION_BAND,
}: ScrollButtonsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollable, atTop, atBottom } = useScrollState(ref);

  // Resolved per click rather than cached: the layout that decides which
  // element scrolls can change under a mounted toolbar.
  const onTop = useCallback(() => {
    scrollerFor(ref.current)?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const onBottom = useCallback(() => {
    const el = scrollerFor(ref.current);
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  const onChart = useCallback(() => {
    chartRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [chartRef]);

  // Head-to-head caps at twelve rolls and fits a desktop window whole, so the
  // pair would otherwise sit there as two controls that do nothing.
  if (!scrollable) return null;

  const shared = {
    size: 'sm',
    variant: 'ghost',
    h: tapTarget('32px'),
    minW: tapTarget('32px'),
    display,
  } as const;

  return (
    <HStack ref={ref} gap={1} flexShrink={0}>
      <Tooltip content="Scroll to top">
        <IconButton
          {...shared}
          aria-label="Scroll to top"
          onClick={onTop}
          disabled={atTop}
        >
          <ArrowUp size={16} />
        </IconButton>
      </Tooltip>
      {/* The chart is the bottom of the table view, so there it is the more
          useful destination of the two. Every other view has no chart to jump
          to, which is what used to leave the up arrow standing on its own. */}
      {chartRef !== undefined ? (
        <Tooltip content="Jump to chart">
          <IconButton {...shared} aria-label="Jump to chart" onClick={onChart}>
            <ArrowDown size={16} />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip content="Scroll to the bottom of this view">
          <IconButton
            {...shared}
            aria-label="Scroll to bottom"
            onClick={onBottom}
            disabled={atBottom}
          >
            <ArrowDown size={16} />
          </IconButton>
        </Tooltip>
      )}
    </HStack>
  );
}
