import {
  Box,
  Button,
  CloseButton,
  Dialog,
  HStack,
  Popover,
  Portal,
  Stack,
  Text,
  VisuallyHidden,
  Wrap,
} from '@chakra-ui/react';
import { LayersPlus } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useApp } from '../../state/useApp';
import { STANDARD_DICE } from '../../state/defaultPart';
import {
  MAX_SWEEP_VARIANTS,
  SWEEP_BOUNDS,
  largestSides,
  planSweep,
  rangeValues,
  sameSweepTarget,
  sweepSourceValue,
  sweepTargets,
  sweepValueLabel,
  type SweepPlan,
  type SweepSkipReason,
  type SweepTarget,
} from '../../state/sweep';
import { MAX_EXPRESSIONS, type DicePart, type Expression } from '../../types';
import { useTableFits } from '../../hooks/useBreakpoint';
import { tipForId } from '../../docs/glossary';
import { tapTarget } from '../tapTarget';
import { NumberStepper } from './controls';
import { chipFocusRing } from './focusRings';
import { TapTip } from './TapTip';

interface VariantsControlProps {
  expr: Expression;
  total: number;
}

/**
 * The one way into a sweep. It lives beside Duplicate rather than on every
 * number because the modifier and the pool threshold are not in the editor at
 * all, and the table's Mod and Style columns have no width for an icon.
 */
