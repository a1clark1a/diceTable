import type { IncomingMessage, ServerResponse } from 'node:http';

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

function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }

  const contentType = req.headers['content-type'];
  if (typeof contentType !== 'string' || !contentType.toLowerCase().includes('application/json')) {
    res.statusCode = 415;
    res.end();
    return;
  }

  const contentLength = req.headers['content-length'];
  if (typeof contentLength === 'string' && Number(contentLength) > MAX_BODY_BYTES) {
    res.statusCode = 413;
    res.end();
    return;
  }

  const raw = await readBody(req, MAX_BODY_BYTES);
  if (raw === null) {
    res.statusCode = 413;
    res.end();
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    res.statusCode = 400;
    res.end();
    return;
  }

  if (!isErrorReport(parsed)) {
    res.statusCode = 400;
    res.end();
    return;
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

  res.statusCode = 204;
  res.end();
}
