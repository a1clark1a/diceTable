import { Box, Button, Code, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useApp } from '../../state/useApp';
import { getRowData } from '../../state/useDistributions';
import type { StarterPreset } from '../../presets/starterRolls';
import type { Expression } from '../../types';
import { formatNumber } from '../chart/format';

interface PresetCardGridProps {
  presets: readonly StarterPreset[];
}

export function PresetCardGrid({ presets }: PresetCardGridProps) {
  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} gap={3} maxW="760px" mx="auto" w="full">
      {presets.map((p) => (
        <PresetCard key={p.slug} preset={p} />
      ))}
    </SimpleGrid>
  );
}

function PresetCard({ preset }: { preset: StarterPreset }) {
  const { addExpressions } = useApp();
  const rowCount = preset.rows.length;
  const multi = rowCount > 1;

  return (
    <Box
      bg="bg"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      p={{ base: 3, md: 4 }}
      display="flex"
      flexDirection="column"
    >
      <HStack justify="space-between" align="baseline" gap={{ base: 2, md: 3 }}>
        <Text fontSize="sm" fontWeight="semibold">
          {preset.name}
        </Text>
        <Code fontSize="xs" flexShrink={0} maxW="55%" whiteSpace="normal" textAlign="end">
          {preset.dice}
        </Code>
      </HStack>
      {preset.alsoCalled.length > 0 && (
        <Text fontSize="xs" color="fg.muted" mt={1}>
          Also called {preset.alsoCalled.join(' · ')}
        </Text>
      )}
      {/* flex=1 sends row-height slack here, so the stat rows and button pin
          to the card bottom and align across grid rows. */}
      <Text
        fontSize="xs"
        color="fg.muted"
        mt={1}
        flex="1"
        css={{ textWrap: 'pretty' }}
      >
        {preset.why}
      </Text>
      {multi && (
        <Text fontSize="2xs" color="fg.muted" mt={2} fontWeight="medium">
          Adds {rowCount} rolls
        </Text>
      )}
      <Stack gap={0.5} mt={multi ? 1 : 2}>
        {preset.rows.map((row) => (
          <RowStatsLine key={row.id} row={row} showName={multi} />
        ))}
      </Stack>
      <Button
        size="sm"
        variant="outline"
        width="100%"
        mt={3}
        minH={{ base: '44px', md: '40px' }}
        onClick={() => addExpressions([...preset.rows])}
      >
        {multi ? `Use these ${rowCount} rolls` : 'Use this roll'}
      </Button>
    </Box>
  );
}

function RowStatsLine({ row, showName }: { row: Expression; showName: boolean }) {
  const { stats } = getRowData(row);
  const avg = formatNumber(stats.mean, 1) + (row.mode === 'pool' ? ' succ.' : '');
  // Formatted the way the table's range cell is, so the card promises the
  // exact text the row will show once added.
  const range = `${stats.min}–${stats.max}`;

  return (
    <HStack gap={4}>
      {showName && (
        <Text fontSize="2xs" color="fg.muted" flex="1" minW={0} truncate>
          {row.name}
        </Text>
      )}
      <Text fontSize="2xs" color="fg.muted" fontFamily="mono">
        avg {avg}
      </Text>
      <Text fontSize="2xs" color="fg.muted" fontFamily="mono">
        range {range}
      </Text>
    </HStack>
  );
}
