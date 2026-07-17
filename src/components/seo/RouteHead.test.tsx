import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
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
