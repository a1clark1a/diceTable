import { describe, expect, it } from 'vitest';
import llmsTxt from '../../../public/llms.txt?raw';
import indexHtml from '../../../index.html?raw';

// A Windows checkout writes CRLF, and every check below reads whole lines.
const lines = llmsTxt.replace(/\r\n/g, '\n').split('\n');
const firstH2 = lines.findIndex((line) => line.startsWith('## '));

describe('llms.txt', () => {
  it('opens with the site name as an H1 and a one-line summary', () => {
    expect(lines[0]).toBe('# DiceTable');
    expect(lines[1]).toBe('');
    expect(lines[2]).toMatch(/^> \S/);
    expect(lines[3]).toBe('');
  });

  it('keeps headings out of the details before the first H2', () => {
    expect(firstH2).toBeGreaterThan(0);
    expect(lines.slice(1, firstH2).filter((line) => line.startsWith('#'))).toEqual([]);
  });

  it('lists only links under every H2', () => {
    // The reference llms_txt parser reads every line under an H2 as a link and
    // throws on anything else, so one line of prose there breaks the whole file.
    const stray = lines
      .slice(firstH2)
      .filter(
        (line) =>
          line !== '' &&
          !/^## \S/.test(line) &&
          !/^- \[[^\]]+\]\([^)\s]+\)(?:: .+)?$/.test(line),
      );
    expect(stray).toEqual([]);
  });

  it('ends with an Optional section that holds the privacy link', () => {
    // Tools that trim to a short context drop the section by this exact name.
    const headings = lines.filter((line) => line.startsWith('## '));
    expect(headings.at(-1)).toBe('## Optional');
    const privacy = lines.flatMap((line, i) =>
      line.includes('](https://dice-table.app/privacy)') ? [i] : [],
    );
    expect(privacy).toHaveLength(1);
    expect(privacy[0]).toBeGreaterThan(lines.lastIndexOf('## Optional'));
  });
});

describe('index.html', () => {
  it('points agents at llms.txt from index.html with a link RouteHead keeps', () => {
    // RouteHead deletes every data-default tag on mount, so a marked link would
    // vanish from the live page.
    const links = [
      ...new DOMParser()
        .parseFromString(indexHtml, 'text/html')
        .head.querySelectorAll('link[rel="describedby"]'),
    ].map((link) => ({
      href: link.getAttribute('href'),
      type: link.getAttribute('type'),
      marked: link.hasAttribute('data-default'),
    }));
    expect(links).toEqual([{ href: '/llms.txt', type: 'text/plain', marked: false }]);
  });
});
