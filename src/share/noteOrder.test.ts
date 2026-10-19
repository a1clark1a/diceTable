import { describe, expect, it } from 'vitest';
import { MAX_EXPRESSIONS, MAX_NOTE_LENGTH, type Expression } from '../types';
import { encodeRollsToHash, encodeRollsToJson } from './encode';
import { decodeFromHashFragment, decodeFromJsonString } from './decode';
import { buildExportEnvelope, validateExportPayload } from './format';

function roll(i: number, extra: Partial<Expression> = {}): Expression {
  return {
    id: `expr-${i}`,
    name: `Roll ${i}`,
    parts: [{ id: `part-${i}`, count: 1 + (i % 4), sides: [4, 6, 8, 10, 12, 20][i % 6]! }],
    flatModifier: 0,
    ...(i % 5 === 0 ? {} : { mods: [{ op: 'add' as const, value: i % 5 }] }),
    rollMode: 'normal',
    mode: 'sum',
    ...extra,
  };
}

// Deliberately not in id order, so a round trip that sorted by anything would show.
const orderedTable: Expression[] = [
  roll(3, { name: 'Greatsword', note: 'v2: 2d6, the d12 spiked too hard' }),
  roll(0, { name: 'Dagger' }),
  roll(7, { name: 'Longbow', note: 'Ranged baseline, keep this one pinned' }),
  roll(1, { name: 'Fire bolt', note: 'Cantrip at level 5' }),
];

function namesAndNotes(rolls: readonly Expression[]) {
  return rolls.map((r) => ({ name: r.name, note: r.note }));
}

/** A small seeded generator, so a failure reproduces with the same text. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FRAGMENTS = [
  'v2: d8 instead of d10,',
  'the d10 spiked too hard on crits.',
  'Feels right against AC 15',
  'but drops off past AC 18.',
  'Playtested with the Tuesday group,',
  'they liked the lower floor.',
  'Compare with the halberd row',
  'before locking this in.',
  'Advantage makes this one swingy,',
  'so check the spread band.',
  'Rerolling 1s once smooths the low end.',
  'Keep highest 3 is the house rule.',
  'Session 12 boss used this,',
  'too punishing at level 3.',
  'Matches the old +2 sword on average',
  'with a wider ceiling.',
];

function realisticNote(rand: () => number, row: number): string {
  let text = `Row ${row}:`;
  while (text.length < MAX_NOTE_LENGTH) {
    const pick = FRAGMENTS[Math.floor(rand() * FRAGMENTS.length)]!;
    text += ` ${pick}`;
  }
  return `${text.slice(0, MAX_NOTE_LENGTH - 1)}.`;
}

function randomNote(rand: () => number): string {
  let text = '';
  for (let i = 0; i < MAX_NOTE_LENGTH; i += 1) {
    // Printable ASCII; the ends are letters so the validator's trim keeps all 200.
    const edge = i === 0 || i === MAX_NOTE_LENGTH - 1;
    text += edge
      ? String.fromCharCode(97 + Math.floor(rand() * 26))
      : String.fromCharCode(32 + Math.floor(rand() * 95));
  }
  return text;
}

function fullTable(note: (row: number) => string): Expression[] {
  return Array.from({ length: MAX_EXPRESSIONS }, (_, i) =>
    roll(i, { name: `Roll number ${i}`, note: note(i) }),
  );
}

describe('notes and row order through a JSON export', () => {
  it('keep every note and the row order through validateExportPayload', () => {
    const parsed = JSON.parse(encodeRollsToJson(orderedTable)) as unknown;
    const rolls = validateExportPayload(parsed);
    expect(rolls).not.toBeNull();
    expect(namesAndNotes(rolls ?? [])).toEqual(namesAndNotes(orderedTable));
  });

  it('keep every note and the row order through the import path', () => {
    const decoded = decodeFromJsonString(encodeRollsToJson(orderedTable));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(namesAndNotes(decoded.rolls)).toEqual(namesAndNotes(orderedTable));
  });

  it('a row without a note arrives without a note key', () => {
    const decoded = decodeFromJsonString(encodeRollsToJson(orderedTable));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const dagger = decoded.rolls[1];
    expect(dagger?.name).toBe('Dagger');
    expect(dagger !== undefined && 'note' in dagger).toBe(false);
  });

  it('writes the note on the wire as the row carries it', () => {
    const envelope = buildExportEnvelope(orderedTable);
    const first = envelope.rolls[0] as unknown as Record<string, unknown>;
    expect(first.note).toBe('v2: 2d6, the d12 spiked too hard');
  });

  it(`refuses a hand-edited file carrying a note over ${MAX_NOTE_LENGTH} characters`, () => {
    const envelope = buildExportEnvelope([
      roll(0, { note: 'n'.repeat(MAX_NOTE_LENGTH + 1) }),
    ]);
    const json = JSON.stringify(envelope);
    expect(validateExportPayload(JSON.parse(json) as unknown)).toBeNull();
    expect(decodeFromJsonString(json)).toEqual({ ok: false, error: 'invalid-shape' });
  });
});

describe('notes and row order through a share link', () => {
  it('keep every note and the row order through encode and decode', () => {
    const decoded = decodeFromHashFragment(encodeRollsToHash(orderedTable));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(namesAndNotes(decoded.rolls)).toEqual(namesAndNotes(orderedTable));
  });

  it('keep the dice and modifier of each row in its own position', () => {
    const decoded = decodeFromHashFragment(encodeRollsToHash(orderedTable));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    decoded.rolls.forEach((r, i) => {
      const source = orderedTable[i]!;
      expect(r.mods).toEqual(source.mods);
      expect(r.parts.map(({ count, sides }) => ({ count, sides }))).toEqual(
        source.parts.map(({ count, sides }) => ({ count, sides })),
      );
    });
  });

  it(`a full table of ${MAX_EXPRESSIONS} rows with ${MAX_NOTE_LENGTH}-character realistic notes decodes intact`, () => {
    const rand = seeded(20261010);
    const table = fullTable((i) => realisticNote(rand, i));
    expect(table.every((r) => r.note?.length === MAX_NOTE_LENGTH)).toBe(true);
    const decoded = decodeFromHashFragment(encodeRollsToHash(table));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(namesAndNotes(decoded.rolls)).toEqual(namesAndNotes(table));
  });

  it(`a full table of ${MAX_EXPRESSIONS} rows with ${MAX_NOTE_LENGTH}-character random notes decodes intact`, () => {
    const rand = seeded(7);
    const table = fullTable(() => randomNote(rand));
    expect(table.every((r) => r.note?.length === MAX_NOTE_LENGTH)).toBe(true);
    const decoded = decodeFromHashFragment(encodeRollsToHash(table));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(namesAndNotes(decoded.rolls)).toEqual(namesAndNotes(table));
  });

  it('carries a note with non-Latin text and emoji', () => {
    const table = [roll(0, { note: 'Döner 🎲 крит 会心 — "quoted" & <tag>' })];
    const decoded = decodeFromHashFragment(encodeRollsToHash(table));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.rolls[0]?.note).toBe('Döner 🎲 крит 会心 — "quoted" & <tag>');
  });
});
