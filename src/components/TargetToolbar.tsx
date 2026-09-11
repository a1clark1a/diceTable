import {
  useCallback,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  Box,
  HStack,
  IconButton,
  Input,
  NativeSelect,
  Stack,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { X } from 'lucide-react';
import { useApp } from '../state/useApp';
import { MAX_TARGETS, type TargetRuling } from '../types';
import { HelpTerm } from './ui/help-term';
import { tipForId } from '../docs/glossary';
import { RulingSymbol } from './targetRuling';
import { RULING_OPTIONS, RULING_SYMBOL, isTargetRuling } from './targetRulingMeta';
import { PARAM_LABEL_GUTTER, ParamLabel } from './ParamLabel';

// Clamping in parse means the duplicate and cap checks below run on the value
// the store will actually keep, rather than on a raw draft the store then
// floors out from under them. Garbage and out-of-range input landing on the
// nearest bound is the same trade NumberStepper.parseClamped makes.
function parseDraft(raw: string, minValue?: number): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return null;
  return minValue !== undefined && n < minValue ? minValue : n;
}

interface TargetDraft {
  draft: string;
  setDraft: (raw: string) => void;
  commitDraft: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

// Shared by both target rows: type a number, Enter or blur adds it as a chip,
// Escape drops the draft, Backspace on an empty draft takes the last chip back.
// minRemaining is how many chips the row must keep, so the pool row cannot lose
// the last threshold its Hit % cells answer to. minValue is the floor the store
// applies to a committed value, and is left off where the store keeps any
// integer: a sum target can sit below zero once modifiers do.
function useTargetDraft(
  values: number[],
  setValues: (next: number[]) => void,
  minRemaining: number,
  minValue?: number,
): TargetDraft {
  const [draft, setDraft] = useState('');

  const commitDraft = useCallback(() => {
    const parsed = parseDraft(draft, minValue);
    setDraft('');
    if (parsed === null) return;
    if (values.includes(parsed)) return;
    if (values.length >= MAX_TARGETS) return;
    setValues([...values, parsed]);
  }, [draft, values, setValues, minValue]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitDraft();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setDraft('');
        e.currentTarget.blur();
      } else if (
        e.key === 'Backspace' &&
        draft === '' &&
        values.length > minRemaining
      ) {
        e.preventDefault();
        setValues(values.slice(0, -1));
      }
    },
    [commitDraft, draft, values, setValues, minRemaining],
  );

  return { draft, setDraft, commitDraft, onKeyDown };
}

