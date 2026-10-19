import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { useApp } from '../../state/useApp';
import { SCHEMA_VERSION } from '../../state/persistedSchema';
import { RollExpand } from '../RollExpand';
import { MAX_EXPRESSIONS, type Expression, type PersistedState } from '../../types';

// A list shaped like the table: one keyed item per row, with the editor (and so
// RowTools) mounted only under the expanded row. Keyed items mean a move really
// relocates the editor's DOM, which is what the focus handling exists for.
function Rows() {
  const { expressions, expandedId, setExpandedId } = useApp();
  return (
    <ol aria-label="Rolls">
      {expressions.map((e) => (
        <li key={e.id} data-name={e.name}>
          <button type="button" onClick={() => setExpandedId(e.id)}>
            Open {e.name}
          </button>
          {e.id === expandedId && <RollExpand expression={e} />}
        </li>
      ))}
    </ol>
  );
}

function renderRows() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <Rows />
      </AppProvider>
    </ChakraProvider>,
  );
}

function rowNames(): string[] {
  const list = screen.getByRole('list', { name: 'Rolls' });
  return within(list)
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('data-name') ?? '');
}

function sumRow(id: string, name: string, flatModifier = 0): Expression {
  return {
    id,
    name,
    parts: [{ id: `${id}-part`, count: 2, sides: 6 }],
    flatModifier,
    rollMode: 'normal',
    mode: 'sum',
  };
}

const CHECK_ROW: Expression = {
  id: 'check-row',
  name: 'Longsword',
  parts: [{ id: 'check-part', count: 1, sides: 20 }],
  flatModifier: 7,
  rollMode: 'normal',
  mode: 'check',
  check: {
    threshold: { direction: 'gte', value: 15 },
    effect: { parts: [{ id: 'effect-part', count: 1, sides: 8 }], flatModifier: 4 },
    onSuccess: 'full',
    onFailure: 'none',
  },
};

function seed(expressions: Expression[], expandedId: string | null) {
  const state: PersistedState = {
    version: SCHEMA_VERSION,
    expressions,
    ui: {
      expandedId,
      chartViews: { totals: 'pmf', successes: 'pmf', shape: 'pmf' },
      target: { values: [], ruling: 'gte' },
      view: 'table',
      poolTargets: [1],
      baselineId: null,
      targetSubView: 'grid',
      targetFilter: 'all',
      targetSort: null,
      rollOffSort: 'win',
    },
  };
  window.localStorage.setItem('dicetable.v2', JSON.stringify({ version: 2, value: state }));
}

function seedThree(expandedId: string) {
  seed([sumRow('a', 'Axe'), sumRow('b', 'Bow'), sumRow('c', 'Club')], expandedId);
}

function seedFour(expandedId: string) {
  seed(
    [sumRow('a', 'Axe'), sumRow('b', 'Bow'), sumRow('c', 'Club'), sumRow('d', 'Dart')],
    expandedId,
  );
}

// dom-accessibility-api trims each child's text before joining inline
// siblings, so the visually hidden " of <name>" computes as "Variantsof
// <name>" here although a browser reads "Variants of <name>". The regex
// tolerates only that one space; the text content pins the real wording.
function variantsTrigger(name: string): HTMLElement {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const trigger = screen.getByRole('button', {
    name: new RegExp(`^Variants ?of ${escaped}$`),
  });
  expect(trigger).toHaveTextContent(`Variants of ${name}`);
  return trigger;
}

const moveUp = () => screen.getByRole('button', { name: 'Move roll up' });
const moveDown = () => screen.getByRole('button', { name: 'Move roll down' });

afterEach(() => {
  window.localStorage.clear();
});

