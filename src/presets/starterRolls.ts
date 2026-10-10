import type { Expression } from '../types';

/** The kind of question a recipe answers, which is what the library's filter chips group by. */
export type RecipeFamily =
  | 'totals'
  | 'successes'
  | 'advantage'
  | 'opposed'
  | 'margin';

export interface StarterPreset {
  /** Stable across releases: a future recipe route and its links are keyed by it. */
  slug: string;
  /** Mechanic first. Game names belong in `alsoCalled`, where search finds them. */
  name: string;
  alsoCalled: readonly string[];
  family: RecipeFamily;
  dice: string;
  why: string;
  /** Every row the recipe adds, in table order. Most recipes add one. */
  rows: readonly Expression[];
}

interface PresetFields {
  slug: string;
  name?: string;
  alsoCalled?: readonly string[];
  family: RecipeFamily;
  dice: string;
  why: string;
}

// Stats are deliberately not part of a preset. Cards read them through the
// table's own per-row cache when they render, so a card promises exactly what
// the row will show, and importing the library computes nothing: the dialog's
// lazy mount is what pays for the distributions.
//
// Row ids are placeholders: addExpressions re-ids every roll on insert, so the
// same preset can be added twice without colliding.
export function preset(
  fields: PresetFields,
  rows: readonly [Expression, ...Expression[]],
): StarterPreset {
  return {
    slug: fields.slug,
    name: fields.name ?? rows[0].name,
    alsoCalled: fields.alsoCalled ?? [],
    family: fields.family,
    dice: fields.dice,
    why: fields.why,
    rows,
  };
}

export const STARTER_PRESETS: readonly StarterPreset[] = [
  preset(
    {
      slug: 'weapon-attack',
      family: 'totals',
      alsoCalled: ['Damage roll', 'Longsword damage'],
      dice: '1d8 + 2',
      why: 'One die plus a flat bonus. The everyday attack roll.',
    },
    [
      {
        id: 'preset-weapon',
        name: 'Weapon attack',
        parts: [{ id: 'preset-weapon-p1', count: 1, sides: 8 }],
        flatModifier: 2,
        rollMode: 'normal',
        mode: 'sum',
      },
    ],
  ),
  preset(
    {
      slug: 'two-hander',
      family: 'totals',
      alsoCalled: ['Greatsword damage'],
      dice: '2d6 + 3',
      why: 'More dice, same ballpark average, far fewer extreme results.',
    },
    [
      {
        id: 'preset-twohander',
        name: 'Two-hander',
        parts: [{ id: 'preset-twohander-p1', count: 2, sides: 6 }],
        flatModifier: 3,
        rollMode: 'normal',
        mode: 'sum',
      },
    ],
  ),
  preset(
    {
      slug: 'mixed-dice',
      family: 'totals',
      dice: '2d6 + 1d4',
      why: 'Two different die sizes in one roll. Shows a multi-part expression.',
    },
    [
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
    ],
  ),
  preset(
    {
      slug: 'ability-score',
      family: 'advantage',
      alsoCalled: ['4d6 drop lowest', 'Rolling stats', 'D&D ability scores'],
      dice: '4d6kh3',
      why: 'Roll four, keep the best three. Shows the keep-highest rule.',
    },
    [
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
    ],
  ),
  preset(
    {
      slug: 'save-dc-check',
      family: 'margin',
      alsoCalled: ['Saving throw', 'Skill check', 'Ability check'],
      dice: '1d20 + 5',
      why: 'A flat d20 against a fixed number. Every total is equally likely.',
    },
    [
      {
        id: 'preset-save',
        name: 'Save DC check',
        parts: [{ id: 'preset-save-p1', count: 1, sides: 20 }],
        flatModifier: 5,
        rollMode: 'normal',
        mode: 'sum',
      },
    ],
  ),
  preset(
    {
      slug: 'check-with-advantage',
      family: 'advantage',
      alsoCalled: ['Advantage', 'Roll twice, keep the higher'],
      dice: '1d20 + 5 adv',
      why: 'Rolls twice and keeps the higher. Put it next to the plain d20 to see what advantage is worth.',
    },
    [
      {
        id: 'preset-adv',
        name: 'Check with advantage',
        parts: [{ id: 'preset-adv-p1', count: 1, sides: 20 }],
        flatModifier: 5,
        rollMode: 'advantage',
        mode: 'sum',
      },
    ],
  ),
  preset(
    {
      slug: 'success-pool',
      family: 'successes',
      alsoCalled: ['Dice pool', 'Counting successes'],
      dice: '7d10, count ≥ 8',
      why: 'Counts dice that reach a target number (8 or more) instead of adding faces. Uses the pool row mode.',
    },
    [
      {
        id: 'preset-pool',
        name: 'Success pool',
        parts: [{ id: 'preset-pool-p1', count: 7, sides: 10 }],
        flatModifier: 0,
        rollMode: 'normal',
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 8 },
      },
    ],
  ),
  preset(
    {
      slug: 'keep-the-best-die',
      family: 'advantage',
      alsoCalled: ['Best of two'],
      dice: '2d6kh1',
      why: 'Two dice, only the higher one counts. Common in paired-dice systems.',
    },
    [
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
    ],
  ),
];

/** Every row the starter set adds, in table order. */
export const STARTER_ROWS: readonly Expression[] = STARTER_PRESETS.flatMap(
  (p) => p.rows,
);
