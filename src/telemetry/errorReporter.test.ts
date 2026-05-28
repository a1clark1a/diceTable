import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Reporter = typeof import('./errorReporter');

async function loadFresh(): Promise<Reporter> {
  vi.resetModules();
  return await import('./errorReporter');
}

function lastBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const calls = fetchMock.mock.calls;
  const init = calls[calls.length - 1]?.[1] as RequestInit | undefined;
  const body = init?.body;
  if (typeof body !== 'string') throw new Error('fetch body was not a string');
  return JSON.parse(body) as Record<string, unknown>;
}

describe('errorReporter', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('initErrorReporter is idempotent: a second call does not re-register listeners', async () => {
    const { initErrorReporter } = await loadFresh();
    const add = vi.spyOn(window, 'addEventListener');

    initErrorReporter();
    const afterFirst = add.mock.calls.length;
    initErrorReporter();
    const afterSecond = add.mock.calls.length;

    expect(afterFirst).toBe(2);
    expect(afterSecond).toBe(afterFirst);
  });

  it('truncates msg, stack, and url to their server-side caps', async () => {
    const { reportError } = await loadFresh();
    const longMsg = 'm'.repeat(800);
    const longStack = 's'.repeat(5000);

    const err = new Error(longMsg);
    err.stack = longStack;
    reportError(err);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = lastBody(fetchMock);
    expect((body['msg'] as string).length).toBe(500);
    expect((body['stack'] as string).length).toBe(4000);
    expect((body['url'] as string).length).toBeLessThanOrEqual(200);
  });

  it('stops sending after the session cap of 10 errors', async () => {
    const { reportError } = await loadFresh();

    for (let i = 0; i < 15; i += 1) {
      reportError(new Error(`boom ${i}`));
    }

    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it('does not throw when fetch rejects', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('network down')));
    const { reportError } = await loadFresh();

    expect(() => reportError(new Error('boom'))).not.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('dedupes: the same Error instance reported twice triggers exactly one fetch', async () => {
    const { reportError } = await loadFresh();
    const err = new Error('once');

    reportError(err);
    reportError(err);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a url with no query string even when the page URL has one', async () => {
    const { reportError } = await loadFresh();
    const originalUrl = window.location.href;
    window.history.replaceState({}, '', '/some/path?secret=abc&x=1');
    try {
      reportError(new Error('boom'));
    } finally {
      window.history.replaceState({}, '', originalUrl);
    }

    const body = lastBody(fetchMock);
    expect(body['url']).toBe('/some/path');
  });

  it('POSTs JSON to /api/errors with keepalive', async () => {
    const { reportError } = await loadFresh();
    reportError(new Error('boom'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/errors');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(init.keepalive).toBe(true);
  });
});
