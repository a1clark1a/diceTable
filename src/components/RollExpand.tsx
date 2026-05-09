import {
  Box,
  Button,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Plus } from 'lucide-react';
import { useApp } from '../state/useApp';
import type { Expression, RollMode } from '../types';
import { DicePartRow } from './editor/DicePartRow';
import { Tooltip } from './ui/tooltip';
import { HelpTerm } from './ui/help-term';
import { tipForId } from '../docs/glossary';

const ROLL_MODES: { value: RollMode; label: string; tip: string }[] = [
  { value: 'normal', label: 'Normal', tip: tipForId('rollModeNormal') },
  { value: 'advantage', label: 'Advantage', tip: tipForId('rollModeAdvantage') },
  { value: 'disadvantage', label: 'Disadvantage', tip: tipForId('rollModeDisadvantage') },
];

interface RollExpandProps {
  expression: Expression;
}

export function RollExpand({ expression }: RollExpandProps) {
  const { addPart, removePart, updatePart, updateExpression } = useApp();

  return (
    <Stack gap={3} p={{ base: 3, md: 4 }} bg="bg.subtle">
      <Box
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="md"
        p={3}
      >
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
          mb={2}
        >
          Dice parts
        </Text>
        <Stack gap={2}>
          {expression.parts.map((part) => (
            <DicePartRow
              key={part.id}
              part={part}
              onChange={(patch) => updatePart(expression.id, part.id, patch)}
              onRemove={() => removePart(expression.id, part.id)}
              canRemove={expression.parts.length > 1}
            />
          ))}
        </Stack>
        <Button
          size="sm"
          variant="outline"
          mt={3}
          onClick={() => addPart(expression.id)}
        >
          <Plus size={14} />
          Add part
        </Button>
      </Box>

      <Box
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="md"
        p={3}
      >
        <Box
          fontSize="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
          mb={2}
        >
          <HelpTerm tip={tipForId('rollMode')}>Roll mode</HelpTerm>
        </Box>
        <HStack
          gap={0}
          bg="bg.subtle"
          borderRadius="md"
          p={1}
          display="inline-flex"
        >
          {ROLL_MODES.map((m) => {
            const active = expression.rollMode === m.value;
            return (
              <Tooltip key={m.value} content={m.tip}>
                <Button
                  size="sm"
                  variant={active ? 'solid' : 'ghost'}
                  colorPalette={active ? 'blue' : 'gray'}
                  onClick={() =>
                    updateExpression(expression.id, { rollMode: m.value })
                  }
                  aria-pressed={active}
                  aria-label={m.label}
                >
                  {m.label}
                </Button>
              </Tooltip>
            );
          })}
        </HStack>
      </Box>
    </Stack>
  );
}
