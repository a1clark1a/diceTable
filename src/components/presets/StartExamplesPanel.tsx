import { Box, Button, Heading, Stack, Text } from '@chakra-ui/react';
import { Plus } from 'lucide-react';
import { useApp } from '../../state/useApp';
import { STARTER_PRESETS } from '../../presets/starterRolls';
import { PresetCardGrid } from './PresetCardGrid';

export function StartExamplesPanel() {
  const { addExpression, addExpressions } = useApp();

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border.subtle"
      borderRadius="lg"
      px={{ base: 4, md: 8 }}
      py={{ base: 6, md: 8 }}
    >
      <Stack gap={1} align="center">
        <Heading as="h2" size="md">
          Start with an example
        </Heading>
        <Text
          fontSize="sm"
          color="fg.muted"
          textAlign="center"
          maxW={{ md: '460px' }}
          css={{ textWrap: 'pretty' }}
        >
          Pick a roll and the table builds itself. Rename it, change the dice,
          or delete it afterwards.
        </Text>
      </Stack>
      <Box mt={{ base: 5, md: 6 }}>
        <PresetCardGrid />
      </Box>
      <Stack
        direction={{ base: 'column', md: 'row' }}
        gap={{ base: 2, md: 3 }}
        mt={{ base: 6, md: 7 }}
        justify="center"
        align={{ base: 'stretch', md: 'center' }}
      >
        <Button
          colorPalette="blue"
          minH={{ base: '48px', md: '44px' }}
          onClick={() => addExpressions(STARTER_PRESETS.map((p) => p.expr))}
        >
          Load every example
        </Button>
        <Button
          variant="ghost"
          minH={{ base: '48px', md: '44px' }}
          onClick={addExpression}
        >
          <Plus size={16} />
          Start from a blank roll
        </Button>
      </Stack>
    </Box>
  );
}
