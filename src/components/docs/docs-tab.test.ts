import { describe, expect, it } from 'vitest';
import sitemapXml from '../../../public/sitemap.xml?raw';
import llmsTxt from '../../../public/llms.txt?raw';
import { docsSectionPath, isDocsTab, type DocsTab } from './docs-tab';

// A Record over the union fails the type-check the day a tab is added here and
// not to the union, or to the union and not here, so the checks below always
// cover every section.
const EVERY_TAB: Record<DocsTab, true> = {
  quickstart: true,
  glossary: true,
  math: true,
  questions: true,
};

function tabs(): DocsTab[] {
  return Object.keys(EVERY_TAB).filter((t): t is DocsTab => isDocsTab(t));
}

const SITE = 'https://dice-table.app';

describe('isDocsTab', () => {
  it('accepts every docs section', () => {
    expect(tabs()).toHaveLength(Object.keys(EVERY_TAB).length);
  });

  it.each([null, '', 'banana', 'Questions', 'questions '])('rejects %j', (value) => {
    expect(isDocsTab(value)).toBe(false);
  });
});

describe('docsSectionPath', () => {
  it('puts each section under /docs', () => {
    expect(docsSectionPath('questions')).toBe('/docs/questions');
  });
});

describe('docs sections in the sitemap and llms.txt', () => {
  it('lists every docs section URL in the sitemap and no other docs URL', () => {
    const docsUrls = [...sitemapXml.matchAll(/<loc>([^<]*)<\/loc>/g)]
      .map((m) => m[1] ?? '')
      .filter((url) => url.startsWith(`${SITE}/docs`));
    expect(docsUrls.sort()).toEqual(tabs().map((t) => `${SITE}${docsSectionPath(t)}`).sort());
  });

  it('links every docs section from llms.txt', () => {
    for (const tab of tabs()) {
      expect(llmsTxt).toContain(`](${SITE}${docsSectionPath(tab)})`);
    }
  });
});
