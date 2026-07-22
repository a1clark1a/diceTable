import { Button, Flex, HStack, Text } from '@chakra-ui/react';
import { Plus } from 'lucide-react';
import { useApp } from '../state/useApp';
import type { RollMode, WorkshopView } from '../types';
import {
  WorkshopViewSwitcher,
  type WorkshopViewChip,
} from './WorkshopViewSwitcher';
import { Tooltip } from './ui/tooltip';
import { HelpTerm } from './ui/help-term';
import { tipForId } from '../docs/glossary';
import { useIsDesktop } from '../hooks/useBreakpoint';

const ROLL_MODES: { value: RollMode; label: string; tip: string }[] = [
  { value: 'normal', label: 'Normal', tip: tipForId('rollModeNormal') },
  { value: 'advantage', label: 'Adv', tip: tipForId('rollModeAdvantage') },
  { value: 'disadvantage', label: 'Dis', tip: tipForId('rollModeDisadvantage') },
];

interface WorkshopHeaderProps {
  views: readonly WorkshopViewChip[];
  activeView: WorkshopView;
  onSelectView: (view: WorkshopView) => void;
}

export function WorkshopHeader({
  views,
  activeView,
  onSelectView,
}: WorkshopHeaderProps) {
  const isDesktop = useIsDesktop();
  const { expressions, setAllRollModes, addExpression } = useApp();

  const rollModes = new Set(expressions.map((e) => e.rollMode));
  const mixed = rollModes.size > 1;
  const activeMode: RollMode | null = mixed
    ? null
    : expressions[0]?.rollMode ?? null;

  return (
    <Flex
      gap={{ base: 3, md: 4 }}
      direction={{ base: 'column', md: 'row' }}
      align={{ base: 'stretch', md: 'center' }}
      justify="space-between"
      wrap="wrap"
    >
      <WorkshopViewSwitcher
        views={views}
        active={activeView}
        onSelect={onSelectView}
      />
      <HStack gap={{ base: 3, md: 4 }} align="center" wrap="wrap">
        <HStack gap={2} align="center">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
            whiteSpace="nowrap"
          >
            <HelpTerm tip={tipForId('globalRollMode')}>Roll mode</HelpTerm>
            {mixed ? ' (mixed)' : ''}
          </Text>
          <HStack
            gap={0}
            bg="bg.subtle"
            borderRadius="md"
            p={1}
            display="inline-flex"
            role="group"
            aria-label="Global roll mode"
          >
            {ROLL_MODES.map((m) => {
              const active = activeMode === m.value;
              return (
                <Tooltip key={m.value} content={m.tip}>
                  <Button
                    size="sm"
                    variant={active ? 'solid' : 'ghost'}
                    colorPalette={active ? 'blue' : 'gray'}
                    onClick={() => setAllRollModes(m.value)}
                    aria-pressed={active}
                    aria-label={m.label}
                    minH="40px"
                  >
                    {m.label}
                  </Button>
                </Tooltip>
              );
            })}
          </HStack>
        </HStack>
        <Button
          size="sm"
          variant="outline"
          onClick={addExpression}
          minH="40px"
        >
          <Plus size={16} />
          {isDesktop ? 'Add roll' : 'Add'}
        </Button>
      </HStack>
    </Flex>
  );
}
