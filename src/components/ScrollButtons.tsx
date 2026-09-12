import { useCallback, type RefObject } from 'react';
import { HStack, IconButton } from '@chakra-ui/react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Tooltip } from './ui/tooltip';

interface ScrollButtonsProps {
  chartRef?: RefObject<HTMLDivElement | null> | undefined;
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

export function ScrollButtons({ chartRef }: ScrollButtonsProps) {
  const onTop = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    scrollerFor(e.currentTarget)?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const onChart = useCallback(() => {
    chartRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [chartRef]);

  return (
    <HStack gap={1} flexShrink={0}>
      <Tooltip content="Scroll to top">
        <IconButton
          size="sm"
          variant="ghost"
          aria-label="Scroll to top"
          onClick={onTop}
          h="32px"
          minW="32px"
          // Below md the sticky toolbar carries its own pair, and above 2xl the
          // table scrolls inside its own box with nothing to return to. This is
          // the band in between, where neither is true.
          display={{ base: 'none', md: 'inline-flex', '2xl': 'none' }}
        >
          <ArrowUp size={16} />
        </IconButton>
      </Tooltip>
      {chartRef !== undefined && (
        <Tooltip content="Jump to chart">
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Jump to chart"
            onClick={onChart}
            h="32px"
            minW="32px"
            // Below md the sticky toolbar carries this; above 2xl the chart
            // already sits beside the table.
            display={{ base: 'none', md: 'inline-flex', '2xl': 'none' }}
          >
            <ArrowDown size={16} />
          </IconButton>
        </Tooltip>
      )}
    </HStack>
  );
}
