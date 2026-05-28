import { getUaFamily } from './uaFamily';

export interface ErrorReport {
  msg: string;
  stack: string;
  url: string;
  uaFamily: string;
  ts: number;
}

const FIELD_LIMITS = {
  msg: 500,
  stack: 4000,
  url: 200,
  uaFamily: 40,
} as const;

const SESSION_CAP = 10;
const ENDPOINT = '/api/errors';

let initialized = false;
let errorsSent = 0;
const seen = new WeakSet<object>();

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function stripQuery(pathname: string): string {
  const q = pathname.indexOf('?');
  return q === -1 ? pathname : pathname.slice(0, q);
}

function buildReport(err: unknown, componentStack?: string): ErrorReport {
  const isErrorLike = typeof err === 'object' && err !== null;
  const message = isErrorLike && 'message' in err && typeof (err as { message: unknown }).message === 'string'
    ? (err as { message: string }).message
    : String(err);
  const rawStack = isErrorLike && 'stack' in err && typeof (err as { stack: unknown }).stack === 'string'
    ? (err as { stack: string }).stack
    : '';
  const stack = componentStack ? `${rawStack}\n${componentStack}` : rawStack;
  return {
    msg: truncate(message, FIELD_LIMITS.msg),
    stack: truncate(stack, FIELD_LIMITS.stack),
    url: truncate(stripQuery(location.pathname), FIELD_LIMITS.url),
    uaFamily: truncate(getUaFamily(), FIELD_LIMITS.uaFamily),
    ts: Date.now(),
  };
}

export function reportError(err: unknown, componentStack?: string): void {
  try {
    if (errorsSent >= SESSION_CAP) return;
    if (typeof err === 'object' && err !== null) {
      if (seen.has(err)) return;
      seen.add(err);
    }
    errorsSent += 1;
    const report = buildReport(err, componentStack);
    const body = JSON.stringify(report);
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* telemetry must not throw */
    });
  } catch {
    /* telemetry must not throw */
  }
}

export function initErrorReporter(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    reportError(event.error ?? event.message);
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportError(event.reason);
  });
}
