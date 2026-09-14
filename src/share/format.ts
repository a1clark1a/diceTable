import type { Expression } from '../types';
import { validateExpression } from '../state/persistedSchema';

export const EXPORT_FORMAT_TAG = 'dicetable-rolls' as const;
export const EXPORT_VERSION = 4 as const;

// v1 predates pool mode. Its rows carry no `mode`, which validateExpression reads
// as a sum row, so old links and files keep importing unchanged. v3 rows may carry
// `keepAcross` and `check`, optional fields older readers simply never wrote.
// v4 drops row and part ids, which every import throws away anyway.
const ACCEPTED_EXPORT_VERSIONS: readonly number[] = [1, 2, 3, 4];

export interface ExportEnvelope {
  format: typeof EXPORT_FORMAT_TAG;
  exportVersion: typeof EXPORT_VERSION;
  rolls: Expression[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Ids are dead weight on the wire: both import paths run every row through
// reIdExpression, so not one of them survives arrival. They are also the least
// compressible part of the payload, being random, which is why dropping them
// takes a hundred rows from 9,802 characters to 2,746.
function omitId(v: object): Record<string, unknown> {
  const out: Record<string, unknown> = { ...v };
  delete out.id;
  return out;
}

function withoutIds(expr: Expression): Record<string, unknown> {
  const out = omitId(expr);
  out.parts = expr.parts.map(omitId);
  if (expr.check !== undefined) {
    out.check = {
      ...expr.check,
      effect: {
        ...expr.check.effect,
        parts: expr.check.effect.parts.map(omitId),
      },
    };
  }
  return out;
}

export function buildExportEnvelope(rolls: Expression[]): ExportEnvelope {
  return {
    format: EXPORT_FORMAT_TAG,
    exportVersion: EXPORT_VERSION,
    rolls: rolls.map(withoutIds) as unknown as Expression[],
  };
}

function withSynthesizedIds(raw: unknown, nextId: () => string): unknown {
  if (!isRecord(raw)) return raw;
  const out: Record<string, unknown> = { ...raw };
  if (!('id' in out) || typeof out.id !== 'string' || out.id.length === 0) {
    out.id = nextId();
  }
  if (Array.isArray(out.parts)) {
    out.parts = out.parts.map((p) =>
      isRecord(p) && (typeof p.id !== 'string' || p.id.length === 0)
        ? { ...p, id: nextId() }
        : p,
    );
  }
  if (isRecord(out.check) && isRecord(out.check.effect)) {
    const effect = out.check.effect;
    if (Array.isArray(effect.parts)) {
      out.check = {
        ...out.check,
        effect: {
          ...effect,
          parts: effect.parts.map((p) =>
            isRecord(p) && (typeof p.id !== 'string' || p.id.length === 0)
              ? { ...p, id: nextId() }
              : p,
          ),
        },
      };
    }
  }
  return out;
}

/**
 * Whether a payload claims a format this build is too old to read. The service
 * worker means a user can be running a cached older build when a newer link
 * arrives, and "corrupted, try re-exporting" is advice that produces another
 * one of the same. Reloading is what actually fixes it.
 */
export function isFutureExportVersion(raw: unknown): boolean {
  return (
    isRecord(raw) &&
    raw.format === EXPORT_FORMAT_TAG &&
    typeof raw.exportVersion === 'number' &&
    raw.exportVersion > EXPORT_VERSION
  );
}

export function validateExportPayload(raw: unknown): Expression[] | null {
  if (!isRecord(raw)) return null;
  if (raw.format !== EXPORT_FORMAT_TAG) return null;
  if (typeof raw.exportVersion !== 'number') return null;
  if (!ACCEPTED_EXPORT_VERSIONS.includes(raw.exportVersion)) return null;
  if (!Array.isArray(raw.rolls)) return null;

  const rolls: Expression[] = [];
  let counter = 0;
  for (const rawRoll of raw.rolls) {
    // validateExpression requires an id on every row and part, and it is right
    // to: localStorage needs stable keys. The wire does not, so one is filled in
    // here. A local counter rather than newId, to keep share/ from depending on
    // state/; both import paths replace these immediately anyway.
    const expr = validateExpression(withSynthesizedIds(rawRoll, () => `imp-${counter++}`));
    if (expr === null) return null;
    rolls.push(expr);
  }
  return rolls;
}
