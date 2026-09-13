import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  Box,
  Flex,
  HStack,
  Stack,
  IconButton,
  Input,
  NativeSelect,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { X } from 'lucide-react';
import { useApp } from '../state/useApp';
import { MAX_TARGETS, type TargetRuling } from '../types';
import { Tooltip } from './ui/tooltip';
import { tipForId } from '../docs/glossary';
import { RulingSymbol } from './targetRuling';
import { RULING_OPTIONS, RULING_SYMBOL, isTargetRuling } from './targetRulingMeta';
import { RollModeControl } from './RollModeControl';
import { tapTarget } from './tapTarget';
import { ParamControl } from './ParamControl';

// Clamping in parse means the duplicate and cap checks below run on the value
// the store will actually keep, rather than on a raw draft the store then
// floors out from under them. Garbage and out-of-range input landing on the
// nearest bound is the same trade NumberStepper.parseClamped makes.
interface AddTargetInputProps {
  draft: string;
  setDraft: (raw: string) => void;
  commitDraft: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  isFull: boolean;
  hint: string;
  ariaLabel: string;
}

function AddTargetInput({
  draft,
  setDraft,
  commitDraft,
  onKeyDown,
  isFull,
  hint,
  ariaLabel,
}: AddTargetInputProps) {
  return (
    <Tooltip content={hint}>
      <Input
        size="sm"
        type="text"
        inputMode="numeric"
        placeholder="+"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
        disabled={isFull}
        w={tapTarget('36px')}
        h={tapTarget('28px')}
        px={0}
        flexShrink={0}
        textAlign="center"
        fontFamily="mono"
        fontSize="14px"
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border"
        borderRadius="4px"
        aria-label={ariaLabel}
        title={hint}
        _placeholder={{ color: 'fg.muted', opacity: 1 }}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      />
    </Tooltip>
  );
}

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
  const [draft, setDraftState] = useState('');
  // Escape clears the draft and blurs, and blur commits. React has not
  // re-rendered in between, so a commit reading state would still see the text
  // Escape just discarded and add it as a chip anyway.
  const draftRef = useRef('');

  const setDraft = useCallback((raw: string) => {
    draftRef.current = raw;
    setDraftState(raw);
  }, []);

  const commitDraft = useCallback(() => {
    const parsed = parseDraft(draftRef.current, minValue);
    setDraft('');
    if (parsed === null) return;
    if (values.includes(parsed)) return;
    if (values.length >= MAX_TARGETS) return;
    setValues([...values, parsed]);
  }, [setDraft, values, setValues, minValue]);

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
    [commitDraft, setDraft, draft, values, setValues, minRemaining],
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

  // Defined once and rendered in both the inline row and the sheet, so the two
  // layouts can never drift apart.
  const targetRuling = (
    // "≥ at least" needs about 115px; the old 150 padded the widest fixed
    // control in the row for no gain.
    <NativeSelect.Root size="sm" maxW="124px" minW="104px" flexShrink={1}>
      <NativeSelect.Field
        h={tapTarget('36px')}
        borderColor="border.subtle"
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
  );
  const targetValues = (
    <Wrap gap={1} minW={0} align="center">
      {target.values.map((v) => (
        <WrapItem key={v}>
          <TargetChip
            ruling={target.ruling}
            value={v}
            onRemove={() => removeValue(v)}
            showRuling={false}
          />
        </WrapItem>
      ))}
      <WrapItem>
        <AddTargetInput
          draft={draft}
          setDraft={setDraft}
          commitDraft={commitDraft}
          onKeyDown={onKeyDown}
          isFull={isFull}
          hint={hint}
          ariaLabel="Add target value"
        />
      </WrapItem>
    </Wrap>
  );

  return (
    <Flex
      columnGap={{ base: 2, xl: 6 }}
      rowGap={2}
      align="center"
      wrap="wrap"
      minH={{ base: '44px', md: '46px' }}
      // A flex item in a column parent shrinks to its min-height by default,
      // which pinned this bar at one row while its chips wrapped to three and
      // painted over the table underneath.
      flexShrink={0}
    >
      <ParamControl
        label="Target"
        accent="blue.fg"
        title="Targets"
        editLabel="Edit targets"
        tip={tipForId('target')}
        summary={
          target.values.length === 0 ? (
            <Text color="fg.muted">None</Text>
          ) : (
            <>
              <RulingSymbol ruling={target.ruling} color="blue.fg" />
              <Text
                color="fg"
                fontFamily="mono"
                truncate
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {target.values.join(' ')}
              </Text>
            </>
          )
        }
      >
        <Stack gap={3}>
          {targetRuling}
          {targetValues}
          <Text fontSize="xs" color="fg.muted">
            {hint}
          </Text>
        </Stack>
      </ParamControl>
      {hasPoolRow && (
        <PoolTargetRow
          poolTargets={poolTargets}
          setPoolTargets={setPoolTargets}
        />
      )}
      {/* Below md the same control is a radio group in the sticky toolbar's
          overflow menu, so showing it here too spends a line of a phone screen
          on a duplicate. */}
      <Box display={{ base: 'none', md: 'contents' }}>
        <RollModeControl />
      </Box>
    </Flex>
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

  const values = (
    <Wrap gap={1} minW={0} align="center">
      {poolTargets.map((v) => (
        <WrapItem key={v}>
          <TargetChip
            ruling="gte"
            value={v}
            variant="pool"
            // The list never empties, so the last threshold keeps no remove
            // control rather than offering one that refuses.
            onRemove={poolTargets.length > 1 ? () => removeValue(v) : undefined}
          />
        </WrapItem>
      ))}
      {/* No unit inside the editor: the trigger's summary reads "≥ 1 2 3
          successes" and the hint below names them as counts, so a third copy
          would only ever sit between the values and the add box. */}
      <WrapItem>
        <AddTargetInput
          draft={draft}
          setDraft={setDraft}
          commitDraft={commitDraft}
          onKeyDown={onKeyDown}
          isFull={isFull}
          hint={hint}
          ariaLabel="Add pool target"
        />
      </WrapItem>
    </Wrap>
  );

  return (
    <ParamControl
      label="Pool target"
      accent="purple.fg"
      title="Pool targets"
      editLabel="Edit pool targets"
      tip={tipForId('poolTarget')}
      summary={
        <>
          <RulingSymbol ruling="gte" color="purple.fg" />
          <Text
            color="fg"
            fontFamily="mono"
            truncate
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {poolTargets.join(' ')}
          </Text>
          <Text color="fg.muted">successes</Text>
        </>
      }
    >
      <Stack gap={3}>
        {values}
        <Text fontSize="xs" color="fg.muted">
          {hint}
        </Text>
      </Stack>
    </ParamControl>
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
  /**
   * Target chips sit beside the ruling select that already names the
   * comparison, so repeating it on every chip is ten glyphs of noise. Pool
   * chips have no such control and keep theirs.
   */
  showRuling?: boolean;
}

function TargetChip({
  ruling,
  value,
  onRemove,
  variant = 'target',
  showRuling = true,
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
      pr={onRemove !== undefined ? 1 : 2}
      py={0.5}
      fontFamily="mono"
      fontSize="xs"
    >
      <HStack as="span" gap={gap}>
        {showRuling && <RulingSymbol ruling={ruling} color={accent} />}
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
          h={tapTarget('24px')}
          minW={tapTarget('24px')}

        >
          <X size={12} />
        </IconButton>
      )}
    </HStack>
  );
}
