import { describe, expect, it } from 'vitest';
import type { Release } from './releases';
import { compareVersions, isVersion, maxVersion, parseVersion, releasesSince } from './versions';

function rel(version: string): Release {
  return { version, date: '2030-01-01', title: `Title ${version}`, highlights: ['One.', 'Two.'] };
}

describe('parseVersion', () => {
  it('reads a plain X.Y.Z string', () => {
    expect(parseVersion('2.10.3')).toEqual([2, 10, 3]);
  });

  it.each(['', '2.2', '2.2.0.1', 'v2.2.0', '2.2.0-beta', ' 2.2.0', '2.x.0'])(
    'rejects %j',
    (v) => {
      expect(parseVersion(v)).toBeNull();
      expect(isVersion(v)).toBe(false);
    },
  );
});

describe('compareVersions', () => {
  it('compares numerically, not as text', () => {
    expect(compareVersions('2.10.0', '2.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.9.9', '2.0.0')).toBeLessThan(0);
    expect(compareVersions('2.2.0', '2.2.0')).toBe(0);
  });

  it('orders on the patch number when major and minor match', () => {
    expect(compareVersions('2.2.1', '2.2.0')).toBeGreaterThan(0);
  });

  it('sorts a malformed string below every real version instead of throwing', () => {
    expect(compareVersions('garbage', '0.0.0')).toBeLessThan(0);
    expect(compareVersions('0.0.0', 'garbage')).toBeGreaterThan(0);
    expect(compareVersions('garbage', 'nonsense')).toBe(0);
  });
});

describe('maxVersion', () => {
  it('returns the newer of two versions in either order', () => {
    expect(maxVersion('2.4.0', '2.3.0')).toBe('2.4.0');
    expect(maxVersion('2.3.0', '2.4.0')).toBe('2.4.0');
  });
});

describe('releasesSince', () => {
  const releases = [rel('2.2.0'), rel('2.1.0'), rel('2.0.0'), rel('1.9.0')];

  it('returns releases after the last seen one, up to the current one, newest first', () => {
    expect(releasesSince(releases, '2.0.0', '2.2.0').map((r) => r.version)).toEqual([
      '2.2.0',
      '2.1.0',
    ]);
  });

  it('leaves out releases newer than the running build', () => {
    expect(releasesSince(releases, '1.9.0', '2.1.0').map((r) => r.version)).toEqual([
      '2.1.0',
      '2.0.0',
    ]);
  });

  it('returns every release up to the current one when there is no last seen version', () => {
    expect(releasesSince(releases, null, '2.0.0').map((r) => r.version)).toEqual([
      '2.0.0',
      '1.9.0',
    ]);
  });

  it('returns nothing when the last seen version is the current one', () => {
    expect(releasesSince(releases, '2.2.0', '2.2.0')).toEqual([]);
  });

  it('sorts newest first even when the input is out of order', () => {
    const shuffled = [rel('2.0.0'), rel('2.2.0'), rel('2.1.0')];
    expect(releasesSince(shuffled, '1.0.0', '2.2.0').map((r) => r.version)).toEqual([
      '2.2.0',
      '2.1.0',
      '2.0.0',
    ]);
  });

  it('does not reorder the array it was given', () => {
    const shuffled = [rel('2.0.0'), rel('2.2.0')];
    releasesSince(shuffled, null, '2.2.0');
    expect(shuffled.map((r) => r.version)).toEqual(['2.0.0', '2.2.0']);
  });
});
