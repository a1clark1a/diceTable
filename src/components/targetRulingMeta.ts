import type { TargetRuling } from '../types';

interface RulingMeta {
  value: TargetRuling;
  symbol: string;
  /** Symbol + short word, used inside the toolbar dropdown options. */
  shortLabel: string;
  /** Plain-language tooltip explaining how the comparison rules a hit. */
  tip: string;
  /** How the wider hobby names this ruling, shown in the glossary map. */
  communityTerm?: string;
  /** Muted context shown in the glossary when there is no community name. */
  communityNote?: string;
}

export const RULING_OPTIONS: readonly RulingMeta[] = [
  {
    value: 'gte',
    symbol: '≥',
    shortLabel: '≥ at least',
    tip: 'At least: a roll equal to or above the target counts as a hit. Games like D&D call this roll over, or meet or beat.',
    communityTerm: 'roll over, or "meet or beat" (D&D, Pathfinder)',
  },
  {
    value: 'gt',
    symbol: '>',
    shortLabel: '> greater than',
    tip: 'Greater than: strictly above the target; an equal roll does not count.',
    communityNote: 'the strict roll over',
  },
  {
    value: 'lte',
    symbol: '≤',
    shortLabel: '≤ at most',
    tip: 'At most: a roll equal to or below the target counts as a hit. Games like Call of Cthulhu call this roll under.',
    communityTerm: 'roll under (Call of Cthulhu, GURPS)',
  },
  {
    value: 'lt',
    symbol: '<',
    shortLabel: '< less than',
    tip: 'Less than: strictly below the target; an equal roll does not count.',
    communityNote: 'the strict roll under',
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
