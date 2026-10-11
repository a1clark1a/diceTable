import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { RecipeHero } from './RecipeHero';
import { RECIPE_PAGES, type RecipePage } from '../../presets/recipePages';

function pageFor(slug: string): RecipePage {
  const page = RECIPE_PAGES.find((p) => p.slug === slug);
  if (page === undefined) throw new Error(`no recipe page ${slug}`);
  return page;
}

const PAGE = pageFor('4d6-drop-lowest');
const OPEN = /open this in my table/i;

function renderHero(onOpen: (() => void) | null) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <RecipeHero page={PAGE} onOpen={onOpen} />
    </ChakraProvider>,
  );
}

function buildItYourself(): HTMLElement {
  return screen.getByRole('button', { name: 'Build it yourself' });
}

// The list sits in a closed collapsible, which hides it from the default role
// queries; the point of these tests is that it is in the DOM regardless.
function stepsList(): HTMLElement {
  return screen.getByRole('list', { hidden: true });
}

describe('RecipeHero heading and intro', () => {
  it('renders the page heading as an h1', () => {
    renderHero(null);
    expect(
      screen.getByRole('heading', { level: 1, name: PAGE.heading }),
    ).toBeInTheDocument();
  });

  it('shows the intro under the heading', () => {
    renderHero(null);
    expect(screen.getByText(PAGE.intro)).toBeInTheDocument();
  });
});

describe('RecipeHero Open this in my table', () => {
  it('offers the button when there are rows to carry over', () => {
    renderHero(() => {});
    expect(screen.getByRole('button', { name: OPEN })).toBeInTheDocument();
  });

  it('hides the button and its note when onOpen is null', () => {
    renderHero(null);
    expect(screen.queryByRole('button', { name: OPEN })).toBeNull();
    expect(screen.queryByText(/rolls you already have/i)).toBeNull();
  });

  it('calls onOpen once when the button is pressed', () => {
    const onOpen = vi.fn();
    renderHero(onOpen);
    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('RecipeHero Build it yourself', () => {
  it('starts collapsed', () => {
    renderHero(null);
    expect(buildItYourself()).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands when pressed', async () => {
    renderHero(null);
    fireEvent.click(buildItYourself());
    await waitFor(() =>
      expect(buildItYourself()).toHaveAttribute('aria-expanded', 'true'),
    );
  });

  it('collapses again on a second press', async () => {
    renderHero(null);
    fireEvent.click(buildItYourself());
    // The collapsible settles a beat after the click, so the second press only
    // means "close" once the first has landed.
    await waitFor(() =>
      expect(buildItYourself()).toHaveAttribute('aria-expanded', 'true'),
    );
    fireEvent.click(buildItYourself());
    await waitFor(() =>
      expect(buildItYourself()).toHaveAttribute('aria-expanded', 'false'),
    );
  });

  it('keeps the steps out of view while collapsed', () => {
    renderHero(null);
    expect(stepsList()).not.toBeVisible();
  });

  it('shows the steps once expanded', async () => {
    renderHero(null);
    fireEvent.click(buildItYourself());
    await waitFor(() => expect(stepsList()).toBeVisible());
  });

  it('keeps an ordered list with one item per step in the DOM while collapsed', () => {
    // The page's HowTo structured data repeats these steps, and structured data
    // has to match text the page carries, so closing must not unmount them.
    renderHero(null);
    const list = stepsList();
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem', { hidden: true })).toHaveLength(
      PAGE.steps.length,
    );
  });

  it('reads each step as its title followed by its explanation, in order', () => {
    renderHero(null);
    const items = within(stepsList()).getAllByRole('listitem', { hidden: true });
    expect(items.map((li) => li.textContent)).toEqual(
      PAGE.steps.map((s) => `${s.title}. ${s.plain}`),
    );
  });
});
