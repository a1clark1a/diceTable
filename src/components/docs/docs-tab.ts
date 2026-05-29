export type DocsTab = 'quickstart' | 'glossary' | 'math';

export const DOCS_TAB_VALUES: readonly DocsTab[] = [
  'quickstart',
  'glossary',
  'math',
];

export function isDocsTab(value: string | null): value is DocsTab {
  return value !== null && (DOCS_TAB_VALUES as readonly string[]).includes(value);
}
