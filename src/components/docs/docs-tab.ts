import { matchPath } from 'react-router-dom';

export type DocsTab = 'quickstart' | 'glossary' | 'math' | 'questions';

const DOCS_TAB_VALUES: readonly DocsTab[] = [
  'quickstart',
  'glossary',
  'math',
  'questions',
];

export const DOCS_TAB_LABELS: Readonly<Record<DocsTab, string>> = {
  quickstart: 'Quickstart',
  glossary: 'Glossary',
  math: 'The Math',
  questions: 'Dice questions',
};

export function isDocsTab(value: string | null): value is DocsTab {
  return value !== null && (DOCS_TAB_VALUES as readonly string[]).includes(value);
}

export function docsSectionPath(tab: DocsTab): string {
  return `/docs/${tab}`;
}

// Matched by the router's own rules, so a mixed-case or trailing-slash URL gets
// the heading of the section the router actually rendered.
export function docsTabForPath(pathname: string): DocsTab | null {
  return (
    DOCS_TAB_VALUES.find(
      (tab) => matchPath(docsSectionPath(tab), pathname) !== null,
    ) ?? null
  );
}
