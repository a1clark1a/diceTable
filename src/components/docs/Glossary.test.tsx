import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { Glossary } from './Glossary';
import { GLOSSARY_GROUP_ORDER, glossaryEntries } from '../../docs/glossary';
import { findRecipePage, recipePath } from '../../presets/recipePages';
import { RULING_OPTIONS } from '../targetRulingMeta';

const Provider = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <MemoryRouter>{children}</MemoryRouter>
  </ChakraProvider>
);

describe('Glossary', () => {
  it('renders every entry from glossaryEntries', () => {
    render(
      <Provider>
        <Glossary />
      </Provider>,
    );

    for (const entry of glossaryEntries) {
      const matches = screen.getAllByText(entry.term);
      expect(
        matches.length,
        `term "${entry.term}" (id: ${entry.id}) is missing from the glossary`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders the formal notation when present on an entry', () => {
    render(
      <Provider>
        <Glossary />
      </Provider>,
    );

    const withFormal = glossaryEntries.filter((e) => e.formal !== undefined);
    expect(withFormal.length).toBeGreaterThan(0);
    for (const entry of withFormal) {
      expect(
        screen.getByText(entry.formal as string),
        `formal text for "${entry.id}" is missing`,
      ).toBeInTheDocument();
    }
  });

  it('renders the deeper details paragraph when present on an entry', () => {
    render(
      <Provider>
        <Glossary />
      </Provider>,
    );

    const withDetails = glossaryEntries.filter((e) => e.details !== undefined);
    expect(withDetails.length).toBeGreaterThan(0);
    for (const entry of withDetails) {
      expect(
        screen.getByText(entry.details as string),
        `details text for "${entry.id}" is missing`,
      ).toBeInTheDocument();
    }
  });

  it('renders the community terms and no-common-name notes for target rulings', () => {
    render(
      <Provider>
        <Glossary />
      </Provider>,
    );

    for (const option of RULING_OPTIONS) {
      if (option.communityTerm !== undefined) {
        expect(screen.getByText(option.communityTerm)).toBeInTheDocument();
      } else {
        const expected = option.communityNote
          ? `no common name; ${option.communityNote}`
          : 'no common name';
        expect(screen.getByText(expected)).toBeInTheDocument();
      }
    }
  });

  it('links each entry that has a recipe page, by the page’s heading, in the order the entries render', () => {
    render(
      <Provider>
        <Glossary />
      </Provider>,
    );

    const linked = GLOSSARY_GROUP_ORDER.flatMap((group) =>
      glossaryEntries.flatMap((e) =>
        e.group === group && e.recipePage !== undefined ? [e.recipePage] : [],
      ),
    );
    expect(linked.length).toBeGreaterThan(0);
    // The exact count also proves an entry without a recipe page links nowhere.
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      linked.map((slug) => recipePath(slug)),
    );
    expect(links.map((a) => a.textContent)).toEqual(
      linked.map((slug) => findRecipePage(slug)?.heading),
    );
    expect(screen.getAllByText(/^See it worked out:/)).toHaveLength(linked.length);
  });
});
