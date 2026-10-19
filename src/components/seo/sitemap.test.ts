import { describe, expect, it } from 'vitest';
import sitemapXml from '../../../public/sitemap.xml?raw';

describe('sitemap.xml', () => {
  it('gives every URL its address and nothing else', () => {
    const locs = [...sitemapXml.matchAll(/<loc>[^<]*<\/loc>/g)];
    // trim() so a CRLF checkout reads each entry the same as an LF one.
    const entries = [...sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) =>
      (m[1] ?? '').trim(),
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(entries).toHaveLength(locs.length);
    for (const entry of entries) expect(entry).toMatch(/^<loc>[^<]+<\/loc>$/);
  });
});
