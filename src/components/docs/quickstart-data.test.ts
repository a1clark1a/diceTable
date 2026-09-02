import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { quickstartSteps, type QuickstartStep } from './quickstart-data';
import { defaultPart } from '../../state/defaultPart';
import { expressionNotation } from '../../share/notation';
import type { Expression } from '../../types';

function step(title: string): QuickstartStep {
  const found = quickstartSteps.find((s) => s.title === title);
  if (found === undefined) throw new Error(`no quickstart step titled "${title}"`);
  return found;
}

// The JSX body is what the docs page shows. Its textContent is the sentence a
// reader ends up with once JSX has collapsed the source line breaks to spaces.
function bodyText(s: QuickstartStep): string {
  const { container } = render(
    createElement(ChakraProvider, { value: defaultSystem, children: s.body }),
  );
  return container.textContent ?? '';
}

const sumRow: Expression = {
  id: 'e',
  name: 'row',
  parts: [],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};

describe('quickstartSteps numbering', () => {
  it('numbers the steps 1 through 11 in array order', () => {
    // The page badge shows step.n while the HowTo structured data numbers by
    // array index + 1, so the two only agree while n is the plain sequence.
    expect(quickstartSteps.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('gives every step its own title', () => {
    const titles = quickstartSteps.map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('quickstartSteps plain summaries', () => {
  it('ends every summary with a full stop', () => {
    for (const s of quickstartSteps) {
      expect(s.plain.trim().endsWith('.'), `step ${s.n} "${s.title}"`).toBe(true);
    }
  });

  it('keeps every summary free of tags, entities and em-dashes', () => {
    // plain ships verbatim as HowToStep.text in JSON-LD, so a <Code> tag or an
    // &amp; copied over from the JSX would reach crawlers as is.
    for (const s of quickstartSteps) {
      expect(s.plain, `step ${s.n} "${s.title}"`).not.toMatch(/—|&#?\w+;|<\/?[A-Za-z]/);
    }
  });
});

describe('quickstart cross-references', () => {
  it('names the die that Add roll really creates', () => {
    const fresh = defaultPart();
    const die = `${fresh.count}d${fresh.sides}`;
    expect(die).toBe('1d20');
    const first = step('Add your first roll');
    expect(first.plain).toContain(`default ${die}`);
    expect(bodyText(first)).toContain(`default ${die}`);
  });

  it('sends the notation reader to the check step by its real number', () => {
    const check = step('Roll a check, then apply an effect');
    expect(bodyText(step('Read dice notation'))).toContain(`Step ${check.n} covers it`);
  });

  // Inserting a step renumbers everything after it; these two pointers at the
  // targets step went stale once before.
  it('sends the chart reader to the targets step by its real number', () => {
    const targets = step('Set targets and read Hit %');
    expect(bodyText(step('Read the chart'))).toContain(`(Step ${targets.n})`);
  });

  it('sends the workshop-views reader to the targets step by its real number', () => {
    const targets = step('Set targets and read Hit %');
    expect(bodyText(step('Switch workshop views'))).toContain(`from Step ${targets.n})`);
  });

  it('names the same mode toggle in the notation summary as in its body', () => {
    const notation = step('Read dice notation');
    expect(bodyText(notation)).toContain('Sum / Pool / Check');
    expect(notation.plain).toContain('Sum / Pool / Check');
  });
});

describe('quickstart notation examples', () => {
  it('shows the check example exactly as the app prints an attack roll', () => {
    const attack: Expression = {
      ...sumRow,
      parts: [{ id: 'd20', count: 1, sides: 20 }],
      flatModifier: 7,
      mode: 'check',
      check: {
        threshold: { direction: 'gte', value: 15 },
        effect: { parts: [{ id: 'd8', count: 1, sides: 8 }], flatModifier: 4 },
        onSuccess: 'full',
        onFailure: 'none',
      },
    };
    // '1d20' + ' + 7' for the check, then ' ≥15 → ' + '1d8' + ' + 4' for the effect.
    const printed = expressionNotation(attack);
    expect(printed).toBe('1d20 + 7 ≥15 → 1d8 + 4');
    expect(bodyText(step('Roll a check, then apply an effect'))).toContain(printed);
    expect(bodyText(step('Read dice notation'))).toContain(printed);
  });

  it('shows the pool example exactly as the app prints a d10 pool', () => {
    const pool: Expression = {
      ...sumRow,
      parts: [{ id: 'p', count: 7, sides: 10 }],
      mode: 'pool',
      successThreshold: { direction: 'gte', value: 8 },
    };
    const printed = expressionNotation(pool);
    expect(printed).toBe('7d10 · count ≥8');
    const notation = step('Read dice notation');
    expect(notation.plain).toContain(printed);
    expect(bodyText(notation)).toContain(printed);
  });

  it('shows the keep-across example exactly as the app prints a trait-and-wild-die roll', () => {
    const wild: Expression = {
      ...sumRow,
      parts: [
        { id: 'trait', count: 1, sides: 8 },
        { id: 'wild', count: 1, sides: 6 },
      ],
      keepAcross: { type: 'highest', n: 1 },
    };
    const printed = expressionNotation(wild);
    expect(printed).toBe('1d8 + 1d6 · keep highest 1');
    const modifiers = step('Per-die modifiers: keep, reroll, explode');
    expect(modifiers.plain).toContain(printed);
    expect(bodyText(modifiers)).toContain(printed);
  });
});
