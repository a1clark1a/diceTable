import { describe, expect, it } from 'vitest';
import changelog from '../../CHANGELOG.md?raw';
import { RELEASES } from './releases';
import { compareVersions } from './versions';

const HEADING_RE = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/gm;
const changelogReleases = [...changelog.matchAll(HEADING_RE)].map((m) => ({
  version: m[1] ?? '',
  date: m[2] ?? '',
}));

const HINT = 'add or fix its entry in src/whatsNew/releases.ts';
const DASH_RE = /[–—]/;
const HEX_RE = /#[0-9a-f]{3,8}\b/i;
const HIGHLIGHT_MAX = 140;
const TITLE_MAX = 48;

describe('release notes match the CHANGELOG', () => {
  it('finds the CHANGELOG headings it is checking against', () => {
    expect(changelogReleases.length).toBeGreaterThan(0);
  });

  it.each(changelogReleases)('has notes for $version, dated $date', ({ version, date }) => {
    const entry = RELEASES.find((r) => r.version === version);
    expect(entry, `CHANGELOG has ${version} but What's new does not: ${HINT}`).toBeDefined();
    expect(entry?.date, `${version} is dated ${date} in the CHANGELOG: ${HINT}`).toBe(date);
  });

  it.each(RELEASES.map((r) => ({ version: r.version })))(
    'has a CHANGELOG section for $version',
    ({ version }) => {
      expect(
        changelogReleases.some((c) => c.version === version),
        `${version} has notes but no dated CHANGELOG section`,
      ).toBe(true);
    },
  );

  it('leads with the version the build reports', () => {
    expect(
      RELEASES[0]?.version,
      `package.json is ${__APP_VERSION__} but the newest notes are not: ${HINT}`,
    ).toBe(__APP_VERSION__);
  });

  it('lists each version once, newest first', () => {
    for (let i = 1; i < RELEASES.length; i++) {
      const newer = RELEASES[i - 1]?.version ?? '';
      const older = RELEASES[i]?.version ?? '';
      expect(compareVersions(newer, older), `${newer} must come before ${older}`).toBeGreaterThan(0);
    }
  });
});

describe.each(RELEASES.map((r) => ({ ...r, label: r.version })))(
  'notes for $label read the way the dialog needs',
  ({ version, title, highlights }) => {
    it('has a short plain title', () => {
      expect(title.trim().length, `${version} has no title`).toBeGreaterThan(0);
      expect(title.length, `${version} title is over ${TITLE_MAX} characters`).toBeLessThanOrEqual(TITLE_MAX);
      expect(title.endsWith('.'), `${version} title ends with a period`).toBe(false);
      expect(DASH_RE.test(title), `${version} title has an en or em dash`).toBe(false);
      expect(HEX_RE.test(title), `${version} title has a hex color`).toBe(false);
    });

    it('has two to five distinct highlights', () => {
      expect(highlights.length).toBeGreaterThanOrEqual(2);
      expect(highlights.length).toBeLessThanOrEqual(5);
      expect(new Set(highlights).size, `${version} repeats a highlight`).toBe(highlights.length);
    });

    it.each(highlights.map((text) => ({ text })))('keeps "$text" to one short sentence', ({ text }) => {
      expect(text.length, `over ${HIGHLIGHT_MAX} characters`).toBeLessThanOrEqual(HIGHLIGHT_MAX);
      expect(text.endsWith('.'), 'does not end with a period').toBe(true);
      expect(DASH_RE.test(text), 'has an en or em dash').toBe(false);
      expect(HEX_RE.test(text), 'has a hex color').toBe(false);
    });
  },
);
