import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import type { DicePart } from '../types';
import type { PartPatch } from '../state/useApp';

// Counting stub for the editor leaf. The fix under test stabilizes the
// per-part onChange/onRemove closures and memoizes the part wrapper, so a
// commit on one part must not re-render the sibling part's editor subtree.
// Replacing the heavy real DicePartRow with this stub lets us observe whether
// the memo'd wrapper actually bails: if it does, the stub is never re-rendered
// for the untouched part and its counter stays put.
const { renderCounts } = vi.hoisted(() => ({
  renderCounts: {} as Record<string, number>,
}));

vi.mock('./editor/DicePartRow', () => ({
  DicePartRow: ({
    part,
    onChange,
  }: {
    part: DicePart;
    onChange: (patch: PartPatch) => void;
    onRemove: () => void;
    canRemove: boolean;
  }) => {
    renderCounts[part.id] = (renderCounts[part.id] ?? 0) + 1;
    return (
      <input
        data-testid={`dpr-${part.id}`}
        value={String(part.count)}
        onChange={(e) => onChange({ count: Number(e.target.value) })}
      />
    );
  },
}));

// Imports must follow the mock so RollExpand picks up the stubbed leaf.
const { AppProvider } = await import('../state/AppContext');
const { useApp } = await import('../state/useApp');
const { RollExpand } = await import('./RollExpand');

const SEED_EXPR_ID = 'seed-4d6kh3';
const SEED_PART_ID = 'seed-4d6kh3-part';

function Harness() {
  const { expressions } = useApp();
  const expr = expressions.find((e) => e.id === SEED_EXPR_ID);
  if (!expr) return null;
  return <RollExpand expression={expr} />;
}

function renderEditor() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <Harness />
      </AppProvider>
    </ChakraProvider>,
  );
}

function resetCounts() {
  for (const k of Object.keys(renderCounts)) delete renderCounts[k];
}

function secondPartId(): string {
  const other = Object.keys(renderCounts).find((k) => k !== SEED_PART_ID);
  if (!other) throw new Error('expected a second part to have rendered');
  return other;
}

afterEach(() => {
  resetCounts();
  window.localStorage.clear();
});

describe('RollExpand part-edit isolation', () => {
  it('a Count commit on one part does not re-render the sibling part editor', () => {
    renderEditor();
    // Seed expression has one part; add a second via the real button.
    fireEvent.click(screen.getByRole('button', { name: /add part/i }));
    const otherId = secondPartId();

    resetCounts();

    const first = screen.getByTestId(`dpr-${SEED_PART_ID}`) as HTMLInputElement;
    fireEvent.change(first, { target: { value: '5' } });

    // Edited part re-rendered and reflects the committed value...
    expect(renderCounts[SEED_PART_ID] ?? 0).toBeGreaterThanOrEqual(1);
    expect(
      (screen.getByTestId(`dpr-${SEED_PART_ID}`) as HTMLInputElement).value,
    ).toBe('5');
    // ...the untouched sibling part's editor did not re-render at all.
    expect(renderCounts[otherId] ?? 0).toBe(0);
  });

  it('an unrelated RollExpand re-render (roll-mode toggle) re-renders no part editors', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /add part/i }));
    const otherId = secondPartId();

    resetCounts();

    // Roll mode lives on the expression, not on any part. Committing it
    // replaces the expression ref and re-renders RollExpand, but every part
    // ref is preserved, so the stable-closure + memo fix must bail both parts.
    fireEvent.click(screen.getByRole('button', { name: 'Advantage' }));

    expect(renderCounts[SEED_PART_ID] ?? 0).toBe(0);
    expect(renderCounts[otherId] ?? 0).toBe(0);
  });

  it('keeps editing the correct part after a sibling is added (no stale binding)', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /add part/i }));
    const otherId = secondPartId();

    // Edit the *second* part; only it must update and re-render.
    resetCounts();
    const second = screen.getByTestId(`dpr-${otherId}`) as HTMLInputElement;
    fireEvent.change(second, { target: { value: '9' } });

    expect((screen.getByTestId(`dpr-${otherId}`) as HTMLInputElement).value).toBe(
      '9',
    );
    expect((screen.getByTestId(`dpr-${SEED_PART_ID}`) as HTMLInputElement).value).toBe(
      '4',
    );
    expect(renderCounts[SEED_PART_ID] ?? 0).toBe(0);
  });
});
