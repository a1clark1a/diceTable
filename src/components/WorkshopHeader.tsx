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

const ROLL_MODES: {
  value: RollMode;
  label: string;
  fullLabel: string;
  tip: string;
}[] = [
  {
    value: 'normal',
    label: 'Normal',
    fullLabel: 'Normal',
    tip: tipForId('rollModeNormal'),
  },
  {
    value: 'advantage',
    label: 'Adv',
    fullLabel: 'Advantage',
    tip: tipForId('rollModeAdvantage'),
  },
  {
    value: 'disadvantage',
    label: 'Dis',
    fullLabel: 'Disadvantage',
    tip: tipForId('rollModeDisadvantage'),
  },
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

  // Pool rows ignore rollMode entirely (they count successes), so only sum rows
  // decide "mixed". An all-pool table falls back to the stored modes so a
  // definite chip shows instead of a permanently mixed label.
  const sumModes = new Set(
    expressions.filter((e) => e.mode === 'sum').map((e) => e.rollMode),
  );
  const mixed = sumModes.size > 1;
  const firstSumMode = sumModes.values().next().value ?? null;
  const activeMode: RollMode | null = mixed
    ? null
    : firstSumMode ?? expressions[0]?.rollMode ?? null;

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
                    aria-label={m.fullLabel}
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
          minH="48px"
        >
          <Plus size={16} />
          {isDesktop ? 'Add roll' : 'Add'}
        </Button>
      </HStack>
    </Flex>
  );
}
