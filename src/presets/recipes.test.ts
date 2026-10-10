import { describe, expect, it } from 'vitest';
import type { DicePart, Distribution, Expression } from '../types';
import { RECIPES } from './recipes';
import { STARTER_PRESETS, type RecipeFamily, type StarterPreset } from './starterRolls';
import { beatChance } from '../engine/compare';
import { getRowData } from '../state/useDistributions';
import { validateExpression } from '../state/persistedSchema';
import { normalizeExpression } from '../state/normalize';

function findRecipe(slug: string): StarterPreset {
  const found = RECIPES.find((r) => r.slug === slug);
  if (found === undefined) throw new Error(`no recipe with slug ${slug}`);
  return found;
}

function findRow(slug: string, name: string): Expression {
  const found = findRecipe(slug).rows.find((r) => r.name === name);
  if (found === undefined) throw new Error(`recipe ${slug} has no row named ${name}`);
  return found;
}

function distOf(slug: string, name: string): Distribution {
  return getRowData(findRow(slug, name)).dist;
}

function chanceWhere(dist: Distribution, test: (value: number) => boolean): number {
  let total = 0;
  for (const [value, p] of dist) if (test(value)) total += p;
  return total;
}

/** The same row rolling a different number of dice, as a user editing the count would. */
function withCount(row: Expression, count: number): Expression {
  return { ...row, parts: row.parts.map((p) => ({ ...p, count })) };
}

type Odds =
  | { atLeast: number; p: number }
  | { atMost: number; p: number }
  | { exactly: number; p: number }
  | { from: number; to: number; p: number };

function readOdds(dist: Distribution, odds: Odds): { label: string; value: number } {
  if ('atLeast' in odds) {
    return { label: `P(>= ${odds.atLeast})`, value: chanceWhere(dist, (v) => v >= odds.atLeast) };
  }
  if ('atMost' in odds) {
    return { label: `P(<= ${odds.atMost})`, value: chanceWhere(dist, (v) => v <= odds.atMost) };
  }
  if ('exactly' in odds) {
    return { label: `P(= ${odds.exactly})`, value: chanceWhere(dist, (v) => v === odds.exactly) };
  }
  return {
    label: `P(${odds.from} to ${odds.to})`,
    value: chanceWhere(dist, (v) => v >= odds.from && v <= odds.to),
  };
}

interface RowPin {
  mean: number;
  min: number;
  max: number;
  odds?: readonly Odds[];
  /** Check rows: the chance to hit (crits included) and to crit, as the row reports them. */
  check?: { hit: number; crit: number };
}

