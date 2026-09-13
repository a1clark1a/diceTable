import { Box, Text } from '@chakra-ui/react';
import { useApp } from '../../state/useApp';
import { getRowData } from '../../state/useDistributions';
import { rowColor } from '../chart/palette';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';

export function BaselineCaption() {
  const { expressions, baselineId } = useApp();
  // With fewer than two rows there is nothing to compare against.
  if (expressions.length < 2) return null;

  const baselineIndex =
    baselineId === null ? -1 : expressions.findIndex((e) => e.id === baselineId);
  const baseline = baselineIndex === -1 ? undefined : expressions[baselineIndex];

  if (baseline === undefined) {
    return (
      <Text fontSize="xs" color="fg.muted" px={1}>
        Pin a roll to compare the others against it.
      </Text>
    );
  }

  const { stats, tooComplex } = getRowData(baseline);
  if (!stats.hasDist || tooComplex) {
    return (
      <Text fontSize="xs" color="fg.muted" px={1}>
        {baseline.name} has no numbers yet, so every row shows its own totals.
      </Text>
    );
  }

  return (
    <Text fontSize="xs" color="fg.muted" px={1}>
      Comparing to{' '}
      {/* The swatch carries the row colour, not the name. The row palette is
          built for marks at 3:1, and two of its eight slots fall under the
          4.5:1 text floor in each mode, so colouring the name would read as
          identity at the cost of legibility. Same square the table uses. */}
      <Box
        as="span"
        display="inline-block"
        w="9px"
        h="9px"
        borderRadius="2px"
        bg={rowColor(baselineIndex)}
        flexShrink={0}
        me="1"
      />
      <HelpTerm tip={tipForId('baselineCompare')}>
        <Text as="span" color="fg" fontWeight="semibold">
          {baseline.name}
        </Text>
      </HelpTerm>
      . Tap the pin again to clear.
    </Text>
  );
}
