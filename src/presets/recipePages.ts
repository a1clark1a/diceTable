import type { TargetState } from '../types';
import { RECIPES } from './recipes';
import type { StarterPreset } from './starterRolls';

/**
 * A /recipes/:slug page: one library recipe's rows, seeded into a table of
 * their own, under copy that answers the question people search for. The
 * route slug is that search phrasing, so it is not the recipe's own slug.
 */
export interface RecipePage {
  slug: string;
  recipe: StarterPreset;
  /** The document title, at most 60 characters. */
  title: string;
  /** The page's h1, phrased the way the question is asked. */
  heading: string;
  /** Two or three sentences that answer the question, numbers first. */
  intro: string;
  /** The meta description, 120 to 155 characters. */
  description: string;
  /** How to build the same rows by hand, for the page's HowTo structured data. */
  steps: readonly { title: string; plain: string }[];
  /** Seeded only where a target is what makes the rows answer the question. */
  target?: TargetState;
  poolTargets?: readonly number[];
}

type PageFields = Omit<RecipePage, 'recipe'> & { recipe: string };

function page(fields: PageFields): RecipePage {
  const recipe = RECIPES.find((r) => r.slug === fields.recipe);
  if (recipe === undefined) throw new Error(`no recipe with slug ${fields.recipe}`);
  return { ...fields, recipe };
}