// Every value below is the exact fraction from the "Derived numbers" bullets of
// .claude/plans/recipes-and-custom-mods.recipe-audit.md, derived there by
// enumerating the game rule rather than by running the engine. Where the audit
// separates the engine's capped explosions from the uncapped game rule, the pin
// is the capped value, since that is what the row shows.
const PINS: Readonly<Record<string, Readonly<Record<string, RowPin>>>> = {
  'fate-dice': {
    'Four Fate dice': {
      mean: 0,
      min: -4,
      max: 4,
      odds: [
        { exactly: 0, p: 19 / 81 },
        { atLeast: 2, p: 5 / 27 },
      ],
    },
  },
  'great-weapon-fighting': {
    'Greatsword with GWF': { mean: 34 / 3, min: 5, max: 15 },
  },
  'roll-and-keep': {
    // The numerator is past 2^53, so it is written as a BigInt and rounded once.
    'Roll 5, keep 3': {
      mean: Number(9805042010693925543215828197885939255432158332649926499n) / 4e53,
      min: 3,
      max: 330,
      odds: [
        { atLeast: 20, p: 35897 / 50000 },
        { atLeast: 25, p: 416697 / 1000000 },
      ],
    },
  },
  'lancer-crit': {
    'Normal hit': { mean: 21 / 2, min: 3, max: 18 },
    'Critical hit': {
      mean: 110993 / 7776,
      min: 3,
      max: 18,
      odds: [
        { atLeast: 15, p: 11881 / 23328 },
        { atLeast: 18, p: 1453 / 23328 },
      ],
    },
  },
  // The audit has no section for this recipe. These are plain counts over 20,
  // 216 and 36 equally likely outcomes: 27 of the 216 ways to roll 3d6 total 10.
  'dice-shapes': {
    '1d20': { mean: 21 / 2, min: 1, max: 20, odds: [{ exactly: 10, p: 1 / 20 }] },
    '3d6': {
      mean: 21 / 2,
      min: 3,
      max: 18,
      odds: [
        { exactly: 10, p: 27 / 216 },
        { exactly: 3, p: 1 / 216 },
      ],
    },
    '2d6': {
      mean: 7,
      min: 2,
      max: 12,
      odds: [
        { exactly: 7, p: 6 / 36 },
        { exactly: 2, p: 1 / 36 },
      ],
    },
  },
  'daggerheart-duality': {
    'Duality dice +2': { mean: 15, min: 4, max: 26, odds: [{ atLeast: 12, p: 3 / 4 }] },
    'With advantage': { mean: 37 / 2, min: 5, max: 32, odds: [{ atLeast: 12, p: 781 / 864 }] },
  },
  'blades-action': {
    'Best of 2d6': {
      mean: 161 / 36,
      min: 1,
      max: 6,
      odds: [
        { exactly: 6, p: 11 / 36 },
        { from: 4, to: 5, p: 4 / 9 },
        { atMost: 3, p: 1 / 4 },
      ],
    },
    'Sixes in 2d6': {
      mean: 1 / 3,
      min: 0,
      max: 2,
      odds: [
        { atLeast: 2, p: 1 / 36 },
        { exactly: 1, p: 5 / 18 },
        { exactly: 0, p: 25 / 36 },
      ],
    },
  },
  'blades-resistance': {
    'Resistance stress': {
      mean: 55 / 36,
      min: 0,
      max: 5,
      odds: [
        { exactly: 0, p: 11 / 36 },
        { exactly: 1, p: 1 / 4 },
        { exactly: 5, p: 1 / 36 },
      ],
    },
  },
  'shadowrun-hits': {
    'Hits on 8d6': {
      mean: 8 / 3,
      min: 0,
      max: 8,
      odds: [
        { atLeast: 3, p: 1163 / 2187 },
        { atLeast: 1, p: 6305 / 6561 },
      ],
    },
  },
  'burning-wheel': {
    'Successes on 4d6': { mean: 2, min: 0, max: 4, odds: [{ atLeast: 2, p: 11 / 16 }] },
  },
  'year-zero-push': {
    'First roll': {
      mean: 5 / 6,
      min: 0,
      max: 5,
      odds: [
        { atLeast: 1, p: 4651 / 7776 },
        { exactly: 0, p: 3125 / 7776 },
      ],
    },
    'After a push': {
      mean: 25 / 18,
      min: 0,
      max: 5,
      odds: [
        { atLeast: 1, p: 1518275 / 1889568 },
        { exactly: 0, p: 371293 / 1889568 },
      ],
    },
  },
  'warhammer-unsaved-wounds': {
    'Unsaved wounds, 10 attacks': {
      mean: 20 / 9,
      min: 0,
      max: 10,
      odds: [
        { atLeast: 3, p: 151063648 / 387420489 },
        { atLeast: 1, p: 3204309152 / 3486784401 },
      ],
    },
  },
  'advantage-vs-disadvantage': {
    Normal: { mean: 31 / 2, min: 6, max: 25, odds: [{ atLeast: 15, p: 11 / 20 }] },
    Advantage: { mean: 753 / 40, min: 6, max: 25, odds: [{ atLeast: 15, p: 319 / 400 }] },
    Disadvantage: { mean: 487 / 40, min: 6, max: 25, odds: [{ atLeast: 15, p: 121 / 400 }] },
  },
  'elven-accuracy': {
    Advantage: { mean: 753 / 40, min: 6, max: 25, odds: [{ atLeast: 20, p: 51 / 100 }] },
    'Elven Accuracy': {
      mean: 1639 / 80,
      min: 6,
      max: 25,
      // A total of 25 is a kept natural 20, which is the crit chance.
      odds: [
        { atLeast: 20, p: 657 / 1000 },
        { exactly: 25, p: 1141 / 8000 },
      ],
    },
  },
  'halfling-lucky': {
    'Halfling Lucky': { mean: 639 / 40, min: 6, max: 25, odds: [{ exactly: 6, p: 1 / 400 }] },
  },
  'traveller-boon-bane': {
    'Plain 2d6': { mean: 7, min: 2, max: 12, odds: [{ atLeast: 8, p: 5 / 12 }] },
    Boon: { mean: 203 / 24, min: 2, max: 12, odds: [{ atLeast: 8, p: 49 / 72 }] },
    Bane: { mean: 133 / 24, min: 2, max: 12, odds: [{ atLeast: 8, p: 7 / 36 }] },
  },
  'savage-worlds-trait': {
    // The numerator is past 2^53, so it is written as a BigInt and rounded once.
    'd8 trait + wild die': {
      mean: Number(35052217285573297n) / 5410421842378752,
      min: 1,
      max: 88,
      odds: [
        { atLeast: 4, p: 13 / 16 },
        { atLeast: 8, p: 71 / 288 },
      ],
    },
  },
  'keep-highest-mixed': {
    'Best of d6 and d8': {
      mean: 251 / 48,
      min: 1,
      max: 8,
      odds: [
        { atLeast: 6, p: 23 / 48 },
        { atMost: 2, p: 1 / 12 },
      ],
    },
  },
  'contested-check': {
    'Attacker +5': { mean: 31 / 2, min: 6, max: 25 },
    'Defender +3': { mean: 27 / 2, min: 4, max: 23 },
  },
  'ironsworn-action': {
    'Action score +2': { mean: 11 / 2, min: 3, max: 8 },
    'Higher challenge die': { mean: 143 / 20, min: 1, max: 10 },
    'Lower challenge die': { mean: 77 / 20, min: 1, max: 10 },
  },
  'pbta-move': {
    'Move at +1': {
      mean: 8,
      min: 3,
      max: 13,
      odds: [
        { atLeast: 10, p: 5 / 18 },
        { from: 7, to: 9, p: 4 / 9 },
        { atMost: 6, p: 5 / 18 },
      ],
    },
  },
  'attack-with-damage': {
    'Longsword vs AC 15': {
      mean: 87 / 20,
      min: 0,
      max: 19,
      odds: [{ exactly: 0, p: 9 / 20 }],
      check: { hit: 11 / 20, crit: 1 / 20 },
    },
  },
  'champion-crit': {
    'Crit on 20': { mean: 87 / 20, min: 0, max: 19, check: { hit: 11 / 20, crit: 1 / 20 } },
    'Crit on 19–20': { mean: 183 / 40, min: 0, max: 19, check: { hit: 11 / 20, crit: 1 / 10 } },
  },
  'gurps-margin': {
    'Margin at skill 12': {
      mean: 3 / 2,
      min: -6,
      max: 9,
      odds: [
        { atLeast: 0, p: 20 / 27 },
        { atLeast: 5, p: 35 / 216 },
      ],
    },
  },
  'percentile-roll-under': {
    'Percentile roll': {
      mean: 101 / 2,
      min: 1,
      max: 100,
      odds: [
        { atMost: 50, p: 1 / 2 },
        { atMost: 25, p: 1 / 4 },
        { atMost: 10, p: 1 / 10 },
      ],
    },
  },
};

