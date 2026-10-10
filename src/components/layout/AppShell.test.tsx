import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { encodeRollsToHash } from '../../share/encode';
import type { Expression } from '../../types';

// The header's share and import controls are not part of this seam, and the
// shell only needs something in its slot.
vi.mock('./Navbar', () => ({ Navbar: () => <header data-testid="navbar" /> }));

// Fixed notes and a fixed build version, so a release cut never turns these red.
vi.mock('../../whatsNew/releases', () => ({
  RELEASES: [
    { version: '9.2.0', date: '2030-03-01', title: 'Third theme', highlights: ['Third one.', 'Third two.'] },
    { version: '9.1.0', date: '2030-02-01', title: 'Second theme', highlights: ['Second one.', 'Second two.'] },
    { version: '9.0.0', date: '2030-01-01', title: 'First theme', highlights: ['First one.', 'First two.'] },
  ],
}));

const { AppProvider } = await import('../../state/AppContext');
const { RollHistoryProvider } = await import('../../state/RollHistoryContext');
const { AppShell } = await import('./AppShell');

const LAST_SEEN = 'dicetable.lastSeenVersion';
const SHARE_MARKER = 'dicetable.shareVisit';

const ROLL: Expression = {
  id: 'e1',
  name: 'Attack',
  parts: [{ id: 'p1', count: 1, sides: 20 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};

function seedSavedTable() {
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({
      version: 2,
      value: {
        version: 2,
        expressions: [ROLL],
        ui: {
          expandedId: null,
          chartView: 'pmf',
          target: { values: [], ruling: 'gte' },
          poolTarget: 1,
          view: 'table',
        },
      },
    }),
  );
}

function renderShell(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ChakraProvider value={defaultSystem}>
        <AppProvider>
          <RollHistoryProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<p>table page</p>} />
                <Route path="privacy" element={<p>privacy page</p>} />
              </Route>
            </Routes>
          </RollHistoryProvider>
        </AppProvider>
      </ChakraProvider>
    </MemoryRouter>,
  );
}

// A dialog that is going to open does so a beat after mount, so absence is only
// meaningful once that beat has passed.
async function expectNoDialog() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(screen.queryByRole('dialog')).toBeNull();
}

// jsdom does no layout, so every element reports an empty box and the dialog's
// focus trap reads them all as hidden, with nothing it may focus. Giving
// elements one box is enough for the trap to treat them as visible.
function giveElementsALayoutBox() {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue(
    [new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList,
  );
}

function releaseHeadings(dialog: HTMLElement) {
  return within(dialog)
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent);
}

