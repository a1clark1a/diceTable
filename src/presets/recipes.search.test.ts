import { describe, expect, it } from 'vitest';
import { RECIPES, filterRecipes } from './recipes';
import type { RecipeFamily } from './starterRolls';

function slugs(query: string, family: RecipeFamily | null = null): string[] {
  return filterRecipes(RECIPES, query, family).map((r) => r.slug);
}

const ALL_SLUGS = RECIPES.map((r) => r.slug);

describe('filterRecipes: the plan acceptance queries', () => {
  it('finds both Blades recipes for "Blades"', () => {
    expect(slugs('Blades')).toEqual(['blades-action', 'blades-resistance']);
  });

  it('finds the Blades resistance roll for "resistance"', () => {
    expect(slugs('resistance')).toEqual(['blades-resistance']);
  });

  it('finds both Forged in the Dark recipes for "Forged"', () => {
    expect(slugs('Forged')).toEqual(['blades-action', 'blades-resistance']);
  });

  it('finds roll-and-keep for "L5R"', () => {
    expect(slugs('L5R')).toEqual(['roll-and-keep']);
  });
});

describe('filterRecipes: how a query word matches', () => {
  it('does not match "forged" inside Starforged, so Ironsworn stays out', () => {
    // Without this control the absence could pass just because the Starforged
    // alias was removed from the data.
    expect(slugs('starforged')).toContain('ironsworn-action');
    expect(slugs('forged')).not.toContain('ironsworn-action');
  });

  it('matches a partial word against the start of a longer word', () => {
    expect(slugs('torch')).toEqual(['burning-wheel']);
  });

  it('matches a word with a digit anywhere inside a word of dice notation', () => {
    // Lancer's only d6s sit inside "3d6" and "6d6kh3", so no word starts with d6.
    expect(slugs('d6')).toContain('lancer-crit');
  });

  it('keeps only recipes that match every word, so a second word narrows', () => {
    expect(slugs('blades stress')).toEqual(['blades-resistance']);
  });

  it('returns nothing when one word matches no recipe, even if the others do', () => {
    expect(slugs('blades zzz')).toEqual([]);
  });

  it('returns nothing for a nonsense query', () => {
    expect(slugs('xyzzy')).toEqual([]);
  });
});

describe('filterRecipes: case, punctuation and accents', () => {
  it('ignores case in the query', () => {
    expect(slugs('BLADES')).toEqual(['blades-action', 'blades-resistance']);
  });

  it('ignores punctuation in the query', () => {
    expect(slugs('(L5R)')).toEqual(['roll-and-keep']);
  });

  it('splits recipe text at punctuation, so a word right after a bracket is found', () => {
    // "Burning Wheel (black shade)": unsplit, the word would be "(black".
    expect(slugs('black')).toEqual(['burning-wheel']);
  });

  it('splits recipe text at a hyphen, so the second half of Two-hander is a word', () => {
    expect(slugs('hander')).toEqual(['two-hander']);
  });

  it('finds the Warhammer recipe for "40k"', () => {
    expect(slugs('40k')).toEqual(['warhammer-unsaved-wounds']);
  });

  it('treats an accented query like the plain one', () => {
    expect(slugs('blädes')).toEqual(['blades-action', 'blades-resistance']);
  });
});

describe('filterRecipes: queries with no words', () => {
  it('returns every recipe in library order for an empty query', () => {
    expect(slugs('')).toEqual(ALL_SLUGS);
  });

  it('returns every recipe in library order for a whitespace-only query', () => {
    expect(slugs('   \t  ')).toEqual(ALL_SLUGS);
  });

  it('returns every recipe for a query that is only punctuation', () => {
    expect(slugs('?!-')).toEqual(ALL_SLUGS);
  });
});

describe('filterRecipes: family filter', () => {
  it('returns exactly one family, starters first, in library order', () => {
    expect(slugs('', 'margin')).toEqual([
      'save-dc-check',
      'pbta-move',
      'attack-with-damage',
      'champion-crit',
      'gurps-margin',
      'percentile-roll-under',
    ]);
  });

  it('keeps only recipes that are in the family and match the query', () => {
    expect(slugs('blades', 'successes')).toEqual(['blades-action']);
  });

  it('returns nothing when the query only matches recipes in other families', () => {
    expect(slugs('blades', 'opposed')).toEqual([]);
  });
});

describe('filterRecipes: which text is searched', () => {
  it('searches row names, not only the recipe title', () => {
    // "Sixes" appears only in the row "Sixes in 2d6".
    expect(slugs('sixes')).toEqual(['blades-action']);
  });

  it('searches the "also called" names', () => {
    expect(slugs('cthulhu')).toEqual(['percentile-roll-under']);
  });

  it('searches the plain sentence that explains the recipe', () => {
    // Year Zero's "banes" is only in its explanation; Traveller's "bane" is
    // shorter than the query, so it does not match.
    expect(slugs('banes')).toEqual(['year-zero-push']);
  });
});
