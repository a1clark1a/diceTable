import { Box, HStack, Text, type StackProps } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { hitColor, hitWeight } from './chart/palette';
import { formatPercent } from './chart/format';
import { HitDeltaValue } from './baseline/DeltaLine';

interface HitLineProps {
  /**
   * Which target this line answers, rendered as the caller styles it so a pool
   * row can tint and annotate its own ≥n. Omitted leaves no label column.
   */
  label?: ReactNode;
  p: number;
  /** Set to show the gap against the baseline instead of the raw percentage. */
  baseHit?: number | undefined;
  maxDelta: number;
  /** Table cells right-align their column; card pills centre theirs. */
  justify?: StackProps['justify'];
}

/**
 * One `target → percentage` line inside a stacked Hit % cell.
 *
 * Both halves are fixed-width columns. Left to themselves the label and the
 * value shrink to their text, so a line ending in `2.9%` sits further right
 * than one ending in `91.8%` and the stack stops reading as a column, which is
 * the whole point of the tabular figures. Same fixed-column reasoning as
 * DeltaLine.
 */
export function HitLine({
  label,
  p,
  baseHit,
  maxDelta,
  justify = 'flex-end',
}: HitLineProps) {
  return (
    <HStack gap={2} justify={justify}>
      {label !== undefined && (
        <Box as="span" minW="24px" textAlign="end" flexShrink={0}>
          {label}
        </Box>
      )}
      {baseHit !== undefined ? (
        <HitDeltaValue delta={p - baseHit} maxDelta={maxDelta} />
      ) : (
        <Box as="span" minW="52px" textAlign="end" flexShrink={0}>
          <Text
            as="span"
            color={hitColor(p)}
            fontWeight={hitWeight(p)}
          >
            {formatPercent(p)}
          </Text>
        </Box>
      )}
    </HStack>
  );
}
