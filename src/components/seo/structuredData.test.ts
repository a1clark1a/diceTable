import { describe, expect, it } from 'vitest';
import { buildHowToLd, type HowToStepInput } from './structuredData';

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

  it('maps each step to a HowToStep with name=title and text=plain', () => {
    const ld = buildHowToLd('Guide', 'A guide.', steps);
    expect(ld.step).toEqual([
      { '@type': 'HowToStep', name: 'First', text: 'Do the first thing.' },
      { '@type': 'HowToStep', name: 'Second', text: 'Then the second.' },
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
