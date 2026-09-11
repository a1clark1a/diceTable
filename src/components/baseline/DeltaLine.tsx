import { Box, HStack, Text } from '@chakra-ui/react';
import { HelpTerm } from '../ui/help-term';
import {
  deltaTone,
  formatPercentDelta,
  type DeltaTone,
} from '../chart/format';
import { HIT_DELTA_EPS } from './comparison';
import { deltaToneColor, hitDeltaAria } from './deltaText';

/** Header sub-label and row value share this, or the columns drift apart. */
export const DELTA_SLOT = '54px';

interface DeltaBarProps {
  delta: number;
  /** Shared column maximum; bar lengths are proportional to it across rows. */
  maxDelta: number;
  tone: DeltaTone;
  fill: string;
}

// A 52px track with a center tick: positive deltas grow right, negative grow
// left, so direction reads at a glance before the number does.
function DeltaBar({ delta, maxDelta, tone, fill }: DeltaBarProps) {
  const showFill = tone !== 'same' && maxDelta > 0;
  // Half the track sits either side of the tick; the 5% floor keeps the
  // smallest visible delta from collapsing into the tick itself.
  const widthPct = showFill
    ? Math.max(5, (Math.abs(delta) / maxDelta) * 50)
    : 0;
  return (
    <Box
      as="span"
      display="inline-block"
      position="relative"
      w="52px"
      h="6px"
      bg="bg.muted"
      borderRadius="full"
      overflow="hidden"
      flexShrink={0}
    >
      <Box as="span" position="absolute" top="0" bottom="0" left="50%" w="1px" bg="border" />
      {showFill && (
        <Box
          as="span"
          position="absolute"
          top="0"
          bottom="0"
          borderRadius="full"
          bg={fill}
          width={`${widthPct}%`}
          {...(delta > 0 ? { left: '50%' } : { right: '50%' })}
        />
      )}
    </Box>
  );
}

/** A signed Hit % point delta with its own tone-colored bar. */
export function HitDeltaValue({
  delta,
  maxDelta,
}: {
  delta: number;
  maxDelta: number;
}) {
  const tone = deltaTone(delta, HIT_DELTA_EPS);
  return (
    <HStack as="span" gap={1}>
      <DeltaBar
        delta={delta}
        maxDelta={maxDelta}
        tone={tone}
        fill={deltaToneColor(tone)}
      />
      {/* Fixed column so stacked Hit % deltas line up under each other; a
          shorter delta would otherwise pull its whole line right. */}
      <Text
        as="span"
        fontSize="xs"
        color={deltaToneColor(tone)}
        aria-label={hitDeltaAria(delta, tone)}
        display="inline-block"
        minW="52px"
        textAlign="end"
      >
        {formatPercentDelta(delta)}
      </Text>
    </HStack>
  );
}

interface DeltaValueProps {
  tip: string;
  text: string;
  ariaLabel: string;
  tone: DeltaTone;
  /** Spread has no good or bad direction, so it stays neutral. */
  neutral?: boolean;
}

/**
 * One delta under its AVG or SPREAD header slot. The slot width is what lines
 * the two columns up now that the labels live in the header, so it has to match
 * the header's.
 */
export function DeltaValue({
  tip,
  text,
  ariaLabel,
  tone,
  neutral = false,
}: DeltaValueProps) {
  return (
    <HelpTerm tip={tip}>
      <Text
        as="span"
        fontSize="xs"
        color={neutral ? 'fg.muted' : deltaToneColor(tone)}
        aria-label={ariaLabel}
        display="inline-block"
        minW={DELTA_SLOT}
        textAlign="end"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {text}
      </Text>
    </HelpTerm>
  );
}
