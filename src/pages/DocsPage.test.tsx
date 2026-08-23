import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import DocsPage from './DocsPage';
import { glossaryEntries } from '../docs/glossary';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location" data-search={location.search} data-pathname={location.pathname} />
  );
}

function renderAt(initialEntry: string) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/docs/*" element={<DocsPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </ChakraProvider>,
  );
}

function currentPathname(): string {
  return screen.getByTestId('location').getAttribute('data-pathname') ?? '';
}

function currentSearch(): string {
  return screen.getByTestId('location').getAttribute('data-search') ?? '';
}

describe('DocsPage routing', () => {
  it('renders the Quickstart section at /docs/quickstart', () => {
    renderAt('/docs/quickstart');
    expect(
      screen.getByRole('heading', { name: 'Add your first roll' }),
    ).toBeInTheDocument();
  });

  it('renders the Glossary section at /docs/glossary', () => {
    renderAt('/docs/glossary');
    expect(screen.getByText('Dice expression')).toBeInTheDocument();
  });

  it('renders the Math section at /docs/math', () => {
    renderAt('/docs/math');
    expect(
      screen.getByRole('heading', {
        name: '1 · A single die: every face equally likely',
      }),
    ).toBeInTheDocument();
  });

  it('redirects /docs to /docs/quickstart', () => {
    renderAt('/docs');
    expect(currentPathname()).toBe('/docs/quickstart');
    expect(
      screen.getByRole('heading', { name: 'Add your first roll' }),
    ).toBeInTheDocument();
  });

  it('redirects /docs?tab=glossary to /docs/glossary', () => {
    renderAt('/docs?tab=glossary');
    expect(currentPathname()).toBe('/docs/glossary');
    expect(currentSearch()).toBe('');
    expect(screen.getByText('Dice expression')).toBeInTheDocument();
  });

  it('redirects /docs?tab=math to /docs/math', () => {
    renderAt('/docs?tab=math');
    expect(currentPathname()).toBe('/docs/math');
    expect(currentSearch()).toBe('');
    expect(
      screen.getByRole('heading', {
        name: '1 · A single die: every face equally likely',
      }),
    ).toBeInTheDocument();
  });

  it('redirects an unknown ?tab to /docs/quickstart', () => {
    renderAt('/docs?tab=banana');
    expect(currentPathname()).toBe('/docs/quickstart');
    expect(
      screen.getByRole('heading', { name: 'Add your first roll' }),
    ).toBeInTheDocument();
  });

  it('navigates between sections when a section link is clicked', () => {
    renderAt('/docs/quickstart');

    fireEvent.click(screen.getAllByRole('link', { name: 'Glossary' })[0]!);
    expect(currentPathname()).toBe('/docs/glossary');
    expect(screen.getByText('Dice expression')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('link', { name: 'The Math' })[0]!);
    expect(currentPathname()).toBe('/docs/math');
    expect(
      screen.getByRole('heading', {
        name: '1 · A single die: every face equally likely',
      }),
    ).toBeInTheDocument();
  });

  it('marks the active section link with aria-current="page"', () => {
    renderAt('/docs/glossary');
    const glossaryLinks = screen.getAllByRole('link', { name: 'Glossary' });
    expect(glossaryLinks.length).toBeGreaterThan(0);
    for (const link of glossaryLinks) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
    for (const link of screen.getAllByRole('link', { name: 'Quickstart' })) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('exposes no tab or tablist roles', () => {
    renderAt('/docs/quickstart');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('renders the not-found page for an unknown section path', () => {
    renderAt('/docs/banana');
    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument();
  });
});

function canonicalHref(): string | null {
  return (
    document.head
      .querySelector('link[rel="canonical"]')
      ?.getAttribute('href') ?? null
  );
}

describe('DocsPage per-section metadata', () => {
  it('gives the quickstart section its own title and canonical', () => {
    renderAt('/docs/quickstart');
    expect(document.title).toBe(
      'DiceTable Quickstart: build and compare your first rolls',
    );
    expect(canonicalHref()).toBe('https://dice-table.app/docs/quickstart');
  });

  it('gives the glossary section its own title and canonical', () => {
    renderAt('/docs/glossary');
    expect(document.title).toBe(
      'DiceTable Glossary: every term defined in plain language',
    );
    expect(canonicalHref()).toBe('https://dice-table.app/docs/glossary');
  });

  it('gives the math section its own title and canonical', () => {
    renderAt('/docs/math');
    expect(document.title).toBe(
      'DiceTable Math: how exact dice probabilities are computed',
    );
    expect(canonicalHref()).toBe('https://dice-table.app/docs/math');
  });

  it('renders the DefinedTermSet JSON-LD on the glossary section', () => {
    renderAt('/docs/glossary');
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    expect(scripts).toHaveLength(1);
    const data: unknown = JSON.parse(scripts[0]?.textContent ?? 'null');
    expect(data).toMatchObject({
      '@type': 'DefinedTermSet',
      '@id': 'https://dice-table.app/docs/glossary',
    });
    const terms =
      typeof data === 'object' && data !== null && 'hasDefinedTerm' in data
        ? data.hasDefinedTerm
        : null;
    expect(Array.isArray(terms) ? terms.length : -1).toBe(
      glossaryEntries.length,
    );
  });

  it('renders the HowTo JSON-LD on the quickstart section only', () => {
    renderAt('/docs/quickstart');
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    expect(scripts).toHaveLength(1);
    const data: unknown = JSON.parse(scripts[0]?.textContent ?? 'null');
    expect(data).toMatchObject({ '@type': 'HowTo' });
  });
});
