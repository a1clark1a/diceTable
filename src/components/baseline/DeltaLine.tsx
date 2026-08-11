import { Box, HStack, Text } from '@chakra-ui/react';
import { HelpTerm } from '../ui/help-term';
import {
  deltaTone,
  formatPercentDelta,
  type DeltaTone,
} from '../chart/format';
import { HIT_DELTA_EPS } from './comparison';
import { deltaToneColor, hitDeltaAria } from './deltaText';

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
      <Text
        as="span"
        fontSize="xs"
        color={deltaToneColor(tone)}
        aria-label={hitDeltaAria(delta, tone)}
      >
        {formatPercentDelta(delta)}
      </Text>
    </HStack>
  );
}

interface DeltaLineProps {
  label: string;
  tip: string;
  text: string;
  ariaLabel: string;
  delta: number;
  maxDelta: number;
  tone: DeltaTone;
  /** Spread has no good or bad direction, so its bar stays neutral. */
  neutralBar?: boolean;
}

export function DeltaLine({
  label,
  tip,
  text,
  ariaLabel,
  delta,
  maxDelta,
  tone,
  neutralBar = false,
}: DeltaLineProps) {
  return (
    <HStack gap={1}>
      <HelpTerm tip={tip}>
        {/* Fixed label column keeps the avg and spread bars vertically
            aligned; without it the longer "spread" label pushes its bar. */}
        <Text
          as="span"
          fontSize="xs"
          color="fg.muted"
          fontFamily="body"
          display="inline-block"
          minW="42px"
          textAlign="end"
        >
          {label}
        </Text>
      </HelpTerm>
      <DeltaBar
        delta={delta}
        maxDelta={maxDelta}
        tone={tone}
        fill={neutralBar ? 'fg.muted' : deltaToneColor(tone)}
      />
      <Text
        as="span"
        fontSize="xs"
        color="fg.muted"
        aria-label={ariaLabel}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {text}
      </Text>
    </HStack>
  );
}