const LIBRARY = RECIPES.slice(STARTER_PRESETS.length);

describe('library recipe numbers', () => {
  it.each(LIBRARY.map((r) => r.slug))('%s rows show the audited mean, range and odds', (slug) => {
    const pins = PINS[slug];
    if (pins === undefined) throw new Error(`no pins for ${slug}`);
    for (const [name, pin] of Object.entries(pins)) {
      const data = getRowData(findRow(slug, name));
      const where = `${slug} / ${name}`;
      expect(data.stats.hasDist, where).toBe(true);
      expect(data.stats.mean, `${where} mean`).toBeCloseTo(pin.mean, 12);
      expect(data.stats.min, `${where} min`).toBe(pin.min);
      expect(data.stats.max, `${where} max`).toBe(pin.max);
      for (const odds of pin.odds ?? []) {
        const { label, value } = readOdds(data.dist, odds);
        expect(value, `${where} ${label}`).toBeCloseTo(odds.p, 12);
      }
      if (pin.check !== undefined) {
        const chances = data.checkChances;
        if (chances === null) throw new Error(`${where} has no check chances`);
        expect(chances.success + chances.crit, `${where} hit`).toBeCloseTo(pin.check.hit, 12);
        expect(chances.crit, `${where} crit`).toBeCloseTo(pin.check.crit, 12);
      }
    }
  });

  it('pins every row of every library recipe, and nothing else', () => {
    expect(Object.keys(PINS).sort()).toEqual(LIBRARY.map((r) => r.slug).sort());
    for (const recipe of LIBRARY) {
      const pinned = Object.keys(PINS[recipe.slug] ?? {}).sort();
      expect(recipe.rows.map((r) => r.name).sort(), recipe.slug).toEqual(pinned);
    }
  });

  it('Ironsworn reads a strong hit off the higher challenge die and any hit off the lower', () => {
    const action = distOf('ironsworn-action', 'Action score +2');
    const strong = beatChance(action, distOf('ironsworn-action', 'Higher challenge die'));
    const anyHit = beatChance(action, distOf('ironsworn-action', 'Lower challenge die'));
    expect(strong.win).toBeCloseTo(139 / 600, 12);
    expect(anyHit.win).toBeCloseTo(401 / 600, 12);
    expect(anyHit.win - strong.win).toBeCloseTo(131 / 300, 12);
    expect(1 - anyHit.win).toBeCloseTo(199 / 600, 12);
  });

  it('Ironsworn ties with either challenge die one time in ten', () => {
    const action = distOf('ironsworn-action', 'Action score +2');
    expect(beatChance(action, distOf('ironsworn-action', 'Higher challenge die')).tie).toBeCloseTo(
      1 / 10,
      12,
    );
    expect(beatChance(action, distOf('ironsworn-action', 'Lower challenge die')).tie).toBeCloseTo(
      1 / 10,
      12,
    );
  });

  it('the contested check splits into attacker wins, ties and defender wins', () => {
    const attacker = distOf('contested-check', 'Attacker +5');
    const defender = distOf('contested-check', 'Defender +3');
    const forward = beatChance(attacker, defender);
    expect(forward.win).toBeCloseTo(229 / 400, 12);
    expect(forward.tie).toBeCloseTo(9 / 200, 12);
    expect(beatChance(defender, attacker).win).toBeCloseTo(153 / 400, 12);
  });

  it('more Blades dice raise the crit chance to 2/27 at three and 19/144 at four', () => {
    const sixes = findRow('blades-action', 'Sixes in 2d6');
    const crit = (count: number): number =>
      chanceWhere(getRowData(withCount(sixes, count)).dist, (v) => v >= 2);
    expect(crit(3)).toBeCloseTo(2 / 27, 12);
    expect(crit(4)).toBeCloseTo(19 / 144, 12);
  });

  it('the best of seven Blades dice is a 6 with chance 201811/279936', () => {
    const best = withCount(findRow('blades-action', 'Best of 2d6'), 7);
    expect(chanceWhere(getRowData(best).dist, (v) => v === 6)).toBeCloseTo(201811 / 279936, 12);
  });

  // The audit derives the uncapped game rule separately: the ten-explosion cap
  // costs the Savage Worlds mean about 1.2e-8 and the 5k3 mean about 3e-10, so
  // these two compare at the precision that gap allows rather than at 12 places.
  it('capping explosions at ten barely moves the exploding recipes from the uncapped rule', () => {
    const savage = getRowData(findRow('savage-worlds-trait', 'd8 trait + wild die')).stats.mean;
    const rollAndKeep = getRowData(findRow('roll-and-keep', 'Roll 5, keep 3')).stats.mean;
    expect(savage).toBeCloseTo(21494566 / 3317755, 7);
    expect(rollAndKeep).toBeCloseTo(27508315 / 1122211, 8);
  });
});

