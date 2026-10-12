import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import DocsPage from './DocsPage';
import { glossaryEntries } from '../docs/glossary';
import { RECIPE_PAGES, findRecipePage, recipePath } from '../presets/recipePages';
import sitemapXml from '../../public/sitemap.xml?raw';

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

  it('renders the Dice questions section at /docs/questions', () => {
    renderAt('/docs/questions');
    expect(
      screen.getByRole('link', { name: RECIPE_PAGES[0]!.heading }),
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

    fireEvent.click(screen.getByRole('link', { name: 'Questions' }));
    expect(currentPathname()).toBe('/docs/questions');
    expect(
      screen.getByRole('link', { name: RECIPE_PAGES[0]!.heading }),
    ).toBeInTheDocument();
  });

  it('marks the Dice questions link current in both the desktop and phone bars', () => {
    renderAt('/docs/questions');
    // jsdom applies base styles only, so the desktop bar is display:none here.
    expect(
      screen.getByRole('link', { name: 'Dice questions', hidden: true }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Questions' })).toHaveAttribute(
      'aria-current',
      'page',
    );
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

  it('gives the dice questions section its own title and canonical', () => {
    renderAt('/docs/questions');
    expect(document.title).toBe(
      'DiceTable Dice Questions: exact odds for common rolls',
    );
    expect(canonicalHref()).toBe('https://dice-table.app/docs/questions');
  });

  it('gives the dice questions section a description Google shows in full', () => {
    renderAt('/docs/questions');
    const description =
      document.head
        .querySelector('meta[name="description"]')
        ?.getAttribute('content') ?? '';
    expect(description.length).toBeGreaterThanOrEqual(120);
    expect(description.length).toBeLessThanOrEqual(155);
  });

  it('renders an ItemList JSON-LD of every recipe page, in order, on the dice questions section', () => {
    renderAt('/docs/questions');
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    expect(scripts).toHaveLength(1);
    const data: unknown = JSON.parse(scripts[0]?.textContent ?? 'null');
    expect(data).toMatchObject({
      '@type': 'ItemList',
      '@id': 'https://dice-table.app/docs/questions',
      itemListElement: RECIPE_PAGES.map((page, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: page.heading,
        url: `https://dice-table.app${recipePath(page.slug)}`,
      })),
    });
    const items =
      typeof data === 'object' && data !== null && 'itemListElement' in data
        ? data.itemListElement
        : null;
    expect(Array.isArray(items) ? items.length : -1).toBe(RECIPE_PAGES.length);
  });
});

function robotsContent(): string | null {
  return (
    document.head
      .querySelector('meta[name="robots"]')
      ?.getAttribute('content') ?? null
  );
}

const SITE = 'https://dice-table.app';

const SITEMAP_DOCS_URLS = [...sitemapXml.matchAll(/<loc>([^<]*)<\/loc>/g)]
  .map((m) => m[1] ?? '')
  .filter((url) => url.startsWith(`${SITE}/docs`));

describe('DocsPage indexability', () => {
  it.each(SITEMAP_DOCS_URLS)(
    'renders sitemap URL %s as an indexable page canonical to itself',
    (url) => {
      renderAt(url.slice(SITE.length));
      expect(
        screen.queryByRole('heading', { name: 'Page not found' }),
      ).not.toBeInTheDocument();
      expect(robotsContent()).toBe('index,follow');
      expect(canonicalHref()).toBe(url);
    },
  );

  it.each(['/docs/banana', '/docs/questions/extra'])(
    'keeps %s out of the index with no canonical',
    (path) => {
      renderAt(path);
      expect(
        screen.getByRole('heading', { name: 'Page not found' }),
      ).toBeInTheDocument();
      expect(robotsContent()).toBe('noindex,follow');
      expect(canonicalHref()).toBeNull();
    },
  );
});

function questionLinks(): HTMLAnchorElement[] {
  return screen
    .getAllByRole('heading', { level: 3 })
    .map((h) => within(h).getByRole('link'))
    .filter((a): a is HTMLAnchorElement => a instanceof HTMLAnchorElement);
}

describe('DocsPage dice questions list', () => {
  it('asks every recipe page question, in order, each linking to its page', () => {
    renderAt('/docs/questions');
    const links = questionLinks();
    expect(links.map((a) => a.textContent)).toEqual(
      RECIPE_PAGES.map((p) => p.heading),
    );
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      RECIPE_PAGES.map((p) => recipePath(p.slug)),
    );
  });

  it('links only to recipe pages that exist', () => {
    renderAt('/docs/questions');
    const links = questionLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(href, link.textContent ?? '').toMatch(/^\/recipes\/[^/]+$/);
      expect(findRecipePage(href.slice('/recipes/'.length)), href).toBeDefined();
    }
  });

  it('answers each question with its recipe page description', () => {
    renderAt('/docs/questions');
    for (const page of RECIPE_PAGES) {
      const item = screen
        .getByRole('link', { name: page.heading })
        .closest('li');
      expect(item, page.slug).not.toBeNull();
      expect(within(item!).getByText(page.description)).toBeInTheDocument();
    }
  });
});
