import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import indexHtml from '../../../index.html?raw';
import { RouteHead } from './RouteHead';

function metaContent(selector: string): string | null {
  return document.head.querySelector(selector)?.getAttribute('content') ?? null;
}

describe('RouteHead', () => {
  // React 19 hoists <title>/<meta>/<link> into document.head; clear it between
  // tests so each render is asserted against a clean head.
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('sets the document title', () => {
    render(<RouteHead title="My Page" description="desc" path="/docs" />);
    expect(document.title).toBe('My Page');
  });

  it('renders the meta description', () => {
    render(<RouteHead title="t" description="A short summary." path="/docs" />);
    expect(metaContent('meta[name="description"]')).toBe('A short summary.');
  });

  it('builds an absolute canonical URL from the path', () => {
    render(<RouteHead title="t" description="d" path="/privacy" />);
    const canonical = document.head.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe(
      'https://dice-table.app/privacy',
    );
  });

  it('mirrors title and description into OG and Twitter tags', () => {
    render(<RouteHead title="Title X" description="Desc Y" path="/" />);
    expect(metaContent('meta[property="og:title"]')).toBe('Title X');
    expect(metaContent('meta[property="og:description"]')).toBe('Desc Y');
    expect(metaContent('meta[property="og:url"]')).toBe(
      'https://dice-table.app/',
    );
    expect(metaContent('meta[name="twitter:title"]')).toBe('Title X');
    expect(metaContent('meta[name="twitter:description"]')).toBe('Desc Y');
  });

  it('defaults robots to index,follow', () => {
    render(<RouteHead title="t" description="d" path="/docs" />);
    expect(metaContent('meta[name="robots"]')).toBe('index,follow');
  });

  it('emits noindex robots and omits the canonical link when noindex', () => {
    render(<RouteHead title="t" description="d" path="/404" noindex />);
    expect(metaContent('meta[name="robots"]')).toBe('noindex,follow');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});

describe('RouteHead and the static index.html defaults', () => {
  // Stands in for what index.html ships before React mounts: a fallback title
  // and description marked data-default, plus a global tag that is not marked.
  beforeEach(() => {
    document.head.innerHTML = [
      '<title data-default>Fallback title</title>',
      '<meta name="description" content="Fallback description" data-default />',
      '<meta property="og:image" content="https://dice-table.app/og-image.png" />',
    ].join('');
  });

  function titles(): string[] {
    return [...document.head.querySelectorAll('title')].map(
      (el) => el.textContent ?? '',
    );
  }

  function descriptions(): (string | null)[] {
    return [...document.head.querySelectorAll('meta[name="description"]')].map(
      (el) => el.getAttribute('content'),
    );
  }

  it('leaves exactly one title, the route one, once mounted', () => {
    render(<RouteHead title="Route title" description="d" path="/docs" />);
    expect(titles()).toEqual(['Route title']);
    expect(document.title).toBe('Route title');
  });

  it('removes the static description and keeps its own', () => {
    render(
      <RouteHead title="t" description="Route description" path="/docs" />,
    );
    expect(descriptions()).toEqual(['Route description']);
  });

  it('keeps static tags that are not marked data-default', () => {
    render(<RouteHead title="t" description="d" path="/docs" />);
    expect(metaContent('meta[property="og:image"]')).toBe(
      'https://dice-table.app/og-image.png',
    );
  });

  it('leaves one title after navigating from one route to another', () => {
    // A key change is what a client-side route switch does to the page under
    // it: the old RouteHead unmounts and a new one mounts in the same commit.
    const { rerender } = render(
      <RouteHead key="home" title="Home" description="h" path="/" />,
    );
    expect(() =>
      rerender(<RouteHead key="docs" title="Docs" description="d" path="/docs" />),
    ).not.toThrow();
    expect(titles()).toEqual(['Docs']);
    expect(descriptions()).toEqual(['d']);
  });

  it('unmounts without throwing after the defaults are gone', () => {
    // React removes the tags it hoisted on unmount, and throws when one of them
    // is already detached, so the cleanup must never take one of React's own.
    const { unmount } = render(
      <RouteHead title="Home" description="h" path="/" />,
    );
    expect(() => unmount()).not.toThrow();
  });

  it('leaves exactly one title when StrictMode runs the effects twice', () => {
    render(
      <StrictMode>
        <RouteHead title="Route title" description="d" path="/docs" />
      </StrictMode>,
    );
    expect(titles()).toEqual(['Route title']);
    expect(descriptions()).toEqual(['d']);
  });
});

describe('RouteHead covers what index.html marks data-default', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  // Same tag and identifying attribute, so a marked og:image would need an
  // og:image from RouteHead and not just any meta.
  function selectorFor(el: Element): string {
    let selector = el.tagName.toLowerCase();
    for (const attr of ['name', 'property', 'rel']) {
      const value = el.getAttribute(attr);
      if (value !== null) selector += `[${attr}="${value}"]`;
    }
    return selector;
  }

  it('renders a replacement for every tag index.html marks data-default', () => {
    // Every route renders RouteHead and RouteHead deletes every marked tag, so
    // marking one it does not render drops that tag from the live page.
    const marked = [
      ...new DOMParser()
        .parseFromString(indexHtml, 'text/html')
        .head.querySelectorAll('[data-default]'),
    ];
    expect(marked.length).toBeGreaterThan(0);
    render(<RouteHead title="t" description="d" path="/docs" />);
    for (const el of marked) {
      expect(document.head.querySelector(selectorFor(el))).not.toBeNull();
    }
  });
});
