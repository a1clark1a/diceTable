import { describe, expect, it } from 'vitest';
import type { Expression } from '../types';
import {
  buildExportEnvelope,
  EXPORT_FORMAT_TAG,
  EXPORT_VERSION,
  validateExportPayload,
} from './format';

const sampleExpr: Expression = {
  id: 'expr-1',
  name: 'Longbow',
  parts: [{ id: 'part-1', count: 1, sides: 20 }],
  flatModifier: 5,
  rollMode: 'normal',
};

describe('buildExportEnvelope', () => {
  it('produces an envelope with the format tag and version', () => {
    const env = buildExportEnvelope([sampleExpr]);
    expect(env.format).toBe(EXPORT_FORMAT_TAG);
    expect(env.exportVersion).toBe(EXPORT_VERSION);
    expect(env.rolls).toEqual([sampleExpr]);
  });
});

describe('validateExportPayload', () => {
  it('accepts a valid envelope and returns its rolls', () => {
    const env = buildExportEnvelope([sampleExpr]);
    expect(validateExportPayload(env)).toEqual([sampleExpr]);
  });

  it('accepts an empty rolls array', () => {
    const env = buildExportEnvelope([]);
    expect(validateExportPayload(env)).toEqual([]);
  });

  it('rejects non-objects', () => {
    expect(validateExportPayload(null)).toBeNull();
    expect(validateExportPayload(undefined)).toBeNull();
    expect(validateExportPayload(42)).toBeNull();
    expect(validateExportPayload('hello')).toBeNull();
    expect(validateExportPayload([])).toBeNull();
  });

  it('rejects wrong format tag', () => {
    expect(
      validateExportPayload({
        format: 'something-else',
        exportVersion: 1,
        rolls: [sampleExpr],
      }),
    ).toBeNull();
  });

  it('rejects wrong export version', () => {
    expect(
      validateExportPayload({
        format: EXPORT_FORMAT_TAG,
        exportVersion: 999,
        rolls: [sampleExpr],
      }),
    ).toBeNull();
  });

  it('rejects when rolls is not an array', () => {
    expect(
      validateExportPayload({
        format: EXPORT_FORMAT_TAG,
        exportVersion: EXPORT_VERSION,
        rolls: 'oops',
      }),
    ).toBeNull();
  });

  it('rejects when any roll is invalid', () => {
    expect(
      validateExportPayload({
        format: EXPORT_FORMAT_TAG,
        exportVersion: EXPORT_VERSION,
        rolls: [{ ...sampleExpr, parts: [] }],
      }),
    ).toBeNull();
  });

  it('round-trips through JSON', () => {
    const env = buildExportEnvelope([sampleExpr]);
    const round = JSON.parse(JSON.stringify(env)) as unknown;
    expect(validateExportPayload(round)).toEqual([sampleExpr]);
  });
});
