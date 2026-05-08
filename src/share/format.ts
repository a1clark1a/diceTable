import type { Expression } from '../types';
import { validateExpression } from '../state/persistedSchema';

export const EXPORT_FORMAT_TAG = 'dicetable-rolls' as const;
export const EXPORT_VERSION = 1 as const;

export interface ExportEnvelope {
  format: typeof EXPORT_FORMAT_TAG;
  exportVersion: typeof EXPORT_VERSION;
  rolls: Expression[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function buildExportEnvelope(rolls: Expression[]): ExportEnvelope {
  return {
    format: EXPORT_FORMAT_TAG,
    exportVersion: EXPORT_VERSION,
    rolls,
  };
}

export function validateExportPayload(raw: unknown): Expression[] | null {
  if (!isRecord(raw)) return null;
  if (raw.format !== EXPORT_FORMAT_TAG) return null;
  if (raw.exportVersion !== EXPORT_VERSION) return null;
  if (!Array.isArray(raw.rolls)) return null;

  const rolls: Expression[] = [];
  for (const rawRoll of raw.rolls) {
    const expr = validateExpression(rawRoll);
    if (expr === null) return null;
    rolls.push(expr);
  }
  return rolls;
}
