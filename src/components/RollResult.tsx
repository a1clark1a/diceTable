import { useState } from 'react';
import {
  Box,
  Button,
  Field,
  HStack,
  IconButton,
  NumberInput,
  Popover,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Dices } from 'lucide-react';
import type { Distribution } from '../types';
import { useRollHistory } from '../state/useRollHistory';
import { EM_DASH } from './chart/format';
import { tipForId } from '../docs/glossary';

const MAX_COUNT = 1000;

interface RollResultInlineProps {
  exprId: string;
}

export function RollResultInline({ exprId }: RollResultInlineProps) {
  const { lastResult } = useRollHistory();
  const last = lastResult(exprId);
  return (
    <Text
      as="span"
      fontFamily="mono"
      fontWeight={last !== null ? 'semibold' : undefined}
      color={last !== null ? 'fg' : 'fg.muted'}
      fontSize="sm"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {last !== null ? String(last) : EM_DASH}
    </Text>
  );
}

interface RollPopoverProps {
  exprId: string;
  exprName: string;
  dist: Distribution;
  disabled: boolean;
  size?: 'xs' | 'sm';
}

export function RollPopover({
  exprId,
  exprName,
  dist,
  disabled,
  size = 'xs',
}: RollPopoverProps) {
  const { rollMany, getHistory, clearHistory } = useRollHistory();
  const [countInput, setCountInput] = useState<string>('1');
  const [lastBatch, setLastBatch] = useState<number[]>([]);

  const history = getHistory(exprId);
  const last = history[0];

  const parsedCount = Number.parseInt(countInput, 10);
  const count = Number.isFinite(parsedCount)
    ? Math.min(MAX_COUNT, Math.max(1, parsedCount))
    : 1;

  const handleRoll = () => {
    const results = rollMany(exprId, dist, count);
    if (results.length > 0) setLastBatch(results);
  };

  const handleClear = () => {
    clearHistory(exprId);
    setLastBatch([]);
  };

  const showSummary = lastBatch.length > 1;
  let summaryAvg = 0;
  let summaryMin = 0;
  let summaryMax = 0;
  if (showSummary) {
    let sum = 0;
    let mn = lastBatch[0]!;
    let mx = lastBatch[0]!;
    for (const v of lastBatch) {
      sum += v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    summaryAvg = sum / lastBatch.length;
    summaryMin = mn;
    summaryMax = mx;
  }

  return (
    <Popover.Root positioning={{ placement: 'top-end' }} lazyMount unmountOnExit>
      <Popover.Trigger asChild>
        <IconButton
          size={size}
          variant="ghost"
          aria-label={`Roll ${exprName}`}
          title={
            disabled
              ? 'No result available. Check the dice configuration.'
              : tipForId('roll')
          }
          disabled={disabled}
        >
          <Dices size={14} />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            maxW="320px"
            w={{ base: 'calc(100vw - 32px)', sm: '320px' }}
          >
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body>
              <Stack gap={3}>
                <Box textAlign="center">
                  <Text
                    fontSize="2xs"
                    textTransform="uppercase"
                    color="fg.muted"
                    fontWeight="semibold"
                    letterSpacing="wider"
                    mb={1}
                  >
                    {exprName}
                  </Text>
                  <Text
                    fontFamily="mono"
                    fontSize="3xl"
                    fontWeight={last !== undefined ? 'semibold' : 'normal'}
                    color={last !== undefined ? 'fg' : 'fg.muted'}
                    lineHeight="1.1"
                    aria-live="polite"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {last !== undefined ? String(last) : EM_DASH}
                  </Text>
                </Box>

                {showSummary && (
                  <Box bg="bg.subtle" borderRadius="md" px={3} py={2}>
                    <Text
                      fontSize="xs"
                      color="fg.muted"
                      textAlign="center"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      ×{lastBatch.length} · avg {summaryAvg.toFixed(1)} · range{' '}
                      {summaryMin}
                      {EM_DASH}
                      {summaryMax}
                    </Text>
                  </Box>
                )}

                {history.length > 0 && (
                  <Box>
                    <HStack justify="space-between" align="center" mb={1}>
                      <Text
                        fontSize="2xs"
                        textTransform="uppercase"
                        color="fg.muted"
                        fontWeight="semibold"
                        letterSpacing="wider"
                      >
                        Recent
                      </Text>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="fg.muted"
                        onClick={handleClear}
                        aria-label={`Clear roll history for ${exprName}`}
                      >
                        Clear
                      </Button>
                    </HStack>
                    <Text
                      fontFamily="mono"
                      fontSize="xs"
                      color="fg.muted"
                      wordBreak="break-word"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {history.join(' · ')}
                    </Text>
                  </Box>
                )}

                <HStack gap={2} align="flex-end">
                  <Field.Root flex="1">
                    <Field.Label fontSize="2xs" color="fg.muted" textTransform="uppercase" fontWeight="semibold" letterSpacing="wider">
                      Times
                    </Field.Label>
                    <NumberInput.Root
                      size="sm"
                      min={1}
                      max={MAX_COUNT}
                      value={countInput}
                      onValueChange={(e) => setCountInput(e.value)}
                      width="100%"
                    >
                      <NumberInput.Control />
                      <NumberInput.Input fontFamily="mono" />
                    </NumberInput.Root>
                  </Field.Root>
                  <Button
                    size="sm"
                    colorPalette="blue"
                    onClick={handleRoll}
                    disabled={disabled}
                  >
                    <Dices size={14} />
                    Roll
                  </Button>
                </HStack>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
