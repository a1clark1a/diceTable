import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './Navbar';

// The action cluster needs the app's providers and is not part of this seam.
vi.mock('../ui/color-mode', () => ({ ColorModeButton: () => null }));
vi.mock('../share/ShareImagePopover', () => ({ ShareImagePopover: () => null }));
vi.mock('../share/ImportDialog', () => ({ ImportDialog: () => null }));
vi.mock('../share/SharePopover', () => ({ SharePopover: () => null }));

function renderAt(path: string) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <MemoryRouter initialEntries={[path]}>
        <Navbar />
      </MemoryRouter>
    </ChakraProvider>,
  );
}

function navLink(name: string): HTMLElement {
  return within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name });
}

describe('Navbar', () => {
  it('links Docs to the Quickstart section, not the /docs redirect', () => {
    renderAt('/');
    expect(navLink('Docs')).toHaveAttribute('href', '/docs/quickstart');
  });

  it('links Table to the table', () => {
    renderAt('/');
    expect(navLink('Table')).toHaveAttribute('href', '/');
  });

  it('marks Table as the current page on the table', () => {
    renderAt('/');
    expect(navLink('Table')).toHaveAttribute('aria-current', 'page');
    expect(navLink('Docs')).not.toHaveAttribute('aria-current');
  });

  it('marks Docs as the current page on Quickstart, where it leads', () => {
    renderAt('/docs/quickstart');
    expect(navLink('Docs')).toHaveAttribute('aria-current', 'page');
    expect(navLink('Table')).not.toHaveAttribute('aria-current');
  });

  it.each(['/docs/glossary', '/docs/math', '/docs/questions'])(
    'keeps Docs current on %s as its section, not its page',
    (path) => {
      renderAt(path);
      expect(navLink('Docs')).toHaveAttribute('aria-current', 'true');
      expect(navLink('Table')).not.toHaveAttribute('aria-current');
    },
  );

  it('leaves both links uncurrent on a recipe page', () => {
    renderAt('/recipes/advantage-vs-disadvantage');
    expect(navLink('Docs')).not.toHaveAttribute('aria-current');
    expect(navLink('Table')).not.toHaveAttribute('aria-current');
  });

  it('marks nothing current outside both', () => {
    renderAt('/privacy');
    expect(navLink('Docs')).not.toHaveAttribute('aria-current');
    expect(navLink('Table')).not.toHaveAttribute('aria-current');
  });
});
