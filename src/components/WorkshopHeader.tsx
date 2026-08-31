import { useState } from 'react';
import {
  Button,
  CloseButton,
  Dialog,
  Flex,
  HStack,
  Portal,
  Text,
} from '@chakra-ui/react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '../state/useApp';
import { isTotalsMode } from '../engine/expression';
import { MAX_EXPRESSIONS, type RollMode, type WorkshopView } from '../types';
import {
  WorkshopViewSwitcher,
  type WorkshopViewChip,
} from './WorkshopViewSwitcher';
import { ExamplesDialog } from './presets/ExamplesDialog';
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

  const atCap = expressions.length >= MAX_EXPRESSIONS;

  // Pool rows ignore rollMode entirely (they count successes), so only rows that
  // read it decide "mixed" - sum rows and check rows, where it applies to the
  // check roll. An all-pool table falls back to the stored modes so a definite
  // chip shows instead of a permanently mixed label.
  const sumModes = new Set(
    expressions.filter(isTotalsMode).map((e) => e.rollMode),
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
        {expressions.length > 0 && (
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
        )}
        {expressions.length > 0 && <ExamplesDialog />}
        <Tooltip
          content={`Up to ${MAX_EXPRESSIONS} rolls. Delete a row to add another.`}
          disabled={!atCap}
        >
          <Button
            size="sm"
            variant="outline"
            onClick={addExpression}
            disabled={atCap}
            minH="48px"
          >
            <Plus size={16} />
            {isDesktop ? 'Add roll' : 'Add'}
          </Button>
        </Tooltip>
        {expressions.length > 0 && <ClearAllDialog />}
      </HStack>
    </Flex>
  );
}

function ClearAllDialog() {
  const isDesktop = useIsDesktop();
  const { expressions, replaceExpressions } = useApp();
  const [open, setOpen] = useState(false);
  const count = expressions.length;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      lazyMount
      unmountOnExit
      placement="center"
      role="alertdialog"
      size="xs"
    >
      <Tooltip content={tipForId('clearAll')} disabled={open}>
        <Dialog.Trigger asChild>
          <Button size="sm" variant="ghost" colorPalette="red" minH="48px">
            <Trash2 size={16} />
            {isDesktop ? 'Clear all' : 'Clear'}
          </Button>
        </Dialog.Trigger>
      </Tooltip>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Clear the table?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                This removes{' '}
                {count === 1 ? 'the only roll' : `all ${count} rolls`} and
                can't be undone.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="red"
                onClick={() => {
                  replaceExpressions([]);
                  setOpen(false);
                }}
              >
                {count === 1 ? 'Clear 1 roll' : `Clear ${count} rolls`}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
