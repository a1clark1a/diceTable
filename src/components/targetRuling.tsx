import { Box, type BoxProps } from '@chakra-ui/react';
import type { TargetRuling } from '../types';
import { Tooltip } from './ui/tooltip';

interface RulingMeta {
  value: TargetRuling;
  symbol: string;
  /** Symbol + short word, used inside the toolbar dropdown options. */
  shortLabel: string;
  /** Plain-language tooltip explaining how the comparison rules a hit. */
  tip: string;
}

export const RULING_OPTIONS: readonly RulingMeta[] = [
  {
    value: 'gte',
    symbol: '≥',
    shortLabel: '≥ at least',
    tip: 'At least: a roll equal to or above the target counts as a hit.',
  },
  {
    value: 'gt',
    symbol: '>',
    shortLabel: '> greater than',
    tip: 'Greater than: strictly above the target; an equal roll does not count.',
  },
  {
    value: 'lte',
    symbol: '≤',
    shortLabel: '≤ at most',
    tip: 'At most: a roll equal to or below the target counts as a hit.',
  },
  {
    value: 'lt',
    symbol: '<',
    shortLabel: '< less than',
    tip: 'Less than: strictly below the target; an equal roll does not count.',
  },
  {
    value: 'eq',
    symbol: '=',
    shortLabel: '= exactly',
    tip: 'Exactly: only a roll matching the target counts as a hit.',
  },
];

const byRuling = <T,>(pick: (m: RulingMeta) => T): Record<TargetRuling, T> => {
  return RULING_OPTIONS.reduce(
    (acc, m) => {
      acc[m.value] = pick(m);
      return acc;
    },
    {} as Record<TargetRuling, T>,
  );
};

export const RULING_SYMBOL: Record<TargetRuling, string> = byRuling((m) => m.symbol);
export const RULING_TIP: Record<TargetRuling, string> = byRuling((m) => m.tip);

export function isTargetRuling(value: string): value is TargetRuling {
  return RULING_OPTIONS.some((m) => m.value === value);
}

export interface RulingSymbolProps extends Omit<BoxProps, 'children'> {
  ruling: TargetRuling;
}

export function RulingSymbol({ ruling, ...rest }: RulingSymbolProps) {
  return (
    <Tooltip content={RULING_TIP[ruling]}>
      <Box as="span" tabIndex={0} cursor="help" outline="none" {...rest}>
        {RULING_SYMBOL[ruling]}
      </Box>
    </Tooltip>
  );
}
