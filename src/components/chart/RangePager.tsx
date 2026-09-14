import { HStack, IconButton, Text } from '@chakra-ui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { tapTarget } from '../tapTarget';

const TABULAR = { fontVariantNumeric: 'tabular-nums' } as const;

interface RangePagerProps {
  /** Zero-based index of the first row shown, and how many are shown. */
  from: number;
  shown: number;
  total: number;
  page: number;
  pages: number;
  /** Names the surface in the button labels, e.g. "Totals chart". */
  what: string;
  onPage: (page: number) => void;
  children?: React.ReactNode;
}

/**
 * Which slice of the rolls a surface is drawing, and the way to the rest.
 *
 * A cap that only says "showing the first N" leaves every roll past it
 * unreachable on that surface, and with no reorder action the roll you can
 * never see is always the newest one.
 */
export function RangePager({
  from,
  shown,
  total,
  page,
  pages,
  what,
  onPage,
  children,
}: RangePagerProps) {
  return (
    <HStack gap={1} fontSize="xs" color="fg.muted" w="100%">
      {children}
      <Text as="span">
        Showing {from + 1} to {from + shown} of {total} rolls
      </Text>
      <HStack gap={0} ms="auto" flexShrink={0}>
        <IconButton
          size="xs"
          variant="ghost"
          h={tapTarget('24px')}
          minW={tapTarget('24px')}
          aria-label={`Previous rolls on the ${what}`}
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={14} />
        </IconButton>
        <Text as="span" px={1} fontFamily="mono" style={TABULAR}>
          {page + 1}/{pages}
        </Text>
        <IconButton
          size="xs"
          variant="ghost"
          h={tapTarget('24px')}
          minW={tapTarget('24px')}
          aria-label={`More rolls on the ${what}`}
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={14} />
        </IconButton>
      </HStack>
    </HStack>
  );
}