export function VariantsControl({ expr, total }: VariantsControlProps) {
  const pointerLayout = useTableFits();
  const [open, setOpen] = useState(false);
  const chooserRef = useRef<HTMLButtonElement>(null);
  const room = MAX_EXPRESSIONS - total;
  const sweepable = sweepTargets(expr).length > 0;

  const label = (
    <>
      <LayersPlus size={14} aria-hidden />
      Variants
      <VisuallyHidden> of {expr.name}</VisuallyHidden>
    </>
  );
  const triggerProps = {
    size: 'sm',
    variant: 'outline',
    borderColor: 'border.subtle',
    fontWeight: 'normal',
    gap: 1.5,
    px: 3,
    h: tapTarget('32px'),
  } as const;

  // A blocked trigger stays outside the Popover and Dialog triggers: an
  // aria-disabled trigger would still open its panel.
  if (!sweepable || room <= 0) {
    return (
      <TapTip
        tip={
          sweepable
            ? `Up to ${MAX_EXPRESSIONS} rolls. Delete a row to add another.`
            : tipForId('sweepCheckRow')
        }
      >
        <Button {...triggerProps} aria-disabled data-disabled="">
          {label}
        </Button>
      </TapTip>
    );
  }

  const title = `Variants of ${expr.name}`;
  const form = (
    <SweepForm
      expr={expr}
      room={room}
      chooserRef={chooserRef}
      layout={pointerLayout ? 'popover' : 'sheet'}
      onDone={() => setOpen(false)}
    />
  );

  if (pointerLayout) {
    return (
      <Popover.Root
        open={open}
        onOpenChange={(d) => setOpen(d.open)}
        positioning={{ placement: 'bottom-end' }}
        initialFocusEl={() => chooserRef.current}
        lazyMount
        unmountOnExit
      >
        <Popover.Trigger asChild>
          <Button {...triggerProps}>{label}</Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content w="360px" maxW="calc(100vw - 32px)" aria-label={title}>
              <Popover.Arrow>
                <Popover.ArrowTip />
              </Popover.Arrow>
              <Popover.Body>{form}</Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    );
  }

  // Touch gets the same sheet the target editor uses: the thumb is at the
  // bottom, and a popover off a full-width card has nowhere useful to sit.
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => setOpen(d.open)}
      initialFocusEl={() => chooserRef.current}
      lazyMount
      unmountOnExit
      placement="bottom"
      size="lg"
      motionPreset="slide-in-bottom"
    >
      <Dialog.Trigger asChild>
        <Button {...triggerProps}>{label}</Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxH="80vh" borderTopRadius="lg">
            <Dialog.Header py={3}>
              <Dialog.Title fontSize="sm">{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pb={6}>{form}</Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

type Range = { from: number; to: number; step: number };

function clampTo(kind: SweepTarget['kind'], v: number): number {
  const { min, max } = SWEEP_BOUNDS[kind];
  return Math.min(max, Math.max(min, v));
}

function findPart(expr: Expression, target: SweepTarget): DicePart | undefined {
  return 'partId' in target ? expr.parts.find((p) => p.id === target.partId) : undefined;
}

// Every first open already previews something real: a five-value window
// around the current number, every legal keep, or the dice either side.
function defaultRange(expr: Expression, target: SweepTarget): Range {
  const v = sweepSourceValue(expr, target) ?? 0;
  const window = (lo: number, hi: number): Range => {
    const from = clampTo(target.kind, Math.max(lo, v - 2));
    return { from, to: clampTo(target.kind, Math.min(hi, from + 4)), step: 1 };
  };
  switch (target.kind) {
    case 'keepN':
      return { from: 1, to: findPart(expr, target)?.count ?? 1, step: 1 };
    case 'poolThreshold':
      return window(1, largestSides(expr));
    case 'count':
      return window(1, Infinity);
    case 'modifier':
      return { from: v - 2, to: v + 2, step: 1 };
    case 'sides':
      return { from: v, to: v, step: 1 };
  }
}

function neighbourDice(sides: number): number[] {
  const below = STANDARD_DICE.filter((d) => d < sides).at(-1);
  const above = STANDARD_DICE.find((d) => d > sides);
  return [below, above].filter((d): d is number => d !== undefined);
}

function defaultTarget(expr: Expression, targets: SweepTarget[]): SweepTarget | undefined {
  if (expr.mode === 'pool') {
    return targets.find((t) => t.kind === 'poolThreshold') ?? targets[0];
  }
  return targets.find((t) => t.kind === 'sides') ?? targets[0];
}

function targetKey(target: SweepTarget): string {
  return 'partId' in target ? `${target.kind}:${target.partId}` : target.kind;
}

/** Plain words for the chooser and the skip lines; row names keep the notation. */
function plainToken(expr: Expression, target: SweepTarget, value: number): string {
  return target.kind === 'keepN' ? `keep ${value}` : sweepValueLabel(expr, target, value);
}

function chipWord(expr: Expression, target: SweepTarget): string {
  switch (target.kind) {
    case 'count':
      return 'Count';
    case 'sides':
      return 'Die';
    case 'keepN':
      return 'Keep';
    case 'modifier':
      return expr.mode === 'pool' ? 'Auto-successes' : 'Modifier';
    case 'poolThreshold':
      return 'Success';
  }
}

function chipValue(expr: Expression, target: SweepTarget): string {
  const v = sweepSourceValue(expr, target) ?? 0;
  if (target.kind === 'count') return String(v);
  if (target.kind === 'keepN') return `${v} of ${findPart(expr, target)?.count ?? v}`;
  if (target.kind === 'modifier') return v < 0 ? `−${Math.abs(v)}` : `+${v}`;
  return sweepValueLabel(expr, target, v);
}

function listTokens(tokens: string[]): string {
  if (tokens.length <= 4) return tokens.join(', ');
  return `${tokens.slice(0, 3).join(', ')} and ${tokens.length - 3} more`;
}

// Fixed order, so the lines never trade places while the user adjusts a range.
const SKIP_ORDER: readonly SweepSkipReason[] = [
  'source',
  'keepOverCount',
  'thresholdOffDie',
  'endless',
  'invalid',
  'tooComplex',
  'overLimit',
  'noRoom',
];

function skipSentence(
  reason: SweepSkipReason,
  target: SweepTarget,
  list: string,
  shown: number,
): string {
  switch (reason) {
    case 'source':
      return `Skips ${list}: that is this roll.`;
    case 'keepOverCount':
      return target.kind === 'keepN'
        ? `Skips ${list}: you can’t keep more dice than you roll.`
        : `Skips ${list}: fewer dice than this roll keeps.`;
    case 'thresholdOffDie':
      return target.kind === 'poolThreshold'
        ? `Skips ${list}: no face on these dice reaches it.`
        : `Skips ${list}: its faces never reach the success number.`;
    case 'endless':
      return `Skips ${list}: every face would explode, so it would never stop.`;
    case 'invalid':
      return `Skips ${list}: that roll can’t be built.`;
    case 'tooComplex':
      return `Skips ${list}: too many dice to work out.`;
    case 'overLimit':
      return `Skips ${list}: up to ${MAX_SWEEP_VARIANTS} at a time.`;
    case 'noRoom':
      return `Only ${shown} fit. The table holds up to ${MAX_EXPRESSIONS} rolls.`;
  }
}

interface SweepFormProps {
  expr: Expression;
  room: number;
  chooserRef: RefObject<HTMLButtonElement | null>;
  layout: 'popover' | 'sheet';
  onDone: () => void;
}

function SweepForm({ expr, room, chooserRef, layout, onDone }: SweepFormProps) {
  const { sweepExpression } = useApp();
  const targets = sweepTargets(expr);
  const [picked, setPicked] = useState<SweepTarget | undefined>(() =>
    defaultTarget(expr, targets),
  );
  // A picked part can be removed while the panel is open; fall back rather
  // than plan against a target the row no longer has.
  const target =
    picked !== undefined && targets.some((t) => sameSweepTarget(t, picked))
      ? picked
      : defaultTarget(expr, targets);
  const [range, setRange] = useState<Range>(() =>
    target ? defaultRange(expr, target) : { from: 0, to: 0, step: 1 },
  );
  const [dice, setDice] = useState<number[]>(() => {
    const part = target ? findPart(expr, target) : undefined;
    return part ? neighbourDice(part.sides) : [];
  });
  const confirmRef = useRef<HTMLButtonElement>(null);

  const values = useMemo(() => {
    if (target === undefined) return [];
    if (target.kind === 'sides') return [...dice].sort((a, b) => a - b);
    return rangeValues(range.from, range.to, range.step);
  }, [target, dice, range]);

  const plan: SweepPlan = useMemo(
    () => (target ? planSweep(expr, target, values, room) : { variants: [], skipped: [] }),
    [expr, target, values, room],
  );

  if (target === undefined) return null;

  const pick = (next: SweepTarget) => {
    if (sameSweepTarget(next, target)) return;
    setPicked(next);
    setRange(defaultRange(expr, next));
    const part = findPart(expr, next);
    setDice(part ? neighbourDice(part.sides) : []);
  };

  const adds = plan.variants.length;
  const word = chipWord(expr, target);
  const sourceDie = findPart(expr, target)?.sides;
  const cleared = plan.variants.filter((v) => v.clearedFaces);
  const skipLines = SKIP_ORDER.flatMap((reason) => {
    const hits = plan.skipped.filter((s) => s.reason === reason);
    if (hits.length === 0) return [];
    const list = listTokens(hits.map((s) => plainToken(expr, target, s.value)));
    return [skipSentence(reason, target, list, adds)];
  });
  const skippedCount = plan.skipped.filter((s) => s.reason !== 'source').length;

  const confirm = () => {
    if (adds === 0) return;
    sweepExpression(expr.id, target, values);
    onDone();
  };

  // One chip group per part, so two parts' Count chips can't be confused.
  const groups: { key: string; heading: string | null; targets: SweepTarget[] }[] = [];
  const multiPart = expr.parts.length > 1;
  expr.parts.forEach((part, i) => {
    const own = targets.filter((t) => 'partId' in t && t.partId === part.id);
    if (own.length > 0) {
      groups.push({
        key: part.id,
        heading: multiPart ? `Part ${i + 1} · ${part.count}d${part.sides}` : null,
        targets: own,
      });
    }
  });
  const rowWide = targets.filter((t) => !('partId' in t));
  if (rowWide.length > 0) {
    groups.push({ key: 'row', heading: multiPart ? 'Whole roll' : null, targets: rowWide });
  }

  return (
    <Stack gap={4}>
      <Text fontSize="xs" color="fg.muted">
        One new roll per value, added just below this one.
      </Text>

      <Stack gap={2} role="group" aria-label="Value to vary">
        <SectionLabel>Vary</SectionLabel>
        {groups.map((group) => (
          <Stack key={group.key} gap={1}>
            {group.heading !== null && (
              <Text fontSize="2xs" fontFamily="mono" color="fg.muted">
                {group.heading}
              </Text>
            )}
            <Wrap gap={1.5}>
              {group.targets.map((t) => {
                const active = sameSweepTarget(t, target);
                const partIndex =
                  'partId' in t ? expr.parts.findIndex((p) => p.id === t.partId) : -1;
                return (
                  <Button
                    key={targetKey(t)}
                    ref={active ? chooserRef : undefined}
                    size="sm"
                    h={tapTarget('32px')}
                    gap={1.5}
                    variant={active ? 'subtle' : 'outline'}
                    colorPalette={active ? 'blue' : 'gray'}
                    fontWeight="normal"
                    aria-pressed={active}
                    aria-label={`${chipWord(expr, t)}${
                      multiPart && partIndex >= 0 ? ` of part ${partIndex + 1}` : ''
                    }, now ${chipValue(expr, t)}`}
                    _focusVisible={chipFocusRing}
                    onClick={() => pick(t)}
                  >
                    {chipWord(expr, t)}
                    <Text
                      as="span"
                      fontFamily="mono"
                      color={active ? undefined : 'fg.muted'}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {chipValue(expr, t)}
                    </Text>
                  </Button>
                );
              })}
            </Wrap>
          </Stack>
        ))}
      </Stack>

      {target.kind === 'sides' ? (
        <Stack gap={2}>
          <SectionLabel>Try these dice</SectionLabel>
          <Wrap gap={2} role="group" aria-label="Dice to try">
            {STANDARD_DICE.map((d) => {
              const isSource = d === sourceDie;
              const on = isSource || dice.includes(d);
              const chip = (
                <Button
                  key={d}
                  size="sm"
                  h="40px"
                  minW="52px"
                  fontFamily="mono"
                  variant={on ? 'subtle' : 'outline'}
                  colorPalette={on ? 'blue' : 'gray'}
                  aria-pressed={on}
                  aria-disabled={isSource || undefined}
                  data-disabled={isSource ? '' : undefined}
                  aria-label={isSource ? `d${d}, this roll’s die` : `d${d}`}
                  _focusVisible={chipFocusRing}
                  onClick={() => {
                    if (isSource) return;
                    setDice((prev) =>
                      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                    );
                  }}
                >
                  d{d}
                </Button>
              );
              return isSource ? (
                <TapTip key={d} tip={tipForId('sweepSourceDie')}>
                  {chip}
                </TapTip>
              ) : (
                chip
              );
            })}
          </Wrap>
        </Stack>
      ) : (
        <Wrap gap={3} align="flex-end">
          <RangeStepper
            label="From"
            ariaLabel={`${word} from`}
            value={range.from}
            kind={target.kind}
            onCommit={(from) => setRange((r) => ({ ...r, from }))}
            onEnter={() => confirmRef.current?.focus()}
          />
          <RangeStepper
            label="To"
            ariaLabel={`${word} to`}
            value={range.to}
            kind={target.kind}
            onCommit={(to) => setRange((r) => ({ ...r, to }))}
            onEnter={() => confirmRef.current?.focus()}
          />
          <RangeStepper
            label="Go up by"
            ariaLabel={`${word} step`}
            value={range.step}
            min={1}
            max={99}
            onCommit={(step) => setRange((r) => ({ ...r, step }))}
            onEnter={() => confirmRef.current?.focus()}
          />
        </Wrap>
      )}

      <Box bg="bg.subtle" borderRadius="md" px={3} py={2.5}>
        <Text fontSize="sm" fontWeight="semibold">
          {adds === 0 ? 'Nothing to add yet' : adds === 1 ? 'Adds 1 roll' : `Adds ${adds} rolls`}
        </Text>
        {adds > 0 && (
          <Wrap gap={2} mt={1}>
            {plan.variants.map((v) => (
              <Text
                key={v.value}
                as="span"
                fontFamily="mono"
                fontSize="sm"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {sweepValueLabel(expr, target, v.value)}
              </Text>
            ))}
          </Wrap>
        )}
        {(skipLines.length > 0 || cleared.length > 0) && (
          <Stack gap={0.5} mt={2}>
            {skipLines.map((line) => (
              <Text key={line} fontSize="xs" color="fg.muted">
                {line}
              </Text>
            ))}
            {cleared.length > 0 && (
              <Text fontSize="xs" color="fg.muted">
                {listTokens(cleared.map((v) => sweepValueLabel(expr, target, v.value)))}: reroll
                or explode faces that die doesn’t have are cleared.
              </Text>
            )}
          </Stack>
        )}
        {/* The visible list re-renders on every press; a screen reader hears
            only the count, not every token and every skip line again. */}
        <VisuallyHidden role="status">
          {adds === 1 ? 'Adds 1 roll.' : `Adds ${adds} rolls.`}
          {skippedCount > 0 ? ` Skips ${skippedCount}.` : ''}
        </VisuallyHidden>
      </Box>

      <HStack justify="flex-end" gap={2}>
        <Button
          size="sm"
          variant="ghost"
          h={tapTarget('32px')}
          flex={layout === 'sheet' ? '1' : undefined}
          onClick={onDone}
        >
          Cancel
        </Button>
        {/* Fixed width, so the label counting up from "Add 1 roll" to "Add 8
            rolls" never resizes the button under the pointer. */}
        <Button
          ref={confirmRef}
          size="sm"
          colorPalette="blue"
          h={tapTarget('32px')}
          minW={layout === 'sheet' ? undefined : '8.5rem'}
          flex={layout === 'sheet' ? '1' : undefined}
          aria-disabled={adds === 0 || undefined}
          data-disabled={adds === 0 ? '' : undefined}
          onClick={confirm}
        >
          {adds === 0 ? 'Add rolls' : adds === 1 ? 'Add 1 roll' : `Add ${adds} rolls`}
        </Button>
      </HStack>
    </Stack>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="fg.muted"
      textTransform="uppercase"
      letterSpacing="wider"
    >
      {children}
    </Text>
  );
}

interface RangeStepperProps {
  label: string;
  ariaLabel: string;
  value: number;
  kind?: SweepTarget['kind'];
  min?: number;
  max?: number;
  onCommit: (value: number) => void;
  onEnter: () => void;
}

function RangeStepper({
  label,
  ariaLabel,
  value,
  kind,
  min,
  max,
  onCommit,
  onEnter,
}: RangeStepperProps) {
  const bounds = kind !== undefined ? SWEEP_BOUNDS[kind] : undefined;
  return (
    <Stack gap={1}>
      <Text fontSize="xs" color="fg.muted">
        {label}
      </Text>
      <NumberStepper
        value={value}
        onCommit={onCommit}
        min={min ?? bounds?.min ?? 0}
        max={max ?? bounds?.max ?? 0}
        ariaLabel={ariaLabel}
        onEnter={onEnter}
      />
    </Stack>
  );
}
