import { Box, HStack, Text } from '@chakra-ui/react';
import { HelpTerm } from '../ui/help-term';
import {
  deltaTone,
  formatPercentDelta,
  type DeltaTone,
} from '../chart/format';
import { HIT_DELTA_EPS } from './comparison';
import { deltaToneColor, hitDeltaAria } from './deltaText';

/** A signed Hit % point delta, toned good/bad/neutral against the baseline. */
export function HitDeltaValue({ delta }: { delta: number }) {
  const tone = deltaTone(delta, HIT_DELTA_EPS);
  return (
    <Text
      as="span"
      fontSize="xs"
      color={deltaToneColor(tone)}
      aria-label={hitDeltaAria(delta, tone)}
    >
      {formatPercentDelta(delta)}
    </Text>
  );
}

interface DeltaLineProps {
  label: string;
  tip: string;
  text: string;
  ariaLabel: string;
  delta: number;
  /** Shared column maximum; bar lengths are proportional to it across rows. */
  maxDelta: number;
  tone: DeltaTone;
  /** Spread has no good or bad direction, so its bar stays neutral. */
  neutralBar?: boolean;
  justify?: 'flex-end' | 'center';
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
  justify = 'flex-end',
}: DeltaLineProps) {
  const showBar = tone !== 'same' && maxDelta > 0;
  // Half the 52px track sits either side of the center tick; 5% keeps the
  // smallest visible delta from collapsing into the tick itself.
  const widthPct = showBar
    ? Math.max(5, (Math.abs(delta) / maxDelta) * 50)
    : 0;
  const fill = neutralBar ? 'fg.muted' : deltaToneColor(tone);
  return (
    <HStack gap={1} justify={justify}>
      <HelpTerm tip={tip}>
        <Text as="span" fontSize="xs" color="fg.muted" fontFamily="body">
          {label}
        </Text>
      </HelpTerm>
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
        {showBar && (
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
