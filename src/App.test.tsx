import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// A docs chunk that never arrives keeps the route on its loading fallback for
// the whole test, which is the moment under test.
vi.mock('./pages/DocsPage', () => new Promise(() => {}));

function titles(): string[] {
  return [...document.head.querySelectorAll('title')].map((el) => el.textContent ?? '');
}

/** jsdom ships no matchMedia, and the color-mode provider App mounts reads one. */
function stubMatchMedia() {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

beforeEach(() => {
  stubMatchMedia();
  // What index.html ships before mount. Only titles are reset, because
  // Chakra's style sheet keeps references to the style tags it put in the head.
  for (const el of document.head.querySelectorAll('title')) el.remove();
  const fallback = document.createElement('title');
  fallback.setAttribute('data-default', '');
  fallback.textContent = 'DiceTable fallback';
  document.head.prepend(fallback);
});

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
  window.localStorage.clear();
});

describe('App docs route while the docs page loads', () => {
  it('titles the tab DiceTable after leaving a page, with one title in the head', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <App />
      </MemoryRouter>,
    );
    expect(titles()).toEqual(['Privacy · DiceTable']);
    fireEvent.click(screen.getByRole('link', { name: 'Docs' }));
    expect(document.title).toBe('DiceTable');
    expect(titles()).toEqual(['DiceTable']);
  });
});
