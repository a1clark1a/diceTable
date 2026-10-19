import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { DocsTabs } from './DocsTabs';

function renderAt(path: string) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <MemoryRouter initialEntries={[path]}>
        <DocsTabs />
      </MemoryRouter>
    </ChakraProvider>,
  );
}

const SECTION_HREFS = [
  '/docs/quickstart',
  '/docs/glossary',
  '/docs/math',
  '/docs/questions',
];

// Both bars are in the DOM. jsdom matches no media query, so only base styles
// apply: the desktop bar is display:none there and leaves the accessibility
// tree, which is why every query passes hidden. A display:none element also
// computes an empty accessible name, so the bars are matched by aria-label.
function sectionBars(): HTMLElement[] {
  return screen
    .getAllByRole('navigation', { hidden: true })
    .filter((nav) => nav.getAttribute('aria-label') === 'Docs sections');
}

function bars() {
  const [desktop, phone] = sectionBars();
  if (desktop === undefined || phone === undefined) throw new Error('expected two section bars');
  return { desktop, phone };
}

function linksIn(bar: HTMLElement) {
  return within(bar).getAllByRole('link', { hidden: true });
}

describe('DocsTabs', () => {
  it('renders a desktop bar and a phone bar', () => {
    renderAt('/docs/quickstart');
    expect(sectionBars()).toHaveLength(2);
  });

  it('links all four sections in order from the desktop bar', () => {
    renderAt('/docs/quickstart');
    const links = linksIn(bars().desktop);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(SECTION_HREFS);
    expect(links.map((a) => a.textContent)).toEqual([
      'Quickstart',
      'Glossary',
      'The Math',
      'Dice questions',
    ]);
  });

  it('links all four sections in order from the phone bar, with the short label for questions', () => {
    renderAt('/docs/quickstart');
    const links = linksIn(bars().phone);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(SECTION_HREFS);
    expect(links.map((a) => a.textContent)).toEqual([
      'Quickstart',
      'Glossary',
      'The Math',
      'Questions',
    ]);
  });

  it('marks only the current section in each bar', () => {
    renderAt('/docs/questions');
    for (const bar of Object.values(bars())) {
      const current = linksIn(bar).filter((a) => a.getAttribute('aria-current') === 'page');
      expect(current.map((a) => a.getAttribute('href'))).toEqual(['/docs/questions']);
    }
  });
});
