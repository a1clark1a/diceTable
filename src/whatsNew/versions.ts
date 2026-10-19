import type { Release } from './releases';

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

type Parsed = readonly [number, number, number];

export function parseVersion(v: string): Parsed | null {
  const m = VERSION_RE.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isVersion(v: string): boolean {
  return parseVersion(v) !== null;
}

// Total so that a malformed string can never throw from inside a render: it
// sorts below every real version, and two malformed strings tie.
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa === null || pb === null) return (pa === null ? 0 : 1) - (pb === null ? 0 : 1);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function maxVersion(a: string, b: string): string {
  return compareVersions(a, b) >= 0 ? a : b;
}

/** Releases newer than `after` (all of them when null), up to and including `upTo`, newest first. */
export function releasesSince(
  releases: readonly Release[],
  after: string | null,
  upTo: string,
): Release[] {
  return releases
    .filter(
      (r) =>
        (after === null || compareVersions(r.version, after) > 0) &&
        compareVersions(r.version, upTo) <= 0,
    )
    .sort((a, b) => compareVersions(b.version, a.version));
}
