import { Box, Button, HStack, IconButton, Input, Text, Wrap } from '@chakra-ui/react';
import { Check, Minus, Plus } from 'lucide-react';
import { useCallback, type ReactNode } from 'react';
import { useBufferedValue } from '../../hooks/useBufferedValue';
import { HelpTerm } from '../ui/help-term';
import { Tooltip } from '../ui/tooltip';
import { chipFocusRing, focusRingInset } from './focusRings';

function formatInteger(n: number): string {
  return String(n);
}

interface NumberStepperProps {
  value: number;
  onCommit: (next: number) => void;
  min: number;
  max?: number;
  ariaLabel: string;
  invalid?: boolean;
}

export function NumberStepper({
  value,
  onCommit,
  min,
  max,
  ariaLabel,
  invalid,
}: NumberStepperProps) {
  // Typed input commits through the same [min, max] the +/- buttons respect.
  // Clamping in parse (not in commit) keeps the displayed buffer and the
  // committed value in agreement, and matters more than a UI nicety: the schema
  // validator rejects out-of-range values, and one rejected row drops the whole
  // saved table on the next load. Empty or garbage input lands on the nearest
  // bound of 0, the same trade the pool threshold editor makes.
  const parseClamped = useCallback(
    (raw: string): number => {
      const n = Number.parseInt(raw, 10);
      const parsed = Number.isFinite(n) ? n : 0;
      if (parsed < min) return min;
      if (max !== undefined && parsed > max) return max;
      return parsed;
    },
    [min, max],
  );
  const buf = useBufferedValue<number>({
    committed: value,
    commit: onCommit,
    parse: parseClamped,
    format: formatInteger,
  });
  // The committed value can already sit outside [min, max] when the bounds
  // move under it (a keep-across count after a part shrinks), so a step clamps
  // toward the range instead of refusing: the buttons must always be able to
  // bring the field back, not go dead exactly when it needs repair.
  const step = (delta: number) => {
    let next = value + delta;
    if (next < min) next = min;
    if (max !== undefined && next > max) next = max;
    if (next !== value) onCommit(next);
  };
  return (
    <HStack
      gap={0}
      h="40px"
      w="fit-content"
      align="stretch"
      borderWidth="1px"
      borderColor={invalid ? 'red.solid' : 'border.subtle'}
      borderRadius="md"
      overflow="hidden"
    >
      <IconButton
        aria-label={`Decrease ${ariaLabel}`}
        size="sm"
        variant="ghost"
        color="fg"
        borderRadius="0"
        h="full"
        w="40px"
        disabled={value <= min}
        _disabled={{ opacity: 0.4, color: 'fg.muted', cursor: 'not-allowed' }}
        _focusVisible={focusRingInset}
        onClick={() => step(-1)}
      >
        <Minus size={16} />
      </IconButton>
      <Input
        aria-label={ariaLabel}
        value={buf.value}
        onChange={(e) => buf.setValue(e.target.value)}
        onBlur={buf.onBlur}
        onKeyDown={buf.onKeyDown}
        inputMode="numeric"
        textAlign="center"
        fontFamily="mono"
        h="full"
        w="52px"
        px={0}
        border="none"
        borderRadius="0"
        bg="transparent"
        _focusVisible={focusRingInset}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      />
      <IconButton
        aria-label={`Increase ${ariaLabel}`}
        size="sm"
        variant="ghost"
        color="fg"
        borderRadius="0"
        h="full"
        w="40px"
        disabled={max !== undefined && value >= max}
        _disabled={{ opacity: 0.4, color: 'fg.muted', cursor: 'not-allowed' }}
        _focusVisible={focusRingInset}
        onClick={() => step(1)}
      >
        <Plus size={16} />
      </IconButton>
    </HStack>
  );
}

interface RuleChipProps {
  label: string;
  tip: string;
  active: boolean;
  onToggle: (on: boolean) => void;
  disabled?: boolean;
  disabledTip?: string;
}

// Disabled chips use aria-disabled + data-disabled instead of the native
// attribute: a natively disabled button drops out of the tab order and swallows
// hover, so the "why is this off" tooltip could never be discovered by mouse or
// keyboard. data-disabled applies the recipe's disabled styling and suppresses
// hover feedback without blocking pointer events.
export function RuleChip({
  label,
  tip,
  active,
  onToggle,
  disabled,
  disabledTip,
}: RuleChipProps) {
  return (
    <Tooltip content={disabled ? disabledTip : tip}>
      <Button
        size="sm"
        h="40px"
        px={4}
        borderRadius="full"
        fontWeight="semibold"
        variant={active ? 'subtle' : 'outline'}
        colorPalette={active ? 'blue' : 'gray'}
        aria-pressed={active}
        aria-disabled={disabled || undefined}
        data-disabled={disabled ? '' : undefined}
        _focusVisible={chipFocusRing}
        onClick={() => {
          if (!disabled) onToggle(!active);
        }}
      >
        {active && <Check size={14} />}
        {label}
      </Button>
    </Tooltip>
  );
}

const MAX_PICKER_FACES = 30;

interface FacePickerProps {
  sides: number;
  selected: number[];
  onChange: (next: number[]) => void;
  ariaLabel: string;
}

export function FacePicker({ sides, selected, onChange, ariaLabel }: FacePickerProps) {
  if (!Number.isInteger(sides) || sides < 2) {
    return (
      <Text fontSize="xs" color="fg.muted">
        Set valid sides first.
      </Text>
    );
  }
  if (sides > MAX_PICKER_FACES) {
    return (
      <Text fontSize="xs" color="fg.muted">
        d{sides} has too many faces to list here. Pick a die with {MAX_PICKER_FACES}{' '}
        sides or fewer.
      </Text>
    );
  }
  const faces = Array.from({ length: sides }, (_, i) => i + 1);
  return (
    <Wrap gap={1.5} role="group" aria-label={ariaLabel}>
      {faces.map((face) => {
        const checked = selected.includes(face);
        return (
          <Button
            key={face}
            type="button"
            size="sm"
            h="40px"
            minW="40px"
            px={2}
            fontFamily="mono"
            variant={checked ? 'subtle' : 'outline'}
            colorPalette={checked ? 'blue' : 'gray'}
            aria-pressed={checked}
            aria-label={`Face ${face}`}
            _focusVisible={chipFocusRing}
            onClick={() =>
              onChange(
                checked
                  ? selected.filter((v) => v !== face)
                  : [...selected, face].sort((a, b) => a - b),
              )
            }
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {face}
          </Button>
        );
      })}
    </Wrap>
  );
}

interface PanelProps {
  label: string;
  tip?: string;
  children: ReactNode;
}

// The one home for the editor's panel chrome (bg.panel box under an xs
// uppercase tracked heading), so the sum, check, and keep-across editors cannot
// drift apart visually.
export function Panel({ label, tip, children }: PanelProps) {
  return (
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
        {tip !== undefined && tip.length > 0 ? (
          <HelpTerm tip={tip}>{label}</HelpTerm>
        ) : (
          label
        )}
      </Box>
      {children}
    </Box>
  );
}

interface RuleCardProps {
  heading: string;
  accent?: string;
  children: ReactNode;
}

export function RuleCard({ heading, accent = 'blue.solid', children }: RuleCardProps) {
  return (
    <Box
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="md"
      p={3}
    >
      <HStack gap={2}>
        <Box boxSize="7px" borderRadius="full" bg={accent} flexShrink={0} />
        <Text fontSize="sm" fontWeight="semibold">
          {heading}
        </Text>
      </HStack>
      {children}
    </Box>
  );
}
