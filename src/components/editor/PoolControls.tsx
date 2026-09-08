import { Badge, Button, HStack, Input, Text } from '@chakra-ui/react';
import type { ExpressionMode, SuccessThreshold } from '../../types';
import type { CheckOutcomeChances } from '../../engine/check';
import { formatWholePercent } from '../chart/format';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';
import { useBufferedValue } from '../../hooks/useBufferedValue';
import { chipFocusRing } from './focusRings';

function parseThresholdValue(raw: string): number {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? Math.max(1, n) : 1;
}

function formatThresholdValue(n: number): string {
  return String(n);
}

// tabIndex makes the badge's tooltip reachable by keyboard, same contract as
// HelpTerm. On desktop the badge sits in the Name cell, far from the toggle
// that otherwise explains pool mode.
export function PoolBadge() {
  return (
    <Tooltip content={tipForId('poolMode')}>
      <Badge
        colorPalette="purple"
        variant="surface"
        flexShrink={0}
        tabIndex={0}
        cursor="help"
      >
        Pool
      </Badge>
    </Tooltip>
  );
}

// tabIndex makes the badge's tooltip reachable by keyboard, same contract as
// PoolBadge above.
export function CheckBadge() {
  return (
    <Tooltip content={tipForId('checkMode')}>
      <Badge
        colorPalette="orange"
        variant="surface"
        flexShrink={0}
        tabIndex={0}
        cursor="help"
      >
        Check
      </Badge>
    </Tooltip>
  );
}

// The row already shows what a check rolls; what it cannot show is how often
// that roll lands. Criticals count as successes here, the same way they do at
// the table. Chances arrive from the row-data cache rather than being computed
// here, so a table-wide render costs nothing per chip; null means the odds are
// not computable, and the chip says so instead of claiming a confident 0%.
export function CheckSucceedsChip({
  chances,
}: {
  chances: CheckOutcomeChances | null;
}) {
  if (chances === null) {
    return (
      <Text as="span" fontSize="xs" color="fg.muted">
        (too complex)
      </Text>
    );
  }
  const succeeds = chances.success + chances.crit;
  return (
    <Tooltip content={tipForId('checkSucceeds')}>
      <Badge
        colorPalette="orange"
        variant="surface"
        flexShrink={0}
        tabIndex={0}
        cursor="help"
        fontFamily="mono"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        succeeds {formatWholePercent(succeeds)}
      </Badge>
    </Tooltip>
  );
}

interface ExpressionModeToggleProps {
  mode: ExpressionMode;
  onSelect: (mode: ExpressionMode) => void;
}

const MODE_CHIPS: {
  value: ExpressionMode;
  label: string;
  tip: string;
  palette: string;
}[] = [
  { value: 'sum', label: 'Sum', tip: tipForId('sumMode'), palette: 'blue' },
  { value: 'pool', label: 'Pool', tip: tipForId('poolMode'), palette: 'purple' },
  { value: 'check', label: 'Check', tip: tipForId('checkMode'), palette: 'orange' },
];

export function ExpressionModeToggle({ mode, onSelect }: ExpressionModeToggleProps) {
  return (
    <HStack gap={1} display="inline-flex" role="group" aria-label="Roll style">
      {MODE_CHIPS.map((chip) => {
        const active = mode === chip.value;
        return (
          <Tooltip key={chip.value} content={chip.tip}>
            <Button
              size="xs"
              variant={active ? 'subtle' : 'ghost'}
              colorPalette={active ? chip.palette : 'gray'}
              aria-pressed={active}
              _focusVisible={chipFocusRing}
              onClick={() => onSelect(chip.value)}
            >
              {chip.label}
            </Button>
          </Tooltip>
        );
      })}
    </HStack>
  );
}

interface PoolThresholdEditorProps {
  threshold: SuccessThreshold;
  onChange: (threshold: SuccessThreshold) => void;
}

export function PoolThresholdEditor({
  threshold,
  onChange,
}: PoolThresholdEditorProps) {
  const isGte = threshold.direction === 'gte';
  const buf = useBufferedValue<number>({
    committed: threshold.value,
    commit: (value) => onChange({ ...threshold, value }),
    parse: parseThresholdValue,
    format: formatThresholdValue,
  });
  return (
    <HStack gap={1} align="center">
      <Tooltip content={tipForId('successDirection')}>
        <Button
          size="xs"
          variant="outline"
          fontFamily="mono"
          aria-label={
            isGte
              ? 'Success direction: at or above'
              : 'Success direction: at or below'
          }
          _focusVisible={chipFocusRing}
          onClick={() =>
            onChange({ ...threshold, direction: isGte ? 'lte' : 'gte' })
          }
        >
          {isGte ? '≥' : '≤'}
        </Button>
      </Tooltip>
      <Tooltip content={tipForId('successThreshold')}>
        <Input
          size="xs"
          type="text"
          inputMode="numeric"
          value={buf.value}
          onChange={(e) => buf.setValue(e.target.value)}
          onBlur={buf.onBlur}
          onKeyDown={buf.onKeyDown}
          w="44px"
          textAlign="center"
          fontFamily="mono"
          aria-label="Success threshold"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
      </Tooltip>
    </HStack>
  );
}
