import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Release } from './releases';
import { LAST_SEEN_KEY, decideOnOpen, markSeen, readLastSeen, type OpenInput } from './lastSeen';

function rel(version: string): Release {
  return { version, date: '2030-01-01', title: `Title ${version}`, highlights: ['One.', 'Two.'] };
}

const RELEASES = [rel('2.3.0'), rel('2.2.0'), rel('2.1.0'), rel('2.0.0')];

function decide(overrides: Partial<OpenInput>) {
  return decideOnOpen({
    read: { status: 'ok', version: '2.3.0' },
    current: '2.3.0',
    releases: RELEASES,
    hasSavedTable: true,
    shareVisit: false,
    ...overrides,
  });
}

const versions = (list: readonly Release[] | null) => list?.map((r) => r.version) ?? null;

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('decideOnOpen', () => {
  it('stays closed and writes nothing when storage is blocked', () => {
    expect(decide({ read: { status: 'unavailable' } })).toEqual({
      autoOpen: null,
      sinceVersion: null,
      recordNow: false,
    });
  });

  it('stays closed but records the version for a first-time visitor', () => {
    const d = decide({ read: { status: 'missing' }, hasSavedTable: false });
    expect(d.autoOpen).toBeNull();
    expect(d.recordNow).toBe(true);
  });

  it('records a first-time visitor who arrived by share link, so the saved table cannot make the next visit look like an old user', () => {
    const d = decide({ read: { status: 'missing' }, hasSavedTable: false, shareVisit: true });
    expect(d.autoOpen).toBeNull();
    expect(d.recordNow).toBe(true);
  });

  it('stays closed and writes nothing on a share visit by a returning user with unseen releases', () => {
    expect(decide({ read: { status: 'ok', version: '2.1.0' }, shareVisit: true })).toEqual({
      autoOpen: null,
      sinceVersion: null,
      recordNow: false,
    });
  });

  it('stays closed and writes nothing on a share visit by a user from before this feature', () => {
    const d = decide({ read: { status: 'missing' }, hasSavedTable: true, shareVisit: true });
    expect(d.autoOpen).toBeNull();
    expect(d.recordNow).toBe(false);
  });

  it('stays closed when the current version has already been seen', () => {
    expect(decide({ read: { status: 'ok', version: '2.3.0' } }).autoOpen).toBeNull();
  });

  it('stays closed and leaves a newer stored version alone after a rollback', () => {
    const d = decide({ read: { status: 'ok', version: '2.4.0' } });
    expect(d.autoOpen).toBeNull();
    expect(d.recordNow).toBe(false);
  });

  it('opens on every release since the last seen one, newest first', () => {
    const d = decide({ read: { status: 'ok', version: '2.0.0' } });
    expect(versions(d.autoOpen)).toEqual(['2.3.0', '2.2.0', '2.1.0']);
    expect(d.sinceVersion).toBe('2.0.0');
    expect(d.recordNow).toBe(false);
  });

  it('catches up silently when the version moved but no release has notes in between', () => {
    const d = decide({ read: { status: 'ok', version: '2.3.0' }, current: '2.3.1' });
    expect(d.autoOpen).toBeNull();
    expect(d.recordNow).toBe(true);
  });

  it('shows only the current release to a user from before this feature', () => {
    const d = decide({ read: { status: 'missing' }, hasSavedTable: true });
    expect(versions(d.autoOpen)).toEqual(['2.3.0']);
    expect(d.sinceVersion).toBeNull();
    expect(d.recordNow).toBe(false);
  });

  it('records silently for a user from before this feature when the current version has no notes', () => {
    const d = decide({ read: { status: 'missing' }, hasSavedTable: true, current: '2.3.1' });
    expect(d.autoOpen).toBeNull();
    expect(d.recordNow).toBe(true);
  });

  it('does nothing at all when the build has no usable version', () => {
    expect(decide({ read: { status: 'missing' }, hasSavedTable: false, current: '0.0' })).toEqual({
      autoOpen: null,
      sinceVersion: null,
      recordNow: false,
    });
  });
});

describe('readLastSeen', () => {
  it('reports a missing key as missing', () => {
    expect(readLastSeen()).toEqual({ status: 'missing' });
  });

  it('reads a stored version', () => {
    window.localStorage.setItem(LAST_SEEN_KEY, '2.2.0');
    expect(readLastSeen()).toEqual({ status: 'ok', version: '2.2.0' });
  });

  it('treats a malformed stored value as missing', () => {
    window.localStorage.setItem(LAST_SEEN_KEY, '{"v":"2.2.0"}');
    expect(readLastSeen()).toEqual({ status: 'missing' });
  });

  it('reports storage that throws as unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(readLastSeen()).toEqual({ status: 'unavailable' });
  });
});

describe('markSeen', () => {
  it('stores the current version when nothing is stored yet', () => {
    markSeen('2.3.0');
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).toBe('2.3.0');
  });

  it('moves an older stored version forward', () => {
    window.localStorage.setItem(LAST_SEEN_KEY, '2.1.0');
    markSeen('2.3.0');
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).toBe('2.3.0');
  });

  it('never moves a newer stored version backwards', () => {
    window.localStorage.setItem(LAST_SEEN_KEY, '2.4.0');
    markSeen('2.3.0');
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).toBe('2.4.0');
  });

  it('replaces a malformed stored value', () => {
    window.localStorage.setItem(LAST_SEEN_KEY, 'junk');
    markSeen('2.3.0');
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).toBe('2.3.0');
  });

  it('refuses to store a malformed version', () => {
    markSeen('0.0');
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).toBeNull();
  });

  it('does not throw when the write fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => markSeen('2.3.0')).not.toThrow();
  });
});
