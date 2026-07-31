import { Badge, Button, HStack, Input } from '@chakra-ui/react';
import type { ExpressionMode, SuccessThreshold } from '../../types';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';
import { useBufferedValue } from '../../hooks/useBufferedValue';

function parseThresholdValue(raw: string): number {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? Math.max(1, n) : 1;
}

function formatThresholdValue(n: number): string {
  return String(n);
}

// Same rationale as DicePartRow's chipFocusRing: chips track colorPalette, so
// the focus ring would read blue on Sum, purple on Pool, gray when inactive.
// Pin it to blue so the keyboard cue is identical across every chip state.
const chipFocusRing = {
  outlineWidth: '2px',
  outlineStyle: 'solid',
  outlineColor: 'blue.solid',
  outlineOffset: '2px',
};

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

interface PoolModeToggleProps {
  mode: ExpressionMode;
  onSelect: (mode: ExpressionMode) => void;
}

export function PoolModeToggle({ mode, onSelect }: PoolModeToggleProps) {
  const isPool = mode === 'pool';
  return (
    <HStack gap={1} display="inline-flex" role="group" aria-label="Sum or pool">
      <Tooltip content={tipForId('sumMode')}>
        <Button
          size="xs"
          variant={isPool ? 'ghost' : 'subtle'}
          colorPalette={isPool ? 'gray' : 'blue'}
          aria-pressed={!isPool}
          _focusVisible={chipFocusRing}
          onClick={() => onSelect('sum')}
        >
          Sum
        </Button>
      </Tooltip>
      <Tooltip content={tipForId('poolMode')}>
        <Button
          size="xs"
          variant={isPool ? 'subtle' : 'ghost'}
          colorPalette={isPool ? 'purple' : 'gray'}
          aria-pressed={isPool}
          _focusVisible={chipFocusRing}
          onClick={() => onSelect('pool')}
        >
          Pool
        </Button>
      </Tooltip>
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
