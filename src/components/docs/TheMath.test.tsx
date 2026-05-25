import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { TheMath } from './TheMath';
import { mathOps } from '../../docs/math';

const Provider = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
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
});