export const RECIPE_PAGES: readonly RecipePage[] = [
  page({
    slug: '4d6-drop-lowest',
    recipe: 'ability-score',
    title: '4d6 drop lowest: average and odds · DiceTable',
    heading: '4d6 drop lowest: what’s the average, and how rare is an 18?',
    intro: 'Rolling four d6 and keeping the best three averages about 12.24. The most common result is 13, and an 18 comes up about 1.6% of the time. It is the classic way to roll D&D ability scores.',
    description: '4d6 drop lowest averages about 12.24, lands on 13 most often, and rolls an 18 about 1.6% of the time. See every score’s odds and change the dice.',
    steps: [
      {
        title: 'Add a roll',
        plain: 'Press Add roll. The new row’s editor opens below it on its own.',
      },
      {
        title: 'Make it four d6',
        plain: 'Under Dice parts, set Count to 4 and pick d6.',
      },
      {
        title: 'Keep the best three',
        plain: 'Turn on Keep under Rules. It starts on highest with How many (n) at 3, so the row reads 4d6kh3.',
      },
    ],
  }),
  page({
    slug: 'advantage-vs-disadvantage',
    recipe: 'advantage-vs-disadvantage',
    title: 'Advantage vs disadvantage: hit chance on a d20 · DiceTable',
    heading: 'How much is advantage worth, and what does disadvantage cost?',
    intro: 'Against a target of 15, a d20 plus 5 succeeds 55% of the time. Advantage rolls twice and keeps the higher, which lifts that to about 80%, about what another +5 would do. Disadvantage keeps the lower, which drops it to about 30%.',
    description: 'With +5 against 15, a d20 succeeds 55% of the time. Advantage makes that about 80%, as good as another +5, and disadvantage about 30%. Compare all three.',
    steps: [
      {
        title: 'Build the plain check',
        plain: 'Press Add roll. The new row is already 1d20 and its editor is open, so type 5 in its Mod box.',
      },
      {
        title: 'Copy it twice',
        plain: 'Press Duplicate, the copy icon beside the up and down arrows at the top of the editor. The copy’s editor opens, so pick Advantage under Roll mode. Press Duplicate again on that copy and pick Disadvantage.',
      },
      {
        title: 'Set the target',
        plain: 'Open Target above the table, type 15 and press Enter. Hit % shows how often each roll gets 15 or more.',
      },
    ],
    target: { values: [15], ruling: 'gte' },
  }),
  page({
    slug: 'great-weapon-fighting',
    recipe: 'great-weapon-fighting',
    title: 'Reroll 1s and 2s: Great Weapon Fighting (2014) · DiceTable',
    heading: 'Rerolling 1s and 2s on damage dice: how much does it add?',
    intro: 'Rerolling each 1 or 2 once lifts 2d6 + 3 damage from an average of 10 to about 11.33, about 1.33 more per hit. The new roll stands even if it is another 1 or 2, which is Great Weapon Fighting as the 2014 rules write it. The 2024 rules count 1s and 2s as 3s instead, for an average of 11, which this row does not do.',
    description: 'Reroll 1s and 2s once on 2d6 + 3 and average damage rises from 10 to about 11.33. That is Great Weapon Fighting (2014); the 2024 rule counts them as 3s.',
    steps: [
      {
        title: 'Make it 2d6 + 3',
        plain: 'Press Add roll and type 3 in its Mod box. In the editor that opens, set Count to 2 and pick d6.',
      },
      {
        title: 'Reroll 1s and 2s',
        plain: 'Turn on Reroll under Rules. Under Faces pick 2 as well as 1, and leave Mode on once.',
      },
      {
        title: 'See what it adds',
        plain: 'The row’s Mean reads 11.33. Plain 2d6 + 3 averages 10, so the rerolls add about 1.33 per hit.',
      },
    ],
  }),
  page({
    slug: 'elven-accuracy',
    recipe: 'elven-accuracy',
    title: 'Best of three d20s: Elven Accuracy odds · DiceTable',
    heading: 'Triple advantage: how much does a third d20 add?',
    intro: 'With +5, keeping the best of three d20s reaches 20 or more about 66% of the time, against 51% with plain advantage. A natural 20 comes up about 14% of the time, against about 10% with advantage. Elven Accuracy in D&D 5e works out the same: with advantage on a Dexterity, Intelligence, Wisdom or Charisma attack, you reroll the lower die once.',
    description: 'Best of three d20s at +5: 20 or more about 66% of the time (51% with advantage), and a natural 20 about 14% of the time. See what Elven Accuracy adds.',
    steps: [
      {
        title: 'Build advantage',
        plain: 'Press Add roll and type 5 in its Mod box. In the editor that opens, pick Advantage under Roll mode.',
      },
      {
        title: 'Build the best of three',
        plain: 'Press Add roll again and type 5 in its Mod box. In its editor, set Count to 3, turn on Keep, and set How many (n) to 1.',
      },
      {
        title: 'Compare at 20 and at a natural 20',
        plain: 'Open Target above the table. Type 20 and press Enter, then 25 and press Enter. At +5, Hit % at 25 is the chance of a natural 20.',
      },
    ],
    target: { values: [20, 25], ruling: 'gte' },
  }),
  page({
    slug: 'exploding-dice',
    recipe: 'exploding-dice',
    title: 'Exploding dice: average and odds · DiceTable',
    heading: 'How much do exploding dice add?',
    intro: 'An exploding d6 averages about 4.2, against 3.5 for a plain d6. Every 6 rolls the die again and adds, so 1 roll in 6 ends above 6 and 1 roll in 36 ends above 12. A total of exactly 6 can never happen.',
    description: 'An exploding d6 averages about 4.2 instead of 3.5. One roll in 6 goes past 6, and one in 36 goes past 12. See every total’s odds side by side.',
    steps: [
      {
        title: 'Add a d6',
        plain: 'Press Add roll and pick d6 under Die in the editor that opens.',
      },
      {
        title: 'Copy it and make it explode',
        plain: 'Press Duplicate, the copy icon beside the up and down arrows at the top of the editor. On the copy, turn on Explode under Rules. It starts on face 6 with a Depth cap of 10, the most extra rolls one die can make.',
      },
      {
        title: 'Compare the two',
        plain: 'The plain die’s Mean reads 3.50 and the exploding copy’s reads 4.20.',
      },
    ],
  }),
  page({
    slug: 'counting-successes',
    recipe: 'success-pool',
    title: 'Counting successes in a dice pool · DiceTable',
    heading: 'Counting successes in a dice pool: how many will you get?',
    intro: 'Roll seven d10s, count every die showing 8 or more, and you average 2.1 successes. Each die succeeds 3 times in 10. You get at least one success about 92% of the time, at least two about 67%, and at least three about 35%.',
    description: 'Seven d10s counting 8 or more average 2.1 successes: at least one about 92% of the time, two about 67%, three about 35%. Change the pool and see.',
    steps: [
      {
        title: 'Roll seven d10s',
        plain: 'Press Add roll. In the editor that opens, set Count to 7 and pick d10.',
      },
      {
        title: 'Count instead of add',
        plain: 'Click Pool next to the row’s dice, then set the number beside ≥ to 8. Each die showing 8 or more is one success.',
      },
      {
        title: 'Ask for one, two or three',
        plain: 'Open Pool target above the table. Type 2 and press Enter, then type 3 and press Enter. Hit % then shows the chance of at least that many successes.',
      },
    ],
    poolTargets: [1, 2, 3],
  }),
  page({
    slug: 'expanded-crit-range',
    recipe: 'champion-crit',
    title: 'Crit on 19 or 20: is Improved Critical worth it? · DiceTable',
    heading: 'Critting on a 19 or 20: how much more damage?',
    intro: 'Critting on a 19 or 20 instead of only a 20 doubles your chance of a crit, from 5% to 10%. With +5 against AC 15 and 1d8 + 3 damage, average damage per attack goes from 4.35 to about 4.6, counting misses as 0. Your chance to hit stays at 55%, because a 19 already hits.',
    description: 'Crit on 19 or 20, like the Champion’s Improved Critical, and your crit chance doubles from 5% to 10%. Damage per attack rises from 4.35 to about 4.6.',
    steps: [
      {
        title: 'Build the attack',
        plain: 'Press Add roll, type 5 in its Mod box and click Check next to the row’s dice. In the editor that opens, set Succeeds when to at least 15. Under Effect, pick d8 with a Modifier of 3.',
      },
      {
        title: 'Turn on the critical',
        plain: 'Under Outcomes, turn on Critical. It starts on face 20 with Roll double the dice.',
      },
      {
        title: 'Widen the range',
        plain: 'Press Duplicate, the copy icon beside the up and down arrows at the top of the editor. The copy’s editor opens, so pick 19 as well under its Critical’s Faces. Both rows still succeed 55% of the time, and the copy’s Mean goes up.',
      },
    ],
  }),
  page({
    slug: 'chance-to-hit-vs-ac',
    recipe: 'attack-with-damage',
    title: 'Chance to hit vs AC, and damage per attack · DiceTable',
    heading: 'What’s my chance to hit against AC?',
    intro: 'With +5 against AC 15, a d20 attack hits 55% of the time, and 5% of attacks are critical hits on a natural 20. Counting misses as 0, a 1d8 + 3 weapon averages 4.35 damage per attack. Change the bonus, the AC or the damage dice and every number follows.',
    description: 'At +5 against AC 15 you hit 55% of the time and crit 5%. With 1d8 + 3 damage, that averages 4.35 per attack once misses count as 0.',
    steps: [
      {
        title: 'Set the attack bonus',
        plain: 'Press Add roll, type 5 in its Mod box, and click Check next to the row’s dice.',
      },
      {
        title: 'Set the AC and the damage',
        plain: 'In the row’s editor, already open below it, set Succeeds when to at least 15. Under Effect, pick d8 and set its Modifier to 3.',
      },
      {
        title: 'Add the critical',
        plain: 'Under Outcomes, turn on Critical. It starts on 20 with Roll double the dice. A natural 1 is not an automatic miss here. That only matters once 1 plus your bonus reaches the AC.',
      },
    ],
  }),
  page({
    slug: 'keep-highest-mixed-dice',
    recipe: 'keep-highest-mixed',
    title: 'Keep the higher of a d6 and a d8 · DiceTable',
    heading: 'Rolling a d6 and a d8 and keeping the higher: what do you get?',
    intro: 'Rolling a d6 and a d8 and keeping the higher die averages about 5.23. The best result is still 8, but a 1 or 2 comes up only 1 time in 12, against 1 time in 4 on the d8 alone. Cairn uses this rule when you attack with two weapons at once.',
    description: 'Roll a d6 and a d8, keep the higher: it averages about 5.23, still tops out at 8, and lands on 1 or 2 only 1 time in 12. Mix any dice you like.',
    steps: [
      {
        title: 'Add a d6',
        plain: 'Press Add roll and pick d6 under Die in the editor that opens.',
      },
      {
        title: 'Add a d8 beside it',
        plain: 'Press Add part and pick d8 for the new part.',
      },
      {
        title: 'Keep the higher die',
        plain: 'Turn on Keep across parts. It starts on highest with How many (n) at 1 of 2 dice, which keeps the better die.',
      },
    ],
  }),
  page({
    slug: '2d6-vs-3d6-vs-1d20',
    recipe: 'dice-shapes',
    title: '2d6 vs 3d6 vs 1d20: how the odds compare · DiceTable',
    heading: '2d6 vs 3d6 vs 1d20: how do the odds compare?',
    intro: '1d20 and 3d6 both average 10.5, but they get there differently. Every result on a d20 is equally likely at 5%, while 3d6 piles up in the middle and rolls an 18 only 1 time in 216. 2d6 averages 7, which is also its most common result at 1 roll in 6.',
    description: '1d20 and 3d6 both average 10.5, but a d20 gives every result 5% while 3d6 rolls an 18 just 1 time in 216. 2d6 averages 7. See all three curves.',
    steps: [
      {
        title: 'Add three rolls',
        plain: 'Press Add roll three times. Each new row starts as 1d20, so the first of them is already done.',
      },
      {
        title: 'Set the dice',
        plain: 'Open the second new row with its Expand arrow, set Count to 3 and pick d6. Do the same on the third new row with a Count of 2.',
      },
      {
        title: 'Compare the shapes',
        plain: 'The chart draws all three. Their Mean reads 10.50, 10.50 and 7.00, while the curves show how differently they spread.',
      },
    ],
  }),
];

export function recipePath(slug: string): string {
  return `/recipes/${slug}`;
}

const TITLE_SUFFIX = ' · DiceTable';

/** The page's title without the site name, short enough to link to it by. */
export function recipePageLabel(page: RecipePage): string {
  return page.title.endsWith(TITLE_SUFFIX) ? page.title.slice(0, -TITLE_SUFFIX.length) : page.title;
}

export function findRecipePage(slug: string | undefined): RecipePage | undefined {
  return RECIPE_PAGES.find((p) => p.slug === slug);
}