beforeEach(() => {
  vi.stubGlobal('__APP_VERSION__', '9.2.0');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('What\'s new on open', () => {
  it('stays closed for a first-time visitor and records the version', async () => {
    renderShell();
    await waitFor(() => expect(window.localStorage.getItem(LAST_SEEN)).toBe('9.2.0'));
    await expectNoDialog();
  });

  it('stacks every release since the last visit, newest first', async () => {
    seedSavedTable();
    window.localStorage.setItem(LAST_SEEN, '9.0.0');
    renderShell();
    const dialog = await screen.findByRole('dialog');
    expect(releaseHeadings(dialog)).toEqual(['v9.2.0 · Third theme', 'v9.1.0 · Second theme']);
    expect(within(dialog).getByText('Since your last visit (v9.0.0).')).toBeInTheDocument();
  });

  it('shows only the current release to a user from before this feature', async () => {
    seedSavedTable();
    renderShell();
    const dialog = await screen.findByRole('dialog');
    expect(releaseHeadings(dialog)).toEqual(['v9.2.0 · Third theme']);
    expect(within(dialog).getByText('New in v9.2.0.')).toBeInTheDocument();
  });

  it('stays closed once the current version has been seen', async () => {
    seedSavedTable();
    window.localStorage.setItem(LAST_SEEN, '9.2.0');
    renderShell();
    await expectNoDialog();
  });

  it('opens on any page, not just the table', async () => {
    seedSavedTable();
    window.localStorage.setItem(LAST_SEEN, '9.1.0');
    renderShell('/privacy');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('stays closed when storage is blocked, since it could never remember being closed', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    renderShell();
    await expectNoDialog();
  });

  it('links each release to its full notes in a new tab', async () => {
    seedSavedTable();
    renderShell();
    const dialog = await screen.findByRole('dialog');
    const link = within(dialog).getByRole('link', { name: /full release notes/i });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/a1clark1a/diceTable/releases/tag/v9.2.0',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('puts focus on Got it rather than the first link', async () => {
    giveElementsALayoutBox();
    seedSavedTable();
    renderShell();
    const dialog = await screen.findByRole('dialog');
    const gotIt = within(dialog).getByRole('button', { name: 'Got it' });
    await waitFor(() => expect(gotIt).toHaveFocus());
  });
});

describe('What\'s new and share links', () => {
  it('stays closed for a returning user who opens a share link, and leaves the release unseen', async () => {
    seedSavedTable();
    window.localStorage.setItem(LAST_SEEN, '9.0.0');
    window.history.replaceState(null, '', `/${encodeRollsToHash([ROLL])}`);
    renderShell();
    await expectNoDialog();
    expect(window.localStorage.getItem(LAST_SEEN)).toBe('9.0.0');
  });

  it('stays closed on the reload an update makes after the old build consumed the link', async () => {
    seedSavedTable();
    window.localStorage.setItem(LAST_SEEN, '9.0.0');
    window.sessionStorage.setItem(SHARE_MARKER, String(Date.now()));
    renderShell();
    await expectNoDialog();
    expect(window.localStorage.getItem(LAST_SEEN)).toBe('9.0.0');
    expect(window.sessionStorage.getItem(SHARE_MARKER)).toBeNull();
  });

  it('opens as usual once the share marker has gone stale', async () => {
    seedSavedTable();
    window.localStorage.setItem(LAST_SEEN, '9.0.0');
    window.sessionStorage.setItem(SHARE_MARKER, String(Date.now() - 60_000));
    renderShell();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('records a first-time visitor who arrived by link, so their next visit stays quiet too', async () => {
    window.history.replaceState(null, '', `/${encodeRollsToHash([ROLL])}`);
    const first = renderShell();
    await expectNoDialog();
    expect(window.localStorage.getItem(LAST_SEEN)).toBe('9.2.0');
    // The link saves its rolls, which is what would otherwise make the next
    // visit look like a user from before this feature.
    await waitFor(() => expect(window.localStorage.getItem('dicetable.v2')).not.toBeNull());
    first.unmount();

    window.sessionStorage.clear();
    renderShell();
    await expectNoDialog();
  });
});

describe('closing What\'s new', () => {
  async function openSince() {
    seedSavedTable();
    window.localStorage.setItem(LAST_SEEN, '9.0.0');
    renderShell();
    return await screen.findByRole('dialog');
  }

  it('records the version when Got it is pressed', async () => {
    const dialog = await openSince();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.localStorage.getItem(LAST_SEEN)).toBe('9.2.0');
  });

  it('records the version when the close button is pressed', async () => {
    const dialog = await openSince();
    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.localStorage.getItem(LAST_SEEN)).toBe('9.2.0');
  });

  it('records the version when Escape is pressed', async () => {
    const dialog = await openSince();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.localStorage.getItem(LAST_SEEN)).toBe('9.2.0');
  });

  it('does not record anything while it is only open', async () => {
    await openSince();
    expect(window.localStorage.getItem(LAST_SEEN)).toBe('9.0.0');
  });
});

describe('What\'s new from the footer', () => {
  it('opens the full history from the footer button', async () => {
    window.localStorage.setItem(LAST_SEEN, '9.2.0');
    renderShell();
    await expectNoDialog();
    fireEvent.click(screen.getByRole('button', { name: /what's new/i }));
    const dialog = await screen.findByRole('dialog');
    expect(releaseHeadings(dialog)).toEqual([
      'v9.2.0 · Third theme',
      'v9.1.0 · Second theme',
      'v9.0.0 · First theme',
    ]);
    expect(within(dialog).getByText('Every version of DiceTable, newest first.')).toBeInTheDocument();
  });

  it('shows the running version on the button', () => {
    window.localStorage.setItem(LAST_SEEN, '9.2.0');
    renderShell();
    expect(screen.getByRole('button', { name: /what's new/i })).toHaveTextContent('v9.2.0');
  });

  it('returns focus to the footer button on close, even though a click never focused it', async () => {
    giveElementsALayoutBox();
    window.localStorage.setItem(LAST_SEEN, '9.2.0');
    renderShell();
    const button = screen.getByRole('button', { name: /what's new/i });
    fireEvent.click(button);
    const dialog = await screen.findByRole('dialog');
    // The trap takes focus a frame after opening; Escape before then closes a
    // dialog that never held focus, so there is nothing to hand back.
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Got it' })).toHaveFocus(),
    );
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: /what's new/i })).toHaveFocus());
  });

  it('never lowers a newer stored version after a rollback', async () => {
    window.localStorage.setItem(LAST_SEEN, '9.4.0');
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /what's new/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.localStorage.getItem(LAST_SEEN)).toBe('9.4.0');
  });
});
