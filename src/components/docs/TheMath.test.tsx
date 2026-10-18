import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { TheMath } from './TheMath';
import { mathOps } from '../../docs/math';
import { findRecipePage, recipePath } from '../../presets/recipePages';

const Provider = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <MemoryRouter>{children}</MemoryRouter>
  </ChakraProvider>
);

describe('TheMath', () => {
  it('renders a card for every op in mathOps', () => {
    render(
      <Provider>
        <TheMath />
      </Provider>,
    );

    for (const op of mathOps) {
      expect(
        screen.getByRole('heading', { name: op.title }),
        `op "${op.id}" heading is missing`,
      ).toBeInTheDocument();
    }
  });

  it('renders the math snippet for every op', () => {
    render(
      <Provider>
        <TheMath />
      </Provider>,
    );

    for (const op of mathOps) {
      const firstLine = op.snippet.split('\n')[0] ?? '';
      expect(
        firstLine.length,
        `op "${op.id}" has empty snippet`,
      ).toBeGreaterThan(0);
      const matches = screen.getAllByText((_, el) =>
        el?.textContent?.includes(firstLine) ?? false,
      );
      expect(
        matches.length,
        `snippet for "${op.id}" not rendered`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('links each section that has a recipe page, by the page’s heading, in section order', () => {
    render(
      <Provider>
        <TheMath />
      </Provider>,
    );

    const linked = mathOps.flatMap((op) =>
      op.recipePage !== undefined ? [op.recipePage] : [],
    );
    expect(linked.length).toBeGreaterThan(0);
    // The exact count also proves a section without a recipe page links nowhere.
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