describe('headline pins', () => {
  it('four Fate dice land on 0 with chance 19/81', () => {
    expect(distOf('fate-dice', 'Four Fate dice').get(0)).toBeCloseTo(19 / 81, 12);
  });

  it('a Savage Worlds d8 trait with a d6 wild die reaches 4 with chance 13/16', () => {
    const dist = distOf('savage-worlds-trait', 'd8 trait + wild die');
    // 13/16 is 0.8125, the "about 81%" the recipe's why quotes.
    expect(chanceWhere(dist, (v) => v >= 4)).toBeCloseTo(13 / 16, 12);
  });

  it('seven Blades dice crit (two or more sixes) with chance 7703/23328', () => {
    const sevenDice = withCount(findRow('blades-action', 'Sixes in 2d6'), 7);
    expect(chanceWhere(getRowData(sevenDice).dist, (v) => v >= 2)).toBeCloseTo(7703 / 23328, 12);
  });

  it('a Lancer 3d6 crit averages 110993/7776, not the per-die reading of 161/12', () => {
    const mean = getRowData(findRow('lancer-crit', 'Critical hit')).stats.mean;
    expect(mean).toBeCloseTo(110993 / 7776, 12);
    expect(mean).not.toBeCloseTo(161 / 12, 1);
  });
});

