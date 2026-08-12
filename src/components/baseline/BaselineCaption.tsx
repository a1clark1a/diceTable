import { Text } from '@chakra-ui/react';
import { useApp } from '../../state/useApp';
import { getRowData } from '../../state/useDistributions';

export function BaselineCaption() {
  const { expressions, baselineId } = useApp();
  // With fewer than two rows there is nothing to compare against.
  if (expressions.length < 2) return null;

  const baseline =
    baselineId === null
      ? undefined
      : expressions.find((e) => e.id === baselineId);

  let text: string;
  if (baseline === undefined) {
    text = 'Pin a roll to compare the others against it.';
  } else {
    const { stats, tooComplex } = getRowData(baseline);
    text =
      stats.hasDist && !tooComplex
        ? `Comparing to ${baseline.name}. Green means better, red worse, grey shows spread change. Tap the pin again to clear.`
        : `${baseline.name} has no numbers yet, so every row shows its own totals.`;
  }

  return (
    <Text fontSize="xs" color="fg.muted" px={1}>
      {text}
    </Text>
  );
}
