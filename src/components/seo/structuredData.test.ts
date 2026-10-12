import { describe, expect, it } from 'vitest';
import {
  buildDefinedTermSetLd,
  buildHowToLd,
  buildItemListLd,
  type DefinedTermInput,
  type HowToStepInput,
  type ItemListInput,
} from './structuredData';

const steps: readonly HowToStepInput[] = [
  { title: 'First', plain: 'Do the first thing.' },
  { title: 'Second', plain: 'Then the second.' },
];

describe('buildHowToLd', () => {
  it('tags the object as a schema.org HowTo', () => {
    const ld = buildHowToLd('Guide', 'A guide.', steps);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('HowTo');
  });

  it('passes name and description through', () => {
    const ld = buildHowToLd('Guide', 'A guide.', steps);
    expect(ld.name).toBe('Guide');
    expect(ld.description).toBe('A guide.');
  });

  it('maps each step to a positioned HowToStep with name=title and text=plain', () => {
    const ld = buildHowToLd('Guide', 'A guide.', steps);
    expect(ld.step).toEqual([
      { '@type': 'HowToStep', position: 1, name: 'First', text: 'Do the first thing.' },
      { '@type': 'HowToStep', position: 2, name: 'Second', text: 'Then the second.' },
    ]);
  });

  it('preserves step order', () => {
    const ld = buildHowToLd('Guide', 'A guide.', steps);
    expect(ld.step.map((s) => s.name)).toEqual(['First', 'Second']);
  });

  it('returns an empty step list when given no steps', () => {
    const ld = buildHowToLd('Guide', 'A guide.', []);
    expect(ld.step).toEqual([]);
  });
});

const SET_URL = 'https://dice-table.app/docs/glossary';

const entries: readonly DefinedTermInput[] = [
  { term: 'Mean', plain: 'The long-run average.' },
  {
    term: 'Keep highest',
    plain: 'Keep only the highest N dice.',
    details: 'The rest are dropped before summing.',
    alt: 'khN',
  },
];

describe('buildDefinedTermSetLd', () => {
  it('tags the object as a schema.org DefinedTermSet identified by its URL', () => {
    const ld = buildDefinedTermSetLd('Glossary', 'Terms.', SET_URL, entries);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('DefinedTermSet');
    expect(ld['@id']).toBe(SET_URL);
    expect(ld.name).toBe('Glossary');
    expect(ld.description).toBe('Terms.');
  });

  it('uses plain as the description when an entry has no details', () => {
    const ld = buildDefinedTermSetLd('Glossary', 'Terms.', SET_URL, entries);
    expect(ld.hasDefinedTerm[0]).toEqual({
      '@type': 'DefinedTerm',
      name: 'Mean',
      description: 'The long-run average.',
      inDefinedTermSet: SET_URL,
    });
  });

  it('appends details after plain and carries alt as alternateName', () => {
    const ld = buildDefinedTermSetLd('Glossary', 'Terms.', SET_URL, entries);
    expect(ld.hasDefinedTerm[1]).toEqual({
      '@type': 'DefinedTerm',
      name: 'Keep highest',
      description:
        'Keep only the highest N dice. The rest are dropped before summing.',
      alternateName: 'khN',
      inDefinedTermSet: SET_URL,
    });
  });

  it('omits the alternateName key entirely when alt is absent', () => {
    const ld = buildDefinedTermSetLd('Glossary', 'Terms.', SET_URL, entries);
    expect('alternateName' in (ld.hasDefinedTerm[0] ?? {})).toBe(false);
  });

  it('skips alts that are display examples rather than aliases', () => {
    const ld = buildDefinedTermSetLd('Glossary', 'Terms.', SET_URL, [
      { term: 'Dice expression', plain: 'The whole formula.', alt: 'e.g. 4d6kh3+2' },
    ]);
    expect('alternateName' in (ld.hasDefinedTerm[0] ?? {})).toBe(false);
  });

  it('preserves entry order', () => {
    const ld = buildDefinedTermSetLd('Glossary', 'Terms.', SET_URL, entries);
    expect(ld.hasDefinedTerm.map((t) => t.name)).toEqual([
      'Mean',
      'Keep highest',
    ]);
  });

  it('returns an empty term list when given no entries', () => {
    const ld = buildDefinedTermSetLd('Glossary', 'Terms.', SET_URL, []);
    expect(ld.hasDefinedTerm).toEqual([]);
  });
});

const LIST_URL = 'https://dice-table.app/docs/questions';

const items: readonly ItemListInput[] = [
  { name: 'How much is advantage worth?', url: 'https://dice-table.app/recipes/advantage-vs-disadvantage' },
  { name: 'How much do exploding dice add?', url: 'https://dice-table.app/recipes/exploding-dice' },
];

describe('buildItemListLd', () => {
  it('tags the object as a schema.org ItemList identified by its URL', () => {
    const ld = buildItemListLd('Questions', 'Every question.', LIST_URL, items);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('ItemList');
    expect(ld['@id']).toBe(LIST_URL);
    expect(ld.name).toBe('Questions');
    expect(ld.description).toBe('Every question.');
  });

  it('maps each item to a ListItem positioned from 1, keeping its name and url', () => {
    const ld = buildItemListLd('Questions', 'Every question.', LIST_URL, items);
    expect(ld.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'How much is advantage worth?',
        url: 'https://dice-table.app/recipes/advantage-vs-disadvantage',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'How much do exploding dice add?',
        url: 'https://dice-table.app/recipes/exploding-dice',
      },
    ]);
  });

  it('returns an empty list when given no items', () => {
    const ld = buildItemListLd('Questions', 'Every question.', LIST_URL, []);
    expect(ld.itemListElement).toEqual([]);
  });
});
