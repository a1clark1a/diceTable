import { Text } from '@chakra-ui/react';
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

// The mean column has to hold both states without resizing, and the delta pair
// is the wider of the two: two slots, the gap between them, and the cell's own
// padding. Pinned here rather than left to content, because content-sizing is
// what made pinning a baseline reflow the whole table.
export const STAT_COLUMN = '140px';

/**
 * A signed Hit % point delta. Deliberately the same width as the raw percent it
 * replaces, so pinning a baseline cannot resize the Hit % column. Direction is
 * carried by the tone colour and the sign.
 */
export function HitDeltaValue({ delta }: { delta: number }) {
  const tone = deltaTone(delta, HIT_DELTA_EPS);
  return (
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