describe('RowTools move buttons', () => {
  it('blocks Move up on the first row but leaves Move down live', () => {
    seedThree('a');
    renderRows();
    expect(moveUp()).toHaveAttribute('aria-disabled', 'true');
    expect(moveDown()).not.toHaveAttribute('aria-disabled');
  });

  it('blocks Move down on the last row but leaves Move up live', () => {
    seedThree('c');
    renderRows();
    expect(moveDown()).toHaveAttribute('aria-disabled', 'true');
    expect(moveUp()).not.toHaveAttribute('aria-disabled');
  });

  it('keeps a blocked button focusable rather than natively disabled', () => {
    seedThree('a');
    renderRows();
    expect(moveUp()).not.toBeDisabled();
    moveUp().focus();
    expect(moveUp()).toHaveFocus();
  });

  it('does nothing when the blocked Move up is pressed on the first row', () => {
    seedThree('a');
    renderRows();
    fireEvent.click(moveUp());
    expect(rowNames()).toEqual(['Axe', 'Bow', 'Club']);
    expect(screen.queryByText(/^Moved to/)).toBeNull();
  });

  it('does nothing when the blocked Move down is pressed on the last row', () => {
    seedThree('c');
    renderRows();
    fireEvent.click(moveDown());
    expect(rowNames()).toEqual(['Axe', 'Bow', 'Club']);
  });

  it('moves the row up one place', () => {
    seedThree('b');
    renderRows();
    fireEvent.click(moveUp());
    expect(rowNames()).toEqual(['Bow', 'Axe', 'Club']);
  });

  it('moves the row down one place', () => {
    seedThree('b');
    renderRows();
    fireEvent.click(moveDown());
    expect(rowNames()).toEqual(['Axe', 'Club', 'Bow']);
  });

  it('keeps focus on Move down after the row moves down', () => {
    seedFour('b');
    renderRows();
    moveDown().focus();
    fireEvent.click(moveDown());
    expect(rowNames()).toEqual(['Axe', 'Club', 'Bow', 'Dart']);
    expect(moveDown()).toHaveFocus();
  });

  it('keeps focus on Move up after the row moves up', () => {
    seedFour('c');
    renderRows();
    moveUp().focus();
    fireEvent.click(moveUp());
    expect(rowNames()).toEqual(['Axe', 'Club', 'Bow', 'Dart']);
    expect(moveUp()).toHaveFocus();
  });

  // Reaching an end blocks the button that was just pressed. It must stay the
  // same element, or focus falls to the page the moment the row arrives.
  it('keeps focus on Move up when it carries the row to the top', () => {
    seedThree('b');
    renderRows();
    const before = moveUp();
    before.focus();
    fireEvent.click(before);
    expect(rowNames()).toEqual(['Bow', 'Axe', 'Club']);
    expect(moveUp()).toBe(before);
    expect(moveUp()).toHaveAttribute('aria-disabled', 'true');
    expect(moveUp()).toHaveFocus();
  });

  it('keeps focus on Move down when it carries the row to the bottom', () => {
    seedThree('b');
    renderRows();
    const before = moveDown();
    before.focus();
    fireEvent.click(before);
    expect(rowNames()).toEqual(['Axe', 'Club', 'Bow']);
    expect(moveDown()).toBe(before);
    expect(moveDown()).toHaveFocus();
  });

  it('announces the new position in a polite status region', () => {
    seedThree('c');
    renderRows();
    fireEvent.click(moveUp());
    const region = screen.getByText('Moved to 2 of 3');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('announces each move, counting from one', () => {
    seedThree('c');
    renderRows();
    fireEvent.click(moveUp());
    fireEvent.click(moveUp());
    expect(screen.getByText('Moved to 1 of 3')).toHaveAttribute('role', 'status');
  });

  it('keeps the moved row expanded', () => {
    seedThree('a');
    renderRows();
    fireEvent.click(moveDown());
    expect(screen.getByRole('button', { name: 'Duplicate Axe' })).toBeInTheDocument();
  });
});

describe('RowTools duplicate', () => {
  it('names the row it copies', () => {
    seedThree('b');
    renderRows();
    expect(screen.getByRole('button', { name: 'Duplicate Bow' })).toBeInTheDocument();
  });

  it('inserts the copy directly below its source', () => {
    seedThree('b');
    renderRows();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Bow' }));
    expect(rowNames()).toEqual(['Axe', 'Bow', 'Bow (2)', 'Club']);
  });

  it('opens the copy and puts focus on its Duplicate button', async () => {
    seedThree('b');
    renderRows();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Bow' }));
    const copyButton = await screen.findByRole('button', { name: 'Duplicate Bow (2)' });
    await waitFor(() => expect(copyButton).toHaveFocus());
    // The source's editor closed, so only the copy offers Duplicate.
    expect(screen.queryByRole('button', { name: 'Duplicate Bow' })).toBeNull();
  });

  it('names a second copy of the same source (3) and lands it directly below the source', () => {
    seedThree('b');
    renderRows();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Bow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Bow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Bow' }));
    expect(rowNames()).toEqual(['Axe', 'Bow', 'Bow (3)', 'Bow (2)', 'Club']);
  });

  it('keeps the copy’s own controls live when there is room', () => {
    seedThree('b');
    renderRows();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Bow' }));
    expect(screen.getByRole('button', { name: 'Duplicate Bow (2)' })).not.toHaveAttribute(
      'aria-disabled',
    );
    // The copy sits between Bow and Club, so it can move either way.
    expect(moveUp()).not.toHaveAttribute('aria-disabled');
    expect(moveDown()).not.toHaveAttribute('aria-disabled');
  });

  it('is blocked and refuses at the row cap', () => {
    const full = Array.from({ length: MAX_EXPRESSIONS }, (_, i) => sumRow(`r${i}`, `Roll ${i}`));
    seed(full, 'r0');
    renderRows();
    const dup = screen.getByRole('button', { name: 'Duplicate Roll 0' });
    expect(dup).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(dup);
    expect(rowNames()).toHaveLength(MAX_EXPRESSIONS);
  });
});

describe('RowTools Variants trigger', () => {
  it('names the row it varies', () => {
    seedThree('b');
    renderRows();
    expect(variantsTrigger('Bow')).toBeInTheDocument();
  });

  it('is live on a sum row', () => {
    seedThree('b');
    renderRows();
    expect(variantsTrigger('Bow')).not.toHaveAttribute('aria-disabled');
  });

  it('is blocked on a check row and opens nothing', async () => {
    seed([CHECK_ROW], CHECK_ROW.id);
    renderRows();
    const trigger = variantsTrigger('Longsword');
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(trigger);
    // Give a popover or dialog machine the beat it needs to open, if it were going to.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Value to vary' })).toBeNull();
  });

  it('is blocked at the row cap', () => {
    const full = Array.from({ length: MAX_EXPRESSIONS }, (_, i) => sumRow(`r${i}`, `Roll ${i}`));
    seed(full, 'r0');
    renderRows();
    expect(variantsTrigger('Roll 0')).toHaveAttribute('aria-disabled', 'true');
  });

  // The sweep that fills the table also blocks the trigger. It has to stay the
  // same button, or the popover hands focus back to one that no longer exists.
  // jsdom does not run the popover's focus restore, so the identity is what is
  // asserted here.
  it('keeps the same trigger button after a sweep that fills the table', async () => {
    const rows = Array.from({ length: MAX_EXPRESSIONS - 4 }, (_, i) => sumRow(`r${i}`, `Roll ${i}`));
    seed(rows, 'r0');
    renderRows();
    const trigger = variantsTrigger('Roll 0');
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('button', { name: /^Modifier, now/ }));
    const confirm = screen.getByRole('button', { name: 'Add 4 rolls' });
    confirm.focus();
    fireEvent.click(confirm);
    await waitFor(() => expect(rowNames()).toHaveLength(MAX_EXPRESSIONS));
    expect(variantsTrigger('Roll 0')).toBe(trigger);
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(trigger.isConnected).toBe(true);
  });
  // The sweep that fills the table also blocks the trigger. It has to stay the
  // same button, or the popover hands focus back to one that no longer exists.
});

describe('TapTip on a blocked control', () => {
  it('shows why Move up does nothing when the first row’s button is tapped', async () => {
    seedThree('a');
    renderRows();
    fireEvent.pointerDown(moveUp(), { pointerType: 'touch' });
    expect(await screen.findByText('This roll is already at the top.')).toBeInTheDocument();
  });

  it('explains on a tap why a check row has no Variants', async () => {
    seed([CHECK_ROW], CHECK_ROW.id);
    renderRows();
    fireEvent.pointerDown(variantsTrigger('Longsword'), { pointerType: 'touch' });
    expect(await screen.findByText(/Variants work on Sum and Pool rolls/)).toBeInTheDocument();
  });

  it('lets a tapped tip go after a few seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      seedThree('a');
      renderRows();
      fireEvent.pointerDown(moveUp(), { pointerType: 'touch' });
      const tip = await screen.findByText('This roll is already at the top.');
      expect(tip).toBeVisible();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });
      await waitFor(() => {
        const gone = screen.queryByText('This roll is already at the top.');
        if (gone !== null) expect(gone).not.toBeVisible();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves the tip closed for a mouse press, which hover already covers', async () => {
    seedThree('a');
    renderRows();
    fireEvent.pointerDown(moveUp(), { pointerType: 'mouse' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('This roll is already at the top.')).toBeNull();
  });
});
