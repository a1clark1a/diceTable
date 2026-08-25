import type { Expression } from '../types';
import { expressionDistribution } from '../engine/expression';
import { computeRowStats, type RowStats } from '../state/rowStats';

export interface StarterPreset {
  expr: Expression;
  dice: string;
  why: string;
  stats: RowStats;
}

// The ids are placeholders: addExpressions re-ids every roll on insert, so the
// same preset can be added twice without colliding. Stats are computed once at
// module scope with the real engine so the cards promise exactly what the
// table will show (max complexity here is 4d6kh3 at 126, far below any guard).
function preset(expr: Expression, dice: string, why: string): StarterPreset {
  return { expr, dice, why, stats: computeRowStats(expressionDistribution(expr)) };
}

export const STARTER_PRESETS: readonly StarterPreset[] = [
  preset(
    {
      id: 'preset-weapon',
      name: 'Weapon attack',
      parts: [{ id: 'preset-weapon-p1', count: 1, sides: 8 }],
      flatModifier: 2,
      rollMode: 'normal',
      mode: 'sum',
    },
    '1d8 + 2',
    'One die plus a flat bonus. The everyday attack roll.',
  ),
  preset(
    {
      id: 'preset-twohander',
      name: 'Two-hander',
      parts: [{ id: 'preset-twohander-p1', count: 2, sides: 6 }],
      flatModifier: 3,
      rollMode: 'normal',
      mode: 'sum',
    },
    '2d6 + 3',
    'More dice, same ballpark average, far fewer extreme results.',
  ),
  preset(
    {
      id: 'preset-mixed',
      name: 'Mixed dice',
      parts: [
        { id: 'preset-mixed-p1', count: 2, sides: 6 },
        { id: 'preset-mixed-p2', count: 1, sides: 4 },
      ],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'sum',
    },
    '2d6 + 1d4',
    'Two different die sizes in one roll. Shows a multi-part expression.',
  ),
  preset(
    {
      id: 'preset-ability',
      name: 'Ability score',
      parts: [
        {
          id: 'preset-ability-p1',
          count: 4,
          sides: 6,
          keep: { type: 'highest', n: 3 },
        },
      ],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'sum',
    },
    '4d6kh3',
    'Roll four, keep the best three. Shows the keep-highest rule.',
  ),
  preset(
    {
      id: 'preset-save',
      name: 'Save DC check',
      parts: [{ id: 'preset-save-p1', count: 1, sides: 20 }],
      flatModifier: 5,
      rollMode: 'normal',
      mode: 'sum',
    },
    '1d20 + 5',
    'A flat d20 against a fixed number. Every total is equally likely.',
  ),
  preset(
    {
      id: 'preset-adv',
      name: 'Check with advantage',
      parts: [{ id: 'preset-adv-p1', count: 1, sides: 20 }],
      flatModifier: 5,
      rollMode: 'advantage',
      mode: 'sum',
    },
    '1d20 + 5 adv',
    'Rolls twice and keeps the higher. Put it next to the plain d20 to see what advantage is worth.',
  ),
  preset(
    {
      id: 'preset-pool',
      name: 'Success pool',
      parts: [{ id: 'preset-pool-p1', count: 7, sides: 10 }],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 8 },
    },
    '7d10, count ≥ 8',
    'Counts dice that beat a threshold instead of adding faces. Uses the pool row mode.',
  ),
  preset(
    {
      id: 'preset-keepbest',
      name: 'Keep the best die',
      parts: [
        {
          id: 'preset-keepbest-p1',
          count: 2,
          sides: 6,
          keep: { type: 'highest', n: 1 },
        },
      ],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'sum',
    },
    '2d6kh1',
    'Two dice, only the higher one counts. Common in paired-dice systems.',
  ),
];
