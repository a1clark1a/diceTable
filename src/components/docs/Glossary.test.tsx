import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { Glossary } from './Glossary';
import { glossaryEntries } from '../../docs/glossary';

const Provider = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
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
});
