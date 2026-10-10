import type { CheckSpec, DicePart, Expression } from '../types';
import {
  STARTER_PRESETS,
  preset,
  type RecipeFamily,
  type StarterPreset,
} from './starterRolls';

type PartFields = Omit<DicePart, 'id'>;
type RowFields = Partial<Omit<Expression, 'id' | 'name' | 'parts'>> & {
  parts: readonly PartFields[];
};

function row(id: string, name: string, fields: RowFields): Expression {
  const { parts, ...rest } = fields;
  return {
    id: `recipe-${id}`,
    name,
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...rest,
    parts: parts.map((p, i) => ({ id: `recipe-${id}-p${i + 1}`, ...p })),
  };
}

// A to-hit roll against AC 15 that deals 1d8 + 3, with the crit range as the
// only thing that varies, so the two crit recipes differ in exactly one field.
function longswordCheck(id: string, critFaces: number[]): CheckSpec {
  return {
    threshold: { direction: 'gte', value: 15 },
    effect: {
      parts: [{ id: `recipe-${id}-e1`, count: 1, sides: 8 }],
      flatModifier: 3,
    },
    onSuccess: 'full',
    onFailure: 'none',
    crit: { onFaces: critFaces, effect: 'doubleDice' },
  };
}

const LIBRARY_PRESETS: readonly StarterPreset[] = [
  // Totals
  preset(
    {
      slug: 'fate-dice',
      family: 'totals',
      alsoCalled: ['Fate Core', 'Fate Accelerated', 'Fate Condensed', 'Fudge dice', '4dF'],
      dice: '4d3 − 8',
      why: 'A Fate die shows minus, blank or plus, which is a d3 minus 2. Four of them run from −4 to +4, with 0 the most likely.',
    },
    [row('fate', 'Four Fate dice', { parts: [{ count: 4, sides: 3 }], flatModifier: -8 })],
  ),
  preset(
    {
      slug: 'great-weapon-fighting',
      family: 'totals',
      alsoCalled: ['Great Weapon Fighting (D&D 5e, 2014)', 'GWF (2014)'],
      dice: '2d6 reroll 1s and 2s + 3',
      why: 'Each damage die that lands on 1 or 2 is rolled again once, and the new roll stands. The 2024 rules count them as 3s instead, which this is not.',
    },
    [
      row('gwf', 'Greatsword with GWF', {
        parts: [{ count: 2, sides: 6, reroll: { values: [1, 2], mode: 'once' } }],
        flatModifier: 3,
      }),
    ],
  ),
  preset(
    {
      slug: 'roll-and-keep',
      family: 'totals',
      alsoCalled: [
        'Legend of the Five Rings (4th edition)',
        'L5R (4th edition)',
        'Roll and keep',
        '7th Sea (1st edition)',
        '5k3',
      ],
      dice: '5d10kh3, 10s explode',
      why: 'On a skilled roll, every 10 rolls again and adds before you pick the three dice to keep.',
    },
    [
      row('l5r', 'Roll 5, keep 3', {
        parts: [
          {
            count: 5,
            sides: 10,
            keep: { type: 'highest', n: 3 },
            explode: { onFaces: [10], depthCap: 10 },
          },
        ],
      }),
    ],
  ),
  preset(
    {
      slug: 'lancer-crit',
      name: 'Critical hit: double the damage dice, keep the best half',
      family: 'totals',
      alsoCalled: ['Lancer critical hit'],
      dice: '3d6 vs 6d6kh3',
      why: 'On a critical hit you roll twice as many damage dice and keep the highest ones, as many as you normally roll.',
    },
    [
      row('lancer-hit', 'Normal hit', { parts: [{ count: 3, sides: 6 }] }),
      row('lancer-crit', 'Critical hit', {
        parts: [{ count: 6, sides: 6, keep: { type: 'highest', n: 3 } }],
      }),
    ],
  ),
  preset(
    {
      slug: 'dice-shapes',
      name: 'Same range, different shapes',
      family: 'totals',
      alsoCalled: ['1d20 vs 3d6', '2d6 vs 3d6', 'Bell curve', 'Swingy dice'],
      dice: '1d20, 3d6, 2d6',
      why: 'One die is flat, so every result is as likely as any other. More dice pile up in the middle, so extremes get rare.',
    },
    [
      row('shape-d20', '1d20', { parts: [{ count: 1, sides: 20 }] }),
      row('shape-3d6', '3d6', { parts: [{ count: 3, sides: 6 }] }),
      row('shape-2d6', '2d6', { parts: [{ count: 2, sides: 6 }] }),
    ],
  ),
  preset(
    {
      slug: 'daggerheart-duality',
      family: 'totals',
      alsoCalled: ['Daggerheart', 'Duality dice', 'Hope and Fear'],
      dice: '2d12 + 2',
      why: 'The total of both dice plus your modifier. Doubles (1 in 12) always succeed, which these rows do not count, so against 12 at +2 the real chance is 77.8%, not the 75% the total shows.',
    },
    [
      row('dh-plain', 'Duality dice +2', { parts: [{ count: 2, sides: 12 }], flatModifier: 2 }),
      row('dh-adv', 'With advantage', {
        parts: [
          { count: 2, sides: 12 },
          { count: 1, sides: 6 },
        ],
        flatModifier: 2,
      }),
    ],
  ),

  // Successes
  preset(
    {
      slug: 'blades-action',
      name: 'Best die decides, two 6s crit',
      family: 'successes',
      alsoCalled: [
        'Blades in the Dark',
        'Forged in the Dark',
        'Scum and Villainy',
        'Band of Blades',
        'Fortune roll (Blades in the Dark)',
      ],
      dice: '2d6kh1 and 2d6 count 6s',
      why: 'The best die sets the result: 6 is a full success, 4 or 5 a partial one, 1 to 3 a bad outcome. Two or more 6s is a critical, which the second row counts, and the first row’s chance of a 6 includes it.',
    },
    [
      row('blades-best', 'Best of 2d6', {
        parts: [{ count: 2, sides: 6, keep: { type: 'highest', n: 1 } }],
      }),
      row('blades-sixes', 'Sixes in 2d6', {
        parts: [{ count: 2, sides: 6 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 6 },
      }),
    ],
  ),
  preset(
    {
      slug: 'blades-resistance',
      name: 'Stress to resist: 6 minus your best die',
      family: 'totals',
      alsoCalled: [
        'Blades in the Dark resistance roll',
        'Forged in the Dark',
        'Resisting a consequence',
      ],
      dice: '2d6kl1 − 1',
      why: 'Six minus your best die has the same odds as your worst die minus one, so this row reads as stress paid before a critical. Two or more 6s (1 in 36 with two dice) also clears 1 stress.',
    },
    [
      row('blades-resist', 'Resistance stress', {
        parts: [{ count: 2, sides: 6, keep: { type: 'lowest', n: 1 } }],
        flatModifier: -1,
      }),
    ],
  ),
  preset(
    {
      slug: 'shadowrun-hits',
      name: 'Count dice showing 5 or 6',
      family: 'successes',
      alsoCalled: ['Shadowrun (4th to 6th edition)', 'Hits'],
      dice: '8d6, count ≥ 5',
      why: 'Each die that shows 5 or 6 is one hit, so a third of your dice hit on average.',
    },
    [
      row('shadowrun', 'Hits on 8d6', {
        parts: [{ count: 8, sides: 6 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 5 },
      }),
    ],
  ),
  preset(
    {
      slug: 'burning-wheel',
      name: 'Count dice showing 4 or more',
      family: 'successes',
      alsoCalled: ['Burning Wheel (black shade)', 'Mouse Guard', 'Torchbearer'],
      dice: '4d6, count ≥ 4',
      why: 'Half your dice succeed on average. Compare pools of different sizes to see what one more die buys.',
    },
    [
      row('bw', 'Successes on 4d6', {
        parts: [{ count: 4, sides: 6 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 4 },
      }),
    ],
  ),
  preset(
    {
      slug: 'year-zero-push',
      name: 'Count 6s, then push the 2s to 5s',
      family: 'successes',
      alsoCalled: ['Mutant: Year Zero', 'Forbidden Lands', 'Year Zero Engine SRD (dice pool)'],
      dice: '5d6 count 6s, reroll 2–5',
      why: 'Pushing rerolls every base die that is not a 6 or a 1, because base-die 1s are banes and stay put. Skill dice in Mutant: Year Zero and Forbidden Lands reroll their 1s, and Alien, Vaesen and Coriolis reroll every die that is not a 6.',
    },
    [
      row('yz-first', 'First roll', {
        parts: [{ count: 5, sides: 6 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 6 },
      }),
      row('yz-push', 'After a push', {
        parts: [
          { count: 5, sides: 6, reroll: { values: [2, 3, 4, 5], mode: 'once' } },
        ],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 6 },
      }),
    ],
  ),
  preset(
    {
      slug: 'warhammer-unsaved-wounds',
      name: 'Hit, wound, then save, as one die',
      family: 'successes',
      alsoCalled: ['Warhammer 40,000', '40k', 'Age of Sigmar', 'Hit, wound, save'],
      dice: '10d216, count ≤ 48',
      why: 'Each d216 stands for one attack’s whole chain: 48 of its 216 faces get through a 3+ to hit, a 3+ to wound and a failed 4+ save.',
    },
    [
      row('wh40k', 'Unsaved wounds, 10 attacks', {
        parts: [{ count: 10, sides: 216 }],
        mode: 'pool',
        successThreshold: { direction: 'lte', value: 48 },
      }),
    ],
  ),

  // Best or worst of
  preset(
    {
      slug: 'advantage-vs-disadvantage',
      name: 'Advantage against disadvantage',
      family: 'advantage',
      alsoCalled: ['D&D 5e advantage', 'Roll twice, keep the higher', 'Roll twice, keep the lower'],
      dice: '1d20 + 5, three ways',
      why: 'Three versions of the same check, so you can see how far each one moves the odds.',
    },
    [
      row('adv-normal', 'Normal', { parts: [{ count: 1, sides: 20 }], flatModifier: 5 }),
      row('adv-adv', 'Advantage', {
        parts: [{ count: 1, sides: 20 }],
        flatModifier: 5,
        rollMode: 'advantage',
      }),
      row('adv-dis', 'Disadvantage', {
        parts: [{ count: 1, sides: 20 }],
        flatModifier: 5,
        rollMode: 'disadvantage',
      }),
    ],
  ),
  preset(
    {
      slug: 'elven-accuracy',
      name: 'Roll three d20s, keep the highest',
      family: 'advantage',
      alsoCalled: ['Elven Accuracy (D&D 5e)', 'Super advantage', 'Triple advantage'],
      dice: '3d20kh1 + 5',
      why: 'Advantage with a third die, next to plain advantage so you can see what the extra die adds.',
    },
    [
      row('elven-adv', 'Advantage', {
        parts: [{ count: 1, sides: 20 }],
        flatModifier: 5,
        rollMode: 'advantage',
      }),
      row('elven', 'Elven Accuracy', {
        parts: [{ count: 3, sides: 20, keep: { type: 'highest', n: 1 } }],
        flatModifier: 5,
      }),
    ],
  ),
  preset(
    {
      slug: 'halfling-lucky',
      name: 'Reroll a natural 1 once',
      family: 'advantage',
      alsoCalled: ['Halfling Lucky trait (D&D 5e)', 'Halfling Luck (D&D 2024)'],
      dice: '1d20 reroll 1s + 5',
      why: 'A natural 1 gets one more try, and the new roll stands even if it is another 1.',
    },
    [
      row('halfling', 'Halfling Lucky', {
        parts: [{ count: 1, sides: 20, reroll: { values: [1], mode: 'once' } }],
        flatModifier: 5,
      }),
    ],
  ),
  preset(
    {
      slug: 'traveller-boon-bane',
      name: 'Roll 3, keep the best 2 (or worst 2)',
      family: 'advantage',
      alsoCalled: ['Traveller boon and bane', 'Mongoose Traveller'],
      dice: '2d6, 3d6kh2, 3d6kl2',
      why: 'A boon rolls a third die and keeps the best two; a bane keeps the worst two. Set a target at 8 to see each one’s chance.',
    },
    [
      row('trav-plain', 'Plain 2d6', { parts: [{ count: 2, sides: 6 }] }),
      row('trav-boon', 'Boon', {
        parts: [{ count: 3, sides: 6, keep: { type: 'highest', n: 2 } }],
      }),
      row('trav-bane', 'Bane', {
        parts: [{ count: 3, sides: 6, keep: { type: 'lowest', n: 2 } }],
      }),
    ],
  ),
  preset(
    {
      slug: 'savage-worlds-trait',
      name: 'Best of two exploding dice',
      family: 'advantage',
      alsoCalled: [
        'Savage Worlds trait roll',
        'SWADE',
        'Savage Worlds Wild Die',
        'Deadlands: The Weird West',
      ],
      dice: 'best of 1d8 and 1d6, both explode',
      why: 'Both dice explode on their highest face and you keep the better one, so 4 or more comes up about 81% of the time with a d8.',
    },
    [
      row('sw-trait', 'd8 trait + wild die', {
        parts: [
          { count: 1, sides: 8, explode: { onFaces: [8], depthCap: 10 } },
          { count: 1, sides: 6, explode: { onFaces: [6], depthCap: 10 } },
        ],
        keepAcross: { type: 'highest', n: 1 },
      }),
    ],
  ),
  preset(
    {
      slug: 'keep-highest-mixed',
      name: 'Roll two weapons, keep the higher',
      family: 'advantage',
      alsoCalled: ['Cairn', 'Keep the highest of mixed dice'],
      dice: 'best of 1d6 and 1d8',
      why: 'Roll both damage dice and keep only the higher one. The best result is still 8, but low rolls get much rarer than on the d8 alone.',
    },
    [
      row('cairn', 'Best of d6 and d8', {
        parts: [
          { count: 1, sides: 6 },
          { count: 1, sides: 8 },
        ],
        keepAcross: { type: 'highest', n: 1 },
      }),
    ],
  ),

  // Head to head
  preset(
    {
      slug: 'contested-check',
      name: 'Two d20s against each other',
      family: 'opposed',
      alsoCalled: [
        'Contested check (D&D 5e 2014)',
        'Grapple check (D&D 5e 2014)',
        'Shove (D&D 5e 2014)',
        'Opposed roll',
      ],
      dice: '1d20 + 5 vs 1d20 + 3',
      why: 'The head-to-head view shows how often the attacker wins outright and how often they tie. In a D&D 5e (2014) contest a tie changes nothing.',
    },
    [
      row('contest-a', 'Attacker +5', { parts: [{ count: 1, sides: 20 }], flatModifier: 5 }),
      row('contest-d', 'Defender +3', { parts: [{ count: 1, sides: 20 }], flatModifier: 3 }),
    ],
  ),
  preset(
    {
      slug: 'ironsworn-action',
      name: 'Beat two d10s with a d6 plus a stat',
      family: 'opposed',
      alsoCalled: ['Ironsworn', 'Ironsworn: Starforged', 'Ironsworn: Delve'],
      dice: '1d6 + 2 vs 2d10',
      why: 'Compare the action row with the higher challenge die for a strong hit, and with the lower one for at least a weak hit. Ties do not count as beating. This holds up to +4, since the action score tops out at 10.',
    },
    [
      row('iron-action', 'Action score +2', { parts: [{ count: 1, sides: 6 }], flatModifier: 2 }),
      row('iron-high', 'Higher challenge die', {
        parts: [{ count: 2, sides: 10, keep: { type: 'highest', n: 1 } }],
      }),
      row('iron-low', 'Lower challenge die', {
        parts: [{ count: 2, sides: 10, keep: { type: 'lowest', n: 1 } }],
      }),
    ],
  ),

  // Beat a number
  preset(
    {
      slug: 'pbta-move',
      name: '2d6 plus a stat, 7 and 10 matter',
      family: 'margin',
      alsoCalled: [
        'Powered by the Apocalypse',
        'PbtA',
        'Apocalypse World',
        'Dungeon World',
        'Monster of the Week',
        'Masks',
      ],
      dice: '2d6 + 1',
      why: 'Set a target at 10 for a full success. A target at 7 shows any hit, so a partial success is the gap between the two.',
    },
    [row('pbta', 'Move at +1', { parts: [{ count: 2, sides: 6 }], flatModifier: 1 })],
  ),
  preset(
    {
      slug: 'attack-with-damage',
      name: 'Hit, then roll damage',
      family: 'margin',
      alsoCalled: ['Chance to hit vs AC', 'Damage per attack (D&D 5e)'],
      dice: '1d20 + 5 vs AC 15 → 1d8 + 3',
      why: 'Rolls to hit first, then damage only if it hits, so the average counts misses as 0. A natural 20 doubles the damage dice. A natural 1 is not treated as an automatic miss, which only matters once 1 plus the bonus reaches the AC.',
    },
    [
      row('attack', 'Longsword vs AC 15', {
        parts: [{ count: 1, sides: 20 }],
        flatModifier: 5,
        mode: 'check',
        check: longswordCheck('attack', [20]),
      }),
    ],
  ),
  preset(
    {
      slug: 'champion-crit',
      name: 'Crit on 19 or 20',
      family: 'margin',
      alsoCalled: ['Improved Critical (Champion fighter)', 'Expanded crit range'],
      dice: '1d20 + 5 vs AC 15, two crit ranges',
      why: 'The same attack with a wider critical range, side by side, so you can see what the extra face is worth.',
    },
    [
      row('crit20', 'Crit on 20', {
        parts: [{ count: 1, sides: 20 }],
        flatModifier: 5,
        mode: 'check',
        check: longswordCheck('crit20', [20]),
      }),
      row('crit19', 'Crit on 19–20', {
        parts: [{ count: 1, sides: 20 }],
        flatModifier: 5,
        mode: 'check',
        check: longswordCheck('crit19', [19, 20]),
      }),
    ],
  ),
  preset(
    {
      slug: 'gurps-margin',
      name: '3d6 under a skill of 12, and by how much',
      family: 'margin',
      alsoCalled: ['GURPS margin of success', 'Roll under 3d6'],
      dice: '3d6 − 9',
      why: 'Margin is skill minus roll. 3d6 is symmetric, so this row has the same odds as the margin: 0 or more is a success.',
    },
    [row('gurps', 'Margin at skill 12', { parts: [{ count: 3, sides: 6 }], flatModifier: -9 })],
  ),
  preset(
    {
      slug: 'percentile-roll-under',
      name: 'Roll d100 under your skill',
      family: 'margin',
      alsoCalled: ['Call of Cthulhu', 'Delta Green', 'Percentile dice'],
      dice: '1d100',
      why: 'Set a target at your skill (1 to 99) and read it as at most to see your chance. Half and a fifth of it, rounded down, are hard and extreme successes in Call of Cthulhu.',
    },
    [row('d100', 'Percentile roll', { parts: [{ count: 1, sides: 100 }] })],
  ),
];

/** The searchable library: the starter set first, then everything else by family. */
export const RECIPES: readonly StarterPreset[] = [
  ...STARTER_PRESETS,
  ...LIBRARY_PRESETS,
];

function searchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchWords(recipe: StarterPreset): string[] {
  return searchText(
    [
      recipe.name,
      ...recipe.alsoCalled,
      recipe.why,
      recipe.dice,
      ...recipe.rows.map((r) => r.name),
    ].join(' '),
  ).split(' ');
}

// A query word has to start a word in the recipe, so "forged" finds Forged in
// the Dark without also finding Starforged. Words with a digit in them are dice
// notation, where the useful part sits mid-word ("d6" in "4d6kh3"), so those
// match anywhere.
function wordMatches(queryWord: string, words: readonly string[]): boolean {
  if (/[0-9]/.test(queryWord)) return words.some((w) => w.includes(queryWord));
  return words.some((w) => w.startsWith(queryWord));
}

/**
 * Every word of the query has to match, so "blades crit" narrows rather than
 * widens. Punctuation and accents are ignored on both sides, which is what lets
 * "l5r" and "40k" find their games.
 */
export function filterRecipes(
  recipes: readonly StarterPreset[],
  query: string,
  family: RecipeFamily | null,
): StarterPreset[] {
  const queryWords = searchText(query).split(' ').filter((w) => w.length > 0);
  return recipes.filter((recipe) => {
    if (family !== null && recipe.family !== family) return false;
    if (queryWords.length === 0) return true;
    const words = searchWords(recipe);
    return queryWords.every((q) => wordMatches(q, words));
  });
}
