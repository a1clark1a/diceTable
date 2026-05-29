const MAX_BODY_BYTES = 10240;

const FIELD_LIMITS = {
  msg: 500,
  stack: 4000,
  url: 200,
  uaFamily: 40,
} as const;

interface ErrorReport {
  msg: string;
  stack: string;
  url: string;
  uaFamily: string;
  ts: number;
}

function isErrorReport(value: unknown): value is ErrorReport {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 5) return false;
  if (
    !('msg' in obj) ||
    !('stack' in obj) ||
    !('url' in obj) ||
    !('uaFamily' in obj) ||
    !('ts' in obj)
  ) {
    return false;
  }
  if (typeof obj['msg'] !== 'string' || obj['msg'].length > FIELD_LIMITS.msg) {
    return false;
  }
  if (typeof obj['stack'] !== 'string' || obj['stack'].length > FIELD_LIMITS.stack) {
    return false;
  }
  if (typeof obj['url'] !== 'string' || obj['url'].length > FIELD_LIMITS.url) {
    return false;
  }
  if (typeof obj['uaFamily'] !== 'string' || obj['uaFamily'].length > FIELD_LIMITS.uaFamily) {
    return false;
  }
  if (typeof obj['ts'] !== 'number' || !Number.isFinite(obj['ts'])) {
    return false;
  }
  return true;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  const contentType = request.headers.get('content-type');
  if (contentType === null || !contentType.toLowerCase().includes('application/json')) {
    return new Response(null, { status: 415 });
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return new Response(null, { status: 400 });
  }

  if (raw.length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!isErrorReport(parsed)) {
    return new Response(null, { status: 400 });
  }

  const line = {
    msg: parsed.msg,
    stack: parsed.stack,
    url: parsed.url,
    uaFamily: parsed.uaFamily,
    ts: parsed.ts,
    commit: process.env['VERCEL_GIT_COMMIT_SHA'] ?? 'unknown',
  };

  console.error('[telemetry/error]', JSON.stringify(line));

  return new Response(null, { status: 204 });
}