export function TargetToolbar() {
  const { target, setTarget, expressions, poolTargets, setPoolTargets } =
    useApp();
  const hasPoolRow = expressions.some((e) => e.mode === 'pool');
  const hasSumRow = expressions.some((e) => e.mode !== 'pool');

  const isFull = target.values.length >= MAX_TARGETS;

  const setValues = useCallback(
    (next: number[]) => setTarget({ values: next }),
    [setTarget],
  );
  const { draft, setDraft, commitDraft, onKeyDown } = useTargetDraft(
    target.values,
    setValues,
    0,
  );

  const removeValue = useCallback(
    (v: number) => {
      setValues(target.values.filter((x) => x !== v));
    },
    [target.values, setValues],
  );

  const hint = isFull
    ? `Up to ${MAX_TARGETS} targets. Remove one to add another.`
    : target.values.length > 0
      ? 'Add another target or clear to hide Hit %.'
      : hasPoolRow
        ? hasSumRow
          ? 'Add a target to show Hit % for sum rows.'
          : 'Pool rows use the pool target below.'
        : 'Add a target to show Hit % per row.';

  return (
    <Stack gap={2}>
      <HStack
        gap={2}
        minH={{ base: '44px', md: '46px' }}
        ps={3}
        borderLeftWidth="3px"
        borderLeftColor="transparent"
        flexWrap="wrap"
      >
        <Box w={PARAM_LABEL_GUTTER} flexShrink={0}>
          <HelpTerm tip={tipForId('target')}>
            <ParamLabel>Target</ParamLabel>
          </HelpTerm>
        </Box>
        <NativeSelect.Root size="sm" maxW="180px">
          <NativeSelect.Field
            value={target.ruling}
            onChange={(e) => {
              if (isTargetRuling(e.target.value)) setTarget({ ruling: e.target.value });
            }}
            aria-label="Target ruling"
            title="How to compare each roll to the target."
          >
            {RULING_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.shortLabel}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Wrap gap={1} flexShrink={1}>
          {target.values.map((v) => (
            <WrapItem key={v}>
              <TargetChip
                ruling={target.ruling}
                value={v}
                onRemove={() => removeValue(v)}
              />
            </WrapItem>
          ))}
        </Wrap>
        <Input
          size="sm"
          type="text"
          inputMode="numeric"
          placeholder={isFull ? '—' : 'Add'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={onKeyDown}
          disabled={isFull}
          maxW="80px"
          textAlign="right"
          fontFamily="mono"
          aria-label="Add target value"
        />
        {/* Guidance is desktop-only noise until the row is full, where the
            hint is the only thing explaining the dead input beside it. */}
        <Text
          fontSize="xs"
          color="fg.muted"
          ml="auto"
          display={isFull ? 'inline' : { base: 'none', md: 'inline' }}
        >
          {hint}
        </Text>
      </HStack>
      {hasPoolRow && (
        <PoolTargetRow
          poolTargets={poolTargets}
          setPoolTargets={setPoolTargets}
        />
      )}
    </Stack>
  );
}

interface PoolTargetRowProps {
  poolTargets: number[];
  setPoolTargets: (values: number[]) => void;
}

function PoolTargetRow({ poolTargets, setPoolTargets }: PoolTargetRowProps) {
  const isFull = poolTargets.length >= MAX_TARGETS;
  const { draft, setDraft, commitDraft, onKeyDown } = useTargetDraft(
    poolTargets,
    setPoolTargets,
    1,
    1,
  );

  const removeValue = useCallback(
    (v: number) => {
      setPoolTargets(poolTargets.filter((x) => x !== v));
    },
    [poolTargets, setPoolTargets],
  );

  const hint = isFull
    ? `Up to ${MAX_TARGETS} pool targets. Remove one to add another.`
    : poolTargets.length > 1
      ? 'Hit % on pool rows uses these counts.'
      : 'Add another count to compare thresholds side by side.';

  return (
    <HStack
      gap={2}
      minH={{ base: '44px', md: '46px' }}
      ps={3}
      borderLeftWidth="3px"
      borderLeftColor="purple.solid"
      // Without the card there is nothing between the two parameter rows on a
      // phone, where they stack instead of sitting side by side.
      borderTopWidth={{ base: '1px', md: 0 }}
      borderTopColor="border.subtle"
      pt={{ base: 2, md: 0 }}
      flexWrap="wrap"
    >
      <Box w={PARAM_LABEL_GUTTER} flexShrink={0}>
        <HelpTerm tip={tipForId('poolTarget')}>
          <ParamLabel color="purple.fg">Pool target</ParamLabel>
        </HelpTerm>
      </Box>
      <Wrap gap={1} flexShrink={1}>
        {poolTargets.map((v) => (
          <WrapItem key={v}>
            <TargetChip
              ruling="gte"
              value={v}
              variant="pool"
              // The list never empties, so the last threshold keeps no remove
              // control rather than offering one that refuses.
              onRemove={
                poolTargets.length > 1 ? () => removeValue(v) : undefined
              }
            />
          </WrapItem>
        ))}
      </Wrap>
      <Input
        size="sm"
        type="text"
        inputMode="numeric"
        placeholder={isFull ? '—' : 'Add'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
        disabled={isFull}
        maxW="80px"
        textAlign="right"
        fontFamily="mono"
        aria-label="Add pool target"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      />
      <Text fontSize="xs" color="fg.muted">
        successes
      </Text>
      <Text
        fontSize="xs"
        color="fg.muted"
        ml="auto"
        display={isFull ? 'inline' : { base: 'none', md: 'inline' }}
      >
        {hint}
      </Text>
    </HStack>
  );
}

// Pool chips read as one threshold token (≥1) to match the Hit % cells and the
// target grid headers; a numeric chip keeps the ruling loose from its value
// because the ruling is the user's choice there, not a fixed part of the label.
const CHIP_VARIANTS = {
  target: { noun: 'target', accent: 'fg.muted', gap: 1 },
  pool: { noun: 'pool target', accent: 'purple.fg', gap: 0.5 },
} as const;

interface TargetChipProps {
  ruling: TargetRuling;
  value: number;
  /** Omitted on a chip the row must keep, which then renders no remove control. */
  onRemove?: (() => void) | undefined;
  variant?: keyof typeof CHIP_VARIANTS;
}

function TargetChip({
  ruling,
  value,
  onRemove,
  variant = 'target',
}: TargetChipProps) {
  const symbol = RULING_SYMBOL[ruling];
  const { noun, accent, gap } = CHIP_VARIANTS[variant];
  return (
    <HStack
      gap={1}
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="full"
      pl={2}
      pr={onRemove ? 1 : 2}
      py={0.5}
      fontFamily="mono"
      fontSize="xs"
    >
      <HStack as="span" gap={gap}>
        <RulingSymbol ruling={ruling} color={accent} />
        <Text as="span" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Text>
      </HStack>
      {onRemove !== undefined && (
        <IconButton
          aria-label={`Remove ${noun} ${symbol} ${value}`}
          size="2xs"
          variant="ghost"
          onClick={onRemove}
          title={`Remove ${noun}`}
        >
          <X size={12} />
        </IconButton>
      )}
    </HStack>
  );
}