// Keyed by family so that adding one to RecipeFamily stops this file compiling
// until it is listed here, instead of quietly going unchecked.
const FAMILIES: Readonly<Record<RecipeFamily, RecipeFamily>> = {
  totals: 'totals',
  successes: 'successes',
  advantage: 'advantage',
  opposed: 'opposed',
  margin: 'margin',
};

const ALL_ROWS: readonly Expression[] = RECIPES.flatMap((r) => r.rows);

function allPartIds(row: Expression): string[] {
  const effectParts: readonly DicePart[] = row.check?.effect.parts ?? [];
  return [...row.parts, ...effectParts].map((p) => p.id);
}

describe('recipe library integrity', () => {
  it('lists the eight starters first, then the 25 library recipes', () => {
    expect(RECIPES.slice(0, STARTER_PRESETS.length)).toEqual(STARTER_PRESETS);
    expect(LIBRARY).toHaveLength(25);
  });

  it('gives every recipe a unique kebab-case slug', () => {
    const slugs = RECIPES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('uses every row id and part id once across the whole library, check effects included', () => {
    const ids = ALL_ROWS.flatMap((row) => [row.id, ...allPartIds(row)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every row survives a JSON round trip through the persisted-state validator intact', () => {
    for (const row of ALL_ROWS) {
      const roundTripped: unknown = JSON.parse(JSON.stringify(row));
      expect(validateExpression(roundTripped), row.id).toStrictEqual(row);
    }
  });

  it('every row is already normalized, so adding it changes nothing', () => {
    for (const row of ALL_ROWS) {
      expect(normalizeExpression(row), row.id).toStrictEqual(row);
    }
  });

  it('every row computes a distribution instead of reading as too complex', () => {
    for (const row of ALL_ROWS) {
      const data = getRowData(row);
      expect(data.tooComplex, row.id).toBe(false);
      expect(data.dist.size, row.id).toBeGreaterThan(0);
    }
  });

  it('every family has at least one recipe', () => {
    for (const family of Object.values(FAMILIES)) {
      expect(
        RECIPES.some((r) => r.family === family),
        family,
      ).toBe(true);
    }
  });

  it('every recipe has a name, a why, its dice and at least one row', () => {
    for (const recipe of RECIPES) {
      expect(recipe.name.trim(), recipe.slug).not.toBe('');
      expect(recipe.why.trim(), recipe.slug).not.toBe('');
      expect(recipe.dice.trim(), recipe.slug).not.toBe('');
      expect(recipe.rows.length, recipe.slug).toBeGreaterThan(0);
    }
  });
});
