import { Box, Button, Code, HStack, SimpleGrid, Text } from '@chakra-ui/react';
import { useApp } from '../../state/useApp';
import { STARTER_PRESETS, type StarterPreset } from '../../presets/starterRolls';
import { formatNumber } from '../chart/format';

export function PresetCardGrid() {
  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} gap={3} maxW="760px" mx="auto">
      {STARTER_PRESETS.map((p) => (
        <PresetCard key={p.expr.id} preset={p} />
      ))}
    </SimpleGrid>
  );
}

function PresetCard({ preset }: { preset: StarterPreset }) {
  const { addExpressions } = useApp();
  const isPool = preset.expr.mode === 'pool';
  const avg = formatNumber(preset.stats.mean, 1) + (isPool ? ' succ.' : '');
  const range = `${preset.stats.min}–${preset.stats.max}`;

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
          {preset.expr.name}
        </Text>
        <Code fontSize="xs">{preset.dice}</Code>
      </HStack>
      {/* flex=1 sends row-height slack here, so the stat row and button pin
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
      <HStack gap={4} mt={2}>
        <Text fontSize="2xs" color="fg.muted" fontFamily="mono">
          avg {avg}
        </Text>
        <Text fontSize="2xs" color="fg.muted" fontFamily="mono">
          range {range}
        </Text>
      </HStack>
      <Button
        size="sm"
        variant="outline"
        width="100%"
        mt={3}
        minH={{ base: '44px', md: '40px' }}
        onClick={() => addExpressions([preset.expr])}
      >
        Use this roll
      </Button>
    </Box>
  );
}
