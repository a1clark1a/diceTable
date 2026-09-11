import { isTotalsMode } from '../engine/expression';
import type { Expression, RollMode } from '../types';
import { tipForId } from '../docs/glossary';

export interface SegmentedOption {
  value: string;
  label: string;
  // Kept separate from label so an abbreviated chip still announces its full
  // name. The visible text stays a prefix of it, which is what WCAG 2.5.3
  // needs for speech input to reach the chip by what it says.
  ariaLabel: string;
  tip: string;
}

export const ROLL_MODES: readonly (SegmentedOption & { value: RollMode })[] = [
  {
    value: 'normal',
    label: 'Normal',
    ariaLabel: 'Normal',
    tip: tipForId('rollModeNormal'),
  },
  {
    value: 'advantage',
    label: 'Adv',
    ariaLabel: 'Advantage',
    tip: tipForId('rollModeAdvantage'),
  },
  {
    value: 'disadvantage',
    label: 'Dis',
    ariaLabel: 'Disadvantage',
    tip: tipForId('rollModeDisadvantage'),
  },
];

export function isRollMode(value: string): value is RollMode {
  return (
    value === 'normal' || value === 'advantage' || value === 'disadvantage'
  );
}

interface RollModeSummary {
  activeMode: RollMode | null;
  mixed: boolean;
}

// Pool rows ignore rollMode entirely (they count successes), so only rows that
// read it decide "mixed" - sum rows and check rows, where it applies to the
// check roll. An all-pool table falls back to the stored modes so a definite
// chip shows instead of a permanently mixed label.
export function rollModeSummary(expressions: Expression[]): RollModeSummary {
  const sumModes = new Set(
    expressions.filter(isTotalsMode).map((e) => e.rollMode),
  );
  const mixed = sumModes.size > 1;
  const firstSumMode = sumModes.values().next().value ?? null;
  return {
    mixed,
    activeMode: mixed
      ? null
      : firstSumMode ?? expressions[0]?.rollMode ?? null,
  };
}
