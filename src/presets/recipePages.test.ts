import { describe, expect, it } from 'vitest';
import sitemapXml from '../../public/sitemap.xml?raw';
import llmsTxt from '../../public/llms.txt?raw';
import manifestJson from '../../docs/docs-manifest.json?raw';
import { MAX_TARGETS, type Distribution, type Expression, type TargetRuling } from '../types';
import { RECIPES } from './recipes';
import { RECIPE_PAGES, findRecipePage, recipePageLabel, recipePath, type RecipePage } from './recipePages';
import { getRowData } from '../state/useDistributions';
import { validateExpression } from '../state/persistedSchema';
import { normalizeExpression } from '../state/normalize';
import { hitProbability } from '../engine/stats';
import { formatNumber } from '../components/chart/format';

// The app's tsconfig has no Node types, so the file system is listed through
// Vite instead. The glob is lazy: only its keys are used and no file is read.
// The roots are every place a docs manifest dep points at today.
const REPO_FILES: ReadonlySet<string> = new Set(
  Object.keys(
    import.meta.glob(['/src/**/*', '/public/**/*', '/docs/**/*', '/*'], { query: '?raw' }),
  ).map((key) => key.replace(/^\//, '')),
);

const SITE = 'https://dice-table.app';

function pageFor(slug: string): RecipePage {
  const found = findRecipePage(slug);
  if (found === undefined) throw new Error(`no recipe page with slug ${slug}`);
  return found;
}

function rowOf(page: RecipePage, name: string): Expression {
  const found = page.recipe.rows.find((r) => r.name === name);
  if (found === undefined) throw new Error(`${page.slug} seeds no row named ${name}`);
  return found;
}

function distOf(row: Expression): Distribution {
  return getRowData(row).dist;
}

function chanceWhere(dist: Distribution, test: (value: number) => boolean): number {
  let total = 0;
  for (const [value, p] of dist) if (test(value)) total += p;
  return total;
}

function meanOf(row: Expression): number {
  return getRowData(row).stats.mean;
}

function onlyMode(row: Expression): number {
  const modes = getRowData(row).stats.mode;
  const [first] = modes;
  if (modes.length !== 1 || first === undefined) return NaN;
  return first;
}

/** The shared chance of every result, or NaN when the results are not equally likely. */
function evenChance(dist: Distribution): number {
  const chances = [...dist.values()];
  const [first] = chances;
  if (first === undefined) return NaN;
  return chances.every((p) => Math.abs(p - first) < 1e-15) ? first : NaN;
}

/** Hit % for a row at one of the page's own seeded targets, as the table computes it. */
function hitOn(page: RecipePage, row: Expression, value: number): number {
  const target = page.target;
  if (target === undefined || !target.values.includes(value)) {
    throw new Error(`${page.slug} does not seed a target of ${value}`);
  }
  return hitProbability(distOf(row), value, target.ruling);
}

function hitAt(page: RecipePage, name: string, value: number): number {
  return hitOn(page, rowOf(page, name), value);
}

/** Hit % at one of the page's own seeded pool targets: at least n successes. */
function poolHitAt(page: RecipePage, name: string, successes: number): number {
  if (page.poolTargets === undefined || !page.poolTargets.includes(successes)) {
    throw new Error(`${page.slug} does not seed a pool target of ${successes}`);
  }
  return hitProbability(distOf(rowOf(page, name)), successes, 'gte');
}

function checkHit(page: RecipePage, name: string): number {
  const chances = getRowData(rowOf(page, name)).checkChances;
  if (chances === null) return NaN;
  return chances.success + chances.crit;
}

function checkCrit(page: RecipePage, name: string): number {
  const chances = getRowData(rowOf(page, name)).checkChances;
  if (chances === null) return NaN;
  return chances.crit;
}

function withCount(row: Expression, count: number): Expression {
  return { ...row, parts: row.parts.map((p) => ({ ...p, count })) };
}

function withoutReroll(row: Expression): Expression {
  return {
    ...row,
    parts: row.parts.map((p) => {
      const next = { ...p };
      delete next.reroll;
      return next;
    }),
  };
}

function onlySides(row: Expression, sides: number): Expression {
  const next: Expression = { ...row, parts: row.parts.filter((p) => p.sides === sides) };
  delete next.keepAcross;
  return next;
}

function copyOf(page: RecipePage): { where: string; text: string }[] {
  return [
    { where: `${page.slug}.title`, text: page.title },
    { where: `${page.slug}.heading`, text: page.heading },
    { where: `${page.slug}.intro`, text: page.intro },
    { where: `${page.slug}.description`, text: page.description },
    ...page.steps.flatMap((step, i) => [
      { where: `${page.slug}.steps[${i}].title`, text: step.title },
      { where: `${page.slug}.steps[${i}].plain`, text: step.plain },
    ]),
  ];
}

const ALL_COPY = RECIPE_PAGES.flatMap(copyOf);

describe('recipe page list', () => {
  it('has exactly ten pages', () => {
    expect(RECIPE_PAGES).toHaveLength(10);
  });

  it('gives every page a unique kebab-case slug', () => {
    const slugs = RECIPE_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('seeds every page from a recipe in the library', () => {
    for (const page of RECIPE_PAGES) {
      expect(RECIPES, page.slug).toContain(page.recipe);
    }
  });

  it('never seeds two pages from the same recipe', () => {
    const recipes = RECIPE_PAGES.map((p) => p.recipe.slug);
    expect(new Set(recipes).size).toBe(recipes.length);
  });
});

describe('recipe page copy shape', () => {
  it('keeps every title within 60 characters', () => {
    for (const page of RECIPE_PAGES) {
      expect(page.title.length, page.slug).toBeLessThanOrEqual(60);
    }
  });

  it('ends every title with the site name', () => {
    for (const page of RECIPE_PAGES) expect(page.title, page.slug).toMatch(/ · DiceTable$/);
  });

  it('keeps every description between 120 and 155 characters', () => {
    for (const page of RECIPE_PAGES) {
      expect(page.description.length, page.slug).toBeGreaterThanOrEqual(120);
      expect(page.description.length, page.slug).toBeLessThanOrEqual(155);
    }
  });

  it('writes every intro as two or three whole sentences', () => {
    for (const page of RECIPE_PAGES) {
      const sentences = page.intro.split(/(?<=[.!?])\s+/);
      expect(sentences.length, page.slug).toBeGreaterThanOrEqual(2);
      expect(sentences.length, page.slug).toBeLessThanOrEqual(3);
      expect(page.intro, page.slug).toMatch(/[.!?]$/);
    }
  });

  it('gives every page three steps, each with a title and an explanation', () => {
    for (const page of RECIPE_PAGES) {
      expect(page.steps, page.slug).toHaveLength(3);
      for (const step of page.steps) {
        expect(step.title.trim(), page.slug).not.toBe('');
        expect(step.plain.trim(), page.slug).not.toBe('');
      }
    }
  });

  it('uses no em-dash or en-dash anywhere a reader sees', () => {
    const enDash = String.fromCodePoint(0x2013);
    const emDash = String.fromCodePoint(0x2014);
    for (const { where, text } of ALL_COPY) {
      expect(text, where).not.toContain(enDash);
      expect(text, where).not.toContain(emDash);
    }
  });

  it('uses the curly apostrophe, never a straight one', () => {
    for (const { where, text } of ALL_COPY) expect(text, where).not.toContain("'");
  });
});

// Keyed by ruling so that adding one to TargetRuling stops this file compiling
// until it is listed here.
const RULINGS: Readonly<Record<TargetRuling, true>> = {
  gte: true,
  gt: true,
  lte: true,
  lt: true,
  eq: true,
};

function isStrictlyAscendingIntegers(values: readonly number[]): boolean {
  return values.every((v, i) => Number.isInteger(v) && (i === 0 || v > (values[i - 1] ?? v)));
}

describe('recipe page target seeds', () => {
  const withTarget = RECIPE_PAGES.filter((p) => p.target !== undefined);
  const withPoolTargets = RECIPE_PAGES.filter((p) => p.poolTargets !== undefined);

  it('seeds targets as ascending distinct integers within the target cap', () => {
    for (const page of withTarget) {
      const values = page.target?.values ?? [];
      expect(values.length, page.slug).toBeGreaterThan(0);
      expect(values.length, page.slug).toBeLessThanOrEqual(MAX_TARGETS);
      expect(isStrictlyAscendingIntegers(values), page.slug).toBe(true);
    }
  });

  it('seeds a ruling the target control offers', () => {
    for (const page of withTarget) {
      expect(Object.keys(RULINGS), page.slug).toContain(page.target?.ruling);
    }
  });

  it('seeds pool targets as ascending distinct whole numbers of at least one success', () => {
    for (const page of withPoolTargets) {
      const values = page.poolTargets ?? [];
      expect(values.length, page.slug).toBeGreaterThan(0);
      expect(values.length, page.slug).toBeLessThanOrEqual(MAX_TARGETS);
      expect(isStrictlyAscendingIntegers(values), page.slug).toBe(true);
      for (const v of values) expect(v, page.slug).toBeGreaterThanOrEqual(1);
    }
  });

  // A check row's distribution is its damage, so a target would read damage
  // against a number the copy means as a to-hit total.
  it('never seeds a target on a page whose recipe has a check row', () => {
    for (const page of [...withTarget, ...withPoolTargets]) {
      for (const row of page.recipe.rows) expect(row.mode, `${page.slug} / ${row.name}`).not.toBe('check');
    }
  });

  it('seeds a sum target only where a sum row can read it', () => {
    for (const page of withTarget) {
      expect(
        page.recipe.rows.some((r) => r.mode === 'sum'),
        page.slug,
      ).toBe(true);
    }
  });

  it('seeds pool targets only where a pool row can read them', () => {
    for (const page of withPoolTargets) {
      expect(
        page.recipe.rows.some((r) => r.mode === 'pool'),
        page.slug,
      ).toBe(true);
    }
  });
});

describe('recipe page seeded rows', () => {
  const pageRows = RECIPE_PAGES.flatMap((page) =>
    page.recipe.rows.map((row) => ({ where: `${page.slug} / ${row.name}`, row })),
  );

  it('seeds rows that normalizing leaves unchanged', () => {
    for (const { where, row } of pageRows) {
      expect(normalizeExpression(row), where).toStrictEqual(row);
    }
  });

  it('seeds rows that survive a JSON round trip through the persisted-state validator', () => {
    for (const { where, row } of pageRows) {
      const roundTripped: unknown = JSON.parse(JSON.stringify(row));
      expect(validateExpression(roundTripped), where).toStrictEqual(row);
    }
  });
});

/**
 * One number a page states. The phrase is copy that must appear word for word
 * on the page, `says` is the number inside it as written, `engine` is what the
 * table computes for that quantity, and `exact` is the value derived by hand.
 *
 * How the stated number may differ from the exact one follows from the phrase:
 * "about" allows rounding to the stated precision, "reads" quotes a Mean cell
 * and must match what that cell prints, and anything else must be exact.
 */
interface Claim {
  phrase: string;
  says: string;
  engine: () => number;
  exact: number;
}

interface PageNumbers {
  claims: readonly Claim[];
  /**
   * Phrases whose numbers describe the setup (a bonus, a target, a die count)
   * rather than a result, so there is nothing for the engine to confirm.
   */
  setup: readonly string[];
}

const ability = pageFor('4d6-drop-lowest');
const advantage = pageFor('advantage-vs-disadvantage');
const gwf = pageFor('great-weapon-fighting');
const elven = pageFor('elven-accuracy');
const exploding = pageFor('exploding-dice');
const pool = pageFor('counting-successes');
const critRange = pageFor('expanded-crit-range');
const toHit = pageFor('chance-to-hit-vs-ac');
const mixed = pageFor('keep-highest-mixed-dice');
const shapes = pageFor('2d6-vs-3d6-vs-1d20');

const abilityRow = rowOf(ability, 'Ability score');
const gwfRow = rowOf(gwf, 'Greatsword with GWF');
const plainD6 = rowOf(exploding, 'Plain d6');
const explodingD6 = rowOf(exploding, 'Exploding d6');
const poolRow = rowOf(pool, 'Success pool');
const mixedRow = rowOf(mixed, 'Best of d6 and d8');
const d20Row = rowOf(shapes, '1d20');
const threeD6Row = rowOf(shapes, '3d6');
const twoD6Row = rowOf(shapes, '2d6');

// Every fraction is derived by counting outcomes of the game rule, not by
// running the engine: 4d6kh3 over 1296 rolls, a d20 + 5 against 15 as 11 of 20
// faces, advantage as 1 - (9/20)^2, best of three d20s at 20 as 1 - (7/20)^3, a
// natural 20 on three dice as 1 - (19/20)^3, and the pool as a binomial over
// seven dice at 3/10.
const NUMBERS: Readonly<Record<string, PageNumbers>> = {
  '4d6-drop-lowest': {
    claims: [
      { phrase: 'averages about 12.24', says: '12.24', engine: () => meanOf(abilityRow), exact: 15869 / 1296 },
      { phrase: 'The most common result is 13', says: '13', engine: () => onlyMode(abilityRow), exact: 13 },
      { phrase: 'lands on 13 most often', says: '13', engine: () => onlyMode(abilityRow), exact: 13 },
      {
        phrase: 'an 18 comes up about 1.6%',
        says: '1.6%',
        engine: () => chanceWhere(distOf(abilityRow), (v) => v === 18),
        exact: 7 / 432,
      },
      {
        phrase: 'rolls an 18 about 1.6%',
        says: '1.6%',
        engine: () => chanceWhere(distOf(abilityRow), (v) => v === 18),
        exact: 7 / 432,
      },
    ],
    setup: ['how rare is an 18', 'set Count to 4', 'How many (n) at 3'],
  },
  'advantage-vs-disadvantage': {
    claims: [
      { phrase: 'succeeds 55% of the time', says: '55%', engine: () => hitAt(advantage, 'Normal', 15), exact: 11 / 20 },
      { phrase: 'lifts that to about 80%', says: '80%', engine: () => hitAt(advantage, 'Advantage', 15), exact: 319 / 400 },
      {
        phrase: 'Advantage makes that about 80%',
        says: '80%',
        engine: () => hitAt(advantage, 'Advantage', 15),
        exact: 319 / 400,
      },
      {
        phrase: 'drops it to about 30%',
        says: '30%',
        engine: () => hitAt(advantage, 'Disadvantage', 15),
        exact: 121 / 400,
      },
      {
        phrase: 'disadvantage about 30%',
        says: '30%',
        engine: () => hitAt(advantage, 'Disadvantage', 15),
        exact: 121 / 400,
      },
    ],
    // "another +5" is checked by its own test below.
    setup: [
      'Against a target of 15',
      'a d20 plus 5',
      'about what another +5 would do',
      'With +5 against 15',
      'as good as another +5',
      'type 5 in its Mod box',
      'type 15 and press Enter',
      'gets 15 or more',
    ],
  },
  'great-weapon-fighting': {
    claims: [
      { phrase: 'from an average of 10', says: '10', engine: () => meanOf(withoutReroll(gwfRow)), exact: 10 },
      { phrase: 'rises from 10', says: '10', engine: () => meanOf(withoutReroll(gwfRow)), exact: 10 },
      { phrase: 'Plain 2d6 + 3 averages 10', says: '10', engine: () => meanOf(withoutReroll(gwfRow)), exact: 10 },
      { phrase: 'to about 11.33', says: '11.33', engine: () => meanOf(gwfRow), exact: 34 / 3 },
      { phrase: 'Mean reads 11.33', says: '11.33', engine: () => meanOf(gwfRow), exact: 34 / 3 },
      {
        phrase: 'about 1.33 more per hit',
        says: '1.33',
        engine: () => meanOf(gwfRow) - meanOf(withoutReroll(gwfRow)),
        exact: 4 / 3,
      },
      {
        phrase: 'add about 1.33 per hit',
        says: '1.33',
        engine: () => meanOf(gwfRow) - meanOf(withoutReroll(gwfRow)),
        exact: 4 / 3,
      },
    ],
    // The 2024 average of 11 counts a 1 or 2 as a 3, which no row can express
    // yet, so it stays prose: each die averages (3 + 3 + 3 + 4 + 5 + 6) / 6 = 4.
    setup: [
      'Reroll 1s and 2s',
      'Rerolling 1s and 2s',
      '(2014)',
      'each 1 or 2 once',
      'another 1 or 2',
      'the 2014 rules',
      'The 2024 rules count 1s and 2s as 3s instead, for an average of 11',
      'the 2024 rule counts them as 3s',
      'type 3 in its Mod box',
      'set Count to 2',
      'pick 2 as well as 1',
    ],
  },
  'elven-accuracy': {
    claims: [
      {
        phrase: '20 or more about 66%',
        says: '66%',
        engine: () => hitAt(elven, 'Elven Accuracy', 20),
        exact: 657 / 1000,
      },
      {
        phrase: 'against 51% with plain advantage',
        says: '51%',
        engine: () => hitAt(elven, 'Advantage', 20),
        exact: 51 / 100,
      },
      { phrase: '(51% with advantage)', says: '51%', engine: () => hitAt(elven, 'Advantage', 20), exact: 51 / 100 },
      // A total of 25 at +5 is a kept natural 20, so Hit % at 25 is the crit
      // chance, which is what the third step tells the reader to look at.
      {
        phrase: 'A natural 20 comes up about 14%',
        says: '14%',
        engine: () => hitAt(elven, 'Elven Accuracy', 25),
        exact: 1141 / 8000,
      },
      {
        phrase: 'a natural 20 about 14%',
        says: '14%',
        engine: () => hitAt(elven, 'Elven Accuracy', 25),
        exact: 1141 / 8000,
      },
      {
        phrase: 'against about 10% with advantage',
        says: '10%',
        engine: () => hitAt(elven, 'Advantage', 25),
        exact: 39 / 400,
      },
    ],
    setup: [
      'With +5',
      'D&D 5e',
      'at +5',
      'type 5 in its Mod box',
      'set Count to 3',
      'set How many (n) to 1',
      'Compare at 20 and at a natural 20',
      'Type 20 and press Enter, then 25 and press Enter',
      'At +5, Hit % at 25 is the chance of a natural 20',
    ],
  },
  'exploding-dice': {
    claims: [
      { phrase: 'averages about 4.2', says: '4.2', engine: () => meanOf(explodingD6), exact: 507915877 / 120932352 },
      { phrase: 'against 3.5 for a plain d6', says: '3.5', engine: () => meanOf(plainD6), exact: 7 / 2 },
      { phrase: 'instead of 3.5', says: '3.5', engine: () => meanOf(plainD6), exact: 7 / 2 },
      {
        phrase: '1 roll in 6 ends above 6',
        says: '1 roll in 6',
        engine: () => chanceWhere(distOf(explodingD6), (v) => v > 6),
        exact: 1 / 6,
      },
      {
        phrase: 'One roll in 6 goes past 6',
        says: 'One roll in 6',
        engine: () => chanceWhere(distOf(explodingD6), (v) => v > 6),
        exact: 1 / 6,
      },
      {
        phrase: '1 roll in 36 ends above 12',
        says: '1 roll in 36',
        engine: () => chanceWhere(distOf(explodingD6), (v) => v > 12),
        exact: 1 / 36,
      },
      {
        phrase: 'one in 36 goes past 12',
        says: 'one in 36',
        engine: () => chanceWhere(distOf(explodingD6), (v) => v > 12),
        exact: 1 / 36,
      },
      {
        phrase: 'A total of exactly 6 can never happen',
        says: 'never',
        engine: () => chanceWhere(distOf(explodingD6), (v) => v === 6),
        exact: 0,
      },
      { phrase: 'Mean reads 3.50', says: '3.50', engine: () => meanOf(plainD6), exact: 7 / 2 },
      { phrase: 'copy’s reads 4.20', says: '4.20', engine: () => meanOf(explodingD6), exact: 507915877 / 120932352 },
    ],
    // The depth cap is checked by its own test below.
    setup: ['Every 6 rolls the die again', 'It starts on face 6 with a Depth cap of 10'],
  },
  'counting-successes': {
    claims: [
      { phrase: 'average 2.1 successes', says: '2.1', engine: () => meanOf(poolRow), exact: 21 / 10 },
      {
        phrase: 'Each die succeeds 3 times in 10',
        says: '3 times in 10',
        engine: () => chanceWhere(distOf(withCount(poolRow, 1)), (v) => v >= 1),
        exact: 3 / 10,
      },
      {
        phrase: 'at least one success about 92%',
        says: '92%',
        engine: () => poolHitAt(pool, 'Success pool', 1),
        exact: 9176457 / 10000000,
      },
      {
        phrase: 'at least one about 92%',
        says: '92%',
        engine: () => poolHitAt(pool, 'Success pool', 1),
        exact: 9176457 / 10000000,
      },
      {
        phrase: 'two about 67%',
        says: '67%',
        engine: () => poolHitAt(pool, 'Success pool', 2),
        exact: 1676457 / 2500000,
      },
      {
        phrase: 'three about 35%',
        says: '35%',
        engine: () => poolHitAt(pool, 'Success pool', 3),
        exact: 705861 / 2000000,
      },
    ],
    setup: [
      'showing 8 or more',
      'counting 8 or more',
      'set Count to 7',
      'set the number beside ≥ to 8',
      'Type 2 and press Enter, then type 3 and press Enter',
    ],
  },
  'expanded-crit-range': {
    claims: [
      { phrase: 'from 5% to 10%', says: '5%', engine: () => checkCrit(critRange, 'Crit on 20'), exact: 1 / 20 },
      { phrase: 'from 5% to 10%', says: '10%', engine: () => checkCrit(critRange, 'Crit on 19–20'), exact: 1 / 10 },
      { phrase: 'from 4.35', says: '4.35', engine: () => meanOf(rowOf(critRange, 'Crit on 20')), exact: 87 / 20 },
      { phrase: 'to about 4.6', says: '4.6', engine: () => meanOf(rowOf(critRange, 'Crit on 19–20')), exact: 183 / 40 },
      { phrase: 'stays at 55%', says: '55%', engine: () => checkHit(critRange, 'Crit on 20'), exact: 11 / 20 },
      { phrase: 'stays at 55%', says: '55%', engine: () => checkHit(critRange, 'Crit on 19–20'), exact: 11 / 20 },
      {
        phrase: 'Both rows still succeed 55% of the time',
        says: '55%',
        engine: () => checkHit(critRange, 'Crit on 20'),
        exact: 11 / 20,
      },
      {
        phrase: 'Both rows still succeed 55% of the time',
        says: '55%',
        engine: () => checkHit(critRange, 'Crit on 19–20'),
        exact: 11 / 20,
      },
    ],
    // "doubles" and "misses as 0" are checked by their own tests below.
    setup: [
      '19 or 20',
      'instead of only a 20',
      'With +5 against AC 15',
      'counting misses as 0',
      'because a 19 already hits',
      'type 5 in its Mod box',
      'set Succeeds when to at least 15',
      'with a Modifier of 3',
      'It starts on face 20',
      'pick 19 as well',
    ],
  },
  'chance-to-hit-vs-ac': {
    claims: [
      { phrase: 'attack hits 55% of the time', says: '55%', engine: () => checkHit(toHit, 'Longsword vs AC 15'), exact: 11 / 20 },
      { phrase: 'you hit 55% of the time', says: '55%', engine: () => checkHit(toHit, 'Longsword vs AC 15'), exact: 11 / 20 },
      {
        phrase: '5% of attacks are critical hits',
        says: '5%',
        engine: () => checkCrit(toHit, 'Longsword vs AC 15'),
        exact: 1 / 20,
      },
      { phrase: 'crit 5%', says: '5%', engine: () => checkCrit(toHit, 'Longsword vs AC 15'), exact: 1 / 20 },
      {
        phrase: 'averages 4.35 damage per attack',
        says: '4.35',
        engine: () => meanOf(rowOf(toHit, 'Longsword vs AC 15')),
        exact: 87 / 20,
      },
      {
        phrase: 'averages 4.35 per attack',
        says: '4.35',
        engine: () => meanOf(rowOf(toHit, 'Longsword vs AC 15')),
        exact: 87 / 20,
      },
    ],
    setup: [
      'With +5 against AC 15',
      'on a natural 20',
      'Counting misses as 0',
      'At +5 against AC 15',
      'once misses count as 0',
      'type 5 in its Mod box',
      'set Succeeds when to at least 15',
      'set its Modifier to 3',
      'It starts on 20',
      'A natural 1',
      'once 1 plus your bonus',
    ],
  },
  'keep-highest-mixed-dice': {
    claims: [
      { phrase: 'averages about 5.23', says: '5.23', engine: () => meanOf(mixedRow), exact: 251 / 48 },
      { phrase: 'The best result is still 8', says: '8', engine: () => getRowData(mixedRow).stats.max, exact: 8 },
      { phrase: 'tops out at 8', says: '8', engine: () => getRowData(mixedRow).stats.max, exact: 8 },
      {
        phrase: 'a 1 or 2 comes up only 1 time in 12',
        says: '1 time in 12',
        engine: () => chanceWhere(distOf(mixedRow), (v) => v <= 2),
        exact: 1 / 12,
      },
      {
        phrase: 'lands on 1 or 2 only 1 time in 12',
        says: '1 time in 12',
        engine: () => chanceWhere(distOf(mixedRow), (v) => v <= 2),
        exact: 1 / 12,
      },
      {
        phrase: 'against 1 time in 4 on the d8 alone',
        says: '1 time in 4',
        engine: () => chanceWhere(distOf(onlySides(mixedRow, 8)), (v) => v <= 2),
        exact: 1 / 4,
      },
    ],
    setup: ['How many (n) at 1 of 2 dice'],
  },
  '2d6-vs-3d6-vs-1d20': {
    claims: [
      { phrase: 'both average 10.5', says: '10.5', engine: () => meanOf(d20Row), exact: 21 / 2 },
      { phrase: 'both average 10.5', says: '10.5', engine: () => meanOf(threeD6Row), exact: 21 / 2 },
      { phrase: 'equally likely at 5%', says: '5%', engine: () => evenChance(distOf(d20Row)), exact: 1 / 20 },
      { phrase: 'gives every result 5%', says: '5%', engine: () => evenChance(distOf(d20Row)), exact: 1 / 20 },
      {
        phrase: 'rolls an 18 only 1 time in 216',
        says: '1 time in 216',
        engine: () => chanceWhere(distOf(threeD6Row), (v) => v === 18),
        exact: 1 / 216,
      },
      {
        phrase: 'rolls an 18 just 1 time in 216',
        says: '1 time in 216',
        engine: () => chanceWhere(distOf(threeD6Row), (v) => v === 18),
        exact: 1 / 216,
      },
      { phrase: '2d6 averages 7', says: '7', engine: () => meanOf(twoD6Row), exact: 7 },
      {
        phrase: '2d6 averages 7, which is also its most common result',
        says: '7',
        engine: () => onlyMode(twoD6Row),
        exact: 7,
      },
      {
        phrase: 'its most common result at 1 roll in 6',
        says: '1 roll in 6',
        engine: () => chanceWhere(distOf(twoD6Row), (v) => v === 7),
        exact: 1 / 6,
      },
      { phrase: 'Mean reads 10.50, 10.50 and 7.00', says: '10.50', engine: () => meanOf(d20Row), exact: 21 / 2 },
      { phrase: 'Mean reads 10.50, 10.50 and 7.00', says: '10.50', engine: () => meanOf(threeD6Row), exact: 21 / 2 },
      { phrase: 'Mean reads 10.50, 10.50 and 7.00', says: '7.00', engine: () => meanOf(twoD6Row), exact: 7 },
    ],
    setup: ['set Count to 3', 'with a Count of 2'],
  },
};

const ONE_IN = /^(\d+|one) (?:roll |times? )?in (\d+)$/i;
const DECIMAL = /^(\d+)(?:\.(\d+))?(%?)$/;

/** The number a phrase states, and how far a correctly rounded value can sit from it. */
function readSays(says: string): { value: number; halfStep: number } {
  if (says === 'never') return { value: 0, halfStep: 0 };
  const odds = ONE_IN.exec(says);
  if (odds !== null) {
    const times = odds[1]?.toLowerCase() === 'one' ? 1 : Number(odds[1]);
    return { value: times / Number(odds[2]), halfStep: 0 };
  }
  const decimal = DECIMAL.exec(says);
  if (decimal === null) throw new Error(`cannot read the number in "${says}"`);
  const fraction = decimal[2] ?? '';
  const scale = decimal[3] === '%' ? 100 : 1;
  return {
    value: Number(`${decimal[1] ?? ''}.${fraction}0`) / scale,
    halfStep: 0.5 * 10 ** -fraction.length / scale,
  };
}

const CLAIMS = Object.entries(NUMBERS).flatMap(([slug, { claims }]) =>
  claims.map((claim) => ({ slug, ...claim })),
);

// Dice notation names the roll rather than stating a result: 4d6kh3, d10s,
// 2d6 + 3, 1d8 + 3.
const NOTATION = /\b\d*d\d+(?:k[hl]\d+)?s?\b(?:\s*\+\s*\d+)?/g;

/**
 * The text with every known phrase and every piece of dice notation blanked.
 * Phrases are matched against the original text, not removed one after
 * another, so two pins that overlap ("2d6 averages 7, which is also its most
 * common result" and "its most common result at 1 roll in 6") both count.
 */
function uncovered(text: string, phrases: readonly string[]): string {
  const covered = new Array<boolean>(text.length).fill(false);
  for (const phrase of phrases) {
    for (let at = text.indexOf(phrase); at !== -1; at = text.indexOf(phrase, at + 1)) {
      covered.fill(true, at, at + phrase.length);
    }
  }
  for (const match of text.matchAll(NOTATION)) {
    covered.fill(true, match.index, match.index + match[0].length);
  }
  return text
    .split('')
    .map((ch, i) => (covered[i] === true ? ' ' : ch))
    .join('');
}

function pageText(slug: string): string {
  return copyOf(pageFor(slug))
    .map((c) => c.text)
    .join('\n');
}

describe('recipe page numbers', () => {
  it.each(CLAIMS)('$slug: "$phrase" ($says) is what the engine computes', (claim) => {
    expect(pageText(claim.slug)).toContain(claim.phrase);
    expect(claim.phrase).toContain(claim.says);

    const value = claim.engine();
    expect(value).toBeCloseTo(claim.exact, 12);

    const stated = readSays(claim.says);
    if (/\breads\b/.test(claim.phrase)) {
      expect(formatNumber(value, 2)).toBe(claim.says);
    } else if (/\babout\b/.test(claim.phrase)) {
      expect(Math.abs(claim.exact - stated.value)).toBeLessThanOrEqual(stated.halfStep + 1e-12);
    } else {
      expect(claim.exact).toBeCloseTo(stated.value, 12);
    }
  });

  it('pins the numbers of every page, and of no other', () => {
    expect(Object.keys(NUMBERS).sort()).toEqual(RECIPE_PAGES.map((p) => p.slug).sort());
  });

  it('states no number that is neither pinned nor part of the setup', () => {
    for (const page of RECIPE_PAGES) {
      const numbers = NUMBERS[page.slug];
      if (numbers === undefined) throw new Error(`no numbers for ${page.slug}`);
      const known = [...numbers.claims.map((c) => c.phrase), ...numbers.setup];
      for (const { where, text } of copyOf(page)) {
        expect(uncovered(text, known), where).not.toMatch(/\d/);
      }
    }
  });

  it('lists only setup phrases the page still says', () => {
    for (const [slug, { setup }] of Object.entries(NUMBERS)) {
      const text = pageText(slug);
      for (const phrase of setup) expect(text, slug).toContain(phrase);
    }
  });
});

describe('recipe page comparisons', () => {
  it('advantage at +5 rounds to the same chance as a plain d20 with another +5', () => {
    const plusTen: Expression = { ...rowOf(advantage, 'Normal'), mods: [{ op: 'add', value: 10 }] };
    const another = hitOn(advantage, plusTen, 15);
    expect(another).toBeCloseTo(16 / 20, 12);
    expect(Math.round(hitAt(advantage, 'Advantage', 15) * 100)).toBe(Math.round(another * 100));
  });

  it('a 19 to 20 crit range doubles the crit chance of a 20-only one', () => {
    const ratio = checkCrit(critRange, 'Crit on 19–20') / checkCrit(critRange, 'Crit on 20');
    expect(ratio).toBeCloseTo(2, 12);
  });

  it('counts a miss as 0 damage, so a total of 0 is exactly as likely as a miss', () => {
    const rows = [
      ...critRange.recipe.rows.map((row) => ({ page: critRange, row })),
      ...toHit.recipe.rows.map((row) => ({ page: toHit, row })),
    ];
    for (const { page, row } of rows) {
      const zero = chanceWhere(distOf(row), (v) => v === 0);
      expect(zero, row.name).toBeCloseTo(1 - checkHit(page, row.name), 12);
      expect(zero, row.name).toBeCloseTo(9 / 20, 12);
    }
  });
});

interface ManifestSection {
  id: string;
  deps: string[];
}

function manifestSections(): ManifestSection[] {
  const parsed: unknown = JSON.parse(manifestJson);
  if (typeof parsed !== 'object' || parsed === null || !('sections' in parsed)) return [];
  const { sections } = parsed;
  if (!Array.isArray(sections)) return [];
  return sections.filter(
    (s: unknown): s is ManifestSection =>
      typeof s === 'object' &&
      s !== null &&
      'id' in s &&
      typeof s.id === 'string' &&
      'deps' in s &&
      Array.isArray(s.deps) &&
      s.deps.every((d: unknown) => typeof d === 'string'),
  );
}

const RECIPE_SECTION_PREFIX = 'seo.recipe.';

describe('recipe pages in the sitemap and the docs manifest', () => {
  it('lists every recipe page URL in the sitemap and no other recipe URL', () => {
    const recipeUrls = [...sitemapXml.matchAll(/<loc>([^<]*)<\/loc>/g)]
      .map((m) => m[1] ?? '')
      .filter((url) => url.includes('/recipes/'));
    expect(recipeUrls.sort()).toEqual(
      RECIPE_PAGES.map((p) => `${SITE}${recipePath(p.slug)}`).sort(),
    );
  });

  it('has exactly one recipe section per page in the docs manifest', () => {
    const ids = manifestSections()
      .map((s) => s.id)
      .filter((id) => id.startsWith(RECIPE_SECTION_PREFIX));
    expect(ids.sort()).toEqual(
      RECIPE_PAGES.map((p) => `${RECIPE_SECTION_PREFIX}${p.slug}`).sort(),
    );
  });

  it('points every section of the docs manifest at files that exist', () => {
    const sections = manifestSections();
    expect(sections.length).toBeGreaterThan(RECIPE_PAGES.length);
    for (const section of sections) {
      for (const dep of section.deps) expect(REPO_FILES.has(dep), `${section.id}: ${dep}`).toBe(true);
    }
  });
});

describe('recipe pages in llms.txt', () => {
  // A Windows checkout writes CRLF, and each answer has to end its line.
  const llms = llmsTxt.replace(/\r\n/g, '\n');

  it('gives each page its question, link and answer, word for word', () => {
    for (const page of RECIPE_PAGES) {
      expect(llms).toContain(`- [${page.heading}](${SITE}${recipePath(page.slug)}): ${page.intro}\n`);
    }
  });

  it('links every recipe page once and no page that does not exist', () => {
    const linked = [...llms.matchAll(/\(https:\/\/dice-table\.app\/recipes\/([^)]+)\)/g)].map((m) => m[1]);
    expect(linked.sort()).toEqual(RECIPE_PAGES.map((p) => p.slug).sort());
  });
});

describe('recipe page lookup', () => {
  it('finds a page by its slug', () => {
    expect(findRecipePage('exploding-dice')?.recipe.slug).toBe('exploding-dice');
  });

  it('finds every page by its own slug', () => {
    for (const page of RECIPE_PAGES) expect(findRecipePage(page.slug)).toBe(page);
  });

  it('returns undefined for a slug no page has', () => {
    expect(findRecipePage('no-such-recipe')).toBeUndefined();
  });

  it('returns undefined when there is no slug at all', () => {
    expect(findRecipePage(undefined)).toBeUndefined();
  });

  it('does not match a library recipe slug that is not a page slug', () => {
    // ability-score seeds the 4d6 page, but the route slug is the search phrasing.
    expect(findRecipePage('ability-score')).toBeUndefined();
  });

  it('builds the route for a slug under /recipes/', () => {
    expect(recipePath('4d6-drop-lowest')).toBe('/recipes/4d6-drop-lowest');
  });

  it('labels a page by its title without the site name', () => {
    expect(recipePageLabel(pageFor('exploding-dice'))).toBe('Exploding dice: average and odds');
  });

  it('labels every page without the site name', () => {
    for (const p of RECIPE_PAGES) expect(recipePageLabel(p)).not.toMatch(/DiceTable/);
  });
});
