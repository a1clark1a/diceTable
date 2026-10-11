import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { ErrorBoundary } from './ErrorBoundary';
import { RouteHead } from './seo/RouteHead';

const CRASH_TITLE = 'Something went wrong · DiceTable';

function titles(): string[] {
  return [...document.head.querySelectorAll('title')].map((el) => el.textContent ?? '');
}

function Page({ crash }: { crash: boolean }) {
  if (crash) throw new Error('the page broke');
  return <RouteHead title="Advantage vs disadvantage · DiceTable" description="d" path="/" />;
}

function tree(crash: boolean) {
  return (
    <ChakraProvider value={defaultSystem}>
      <ErrorBoundary>
        <Page crash={crash} />
      </ErrorBoundary>
    </ChakraProvider>
  );
}

beforeEach(() => {
  // What index.html ships before mount: the fallback RouteHead removes once a
  // route has rendered its own title. Only titles are reset, because Chakra's
  // style sheet keeps references to the style tags it put in the head.
  for (const el of document.head.querySelectorAll('title')) el.remove();
  const fallback = document.createElement('title');
  fallback.setAttribute('data-default', '');
  fallback.textContent = 'DiceTable fallback';
  document.head.prepend(fallback);
  // The boundary reports what it caught; the report is a network call.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
  );
  // React and the boundary both log the caught error, which is expected here.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ErrorBoundary tab title', () => {
  it('swaps the crashed page title for its own, leaving one title in the head', () => {
    const { rerender } = render(tree(false));
    expect(titles()).toEqual(['Advantage vs disadvantage · DiceTable']);
    rerender(tree(true));
    expect(screen.getByRole('heading', { name: 'Something went wrong.' })).toBeInTheDocument();
    expect(document.title).toBe(CRASH_TITLE);
    expect(titles()).toEqual([CRASH_TITLE]);
  });
});
