import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { RollHistoryProvider } from '../../state/RollHistoryContext';
import { SCHEMA_VERSION } from '../../state/persistedSchema';
import { useApp } from '../../state/useApp';
import { RollsTable } from '../RollsTable';
import { RollsCards } from '../RollsCards';
import type { Expression, ModStep, PersistedState } from '../../types';

// Hand-computed fixtures. 2d6 has mean 7, so:
//   [+3, ×2] → (7 + 3) × 2 = 20
//   [×2, +3] → 7 × 2 + 3   = 17
//   [+5]     → 7 + 5       = 12
//   [−2]     → 7 − 2       = 5

const SUM_ROW_NAME = 'Hit';

function sumRow(mods?: ModStep[]): Expression {
  return {
    id: 'hit',
    name: SUM_ROW_NAME,
    parts: [{ id: 'hit-part', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...(mods ? { mods } : {}),
  };
}

function poolRow(mods: ModStep[]): Expression {
  return {
    id: 'pool',
    name: 'Pool',
    parts: [{ id: 'pool-part', count: 6, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 4 },
    mods,
  };
}

const longswordCheck: Expression = {
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

function seed(row: Expression, expandedId: string | null = null) {
  const state: PersistedState = {
    version: SCHEMA_VERSION,
    expressions: [row],
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

interface StoredModifier {
  flatModifier: number;
  mods: ModStep[] | null;
}

// Serializing state into the DOM keeps the probe pure (no writes to test
// scope during render, which react-hooks/globals forbids).
function StoredRowProbe() {
  const { expressions } = useApp();
  const row = expressions[0];
  const stored: StoredModifier | null =
    row === undefined ? null : { flatModifier: row.flatModifier, mods: row.mods ?? null };
  return <div data-testid="stored-row">{JSON.stringify(stored)}</div>;
}

function storedRow(): StoredModifier | null {
  return JSON.parse(
    screen.getByTestId('stored-row').textContent ?? 'null',
  ) as StoredModifier | null;
}

function renderTable() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <RollHistoryProvider>
          <RollsTable />
          <StoredRowProbe />
        </RollHistoryProvider>
      </AppProvider>
    </ChakraProvider>,
  );
}

function renderCards() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <RollHistoryProvider>
          <RollsCards />
        </RollHistoryProvider>
      </AppProvider>
    </ChakraProvider>,
  );
}

const modInput = () => screen.getByRole('textbox', { name: 'Modifier' });
const chainButton = () => screen.getByRole('button', { name: /^Modifier steps:/ });

function typeAndBlur(field: HTMLElement, raw: string) {
  fireEvent.change(field, { target: { value: raw } });
  fireEvent.blur(field);
}

function meanText(name = SUM_ROW_NAME): string | null {
  return screen.getByRole('button', { name: `Inspect mean for ${name}` }).textContent;
}

function formulaText(name = SUM_ROW_NAME): string | null {
  return screen.getByRole('button', { name: `Inspect distribution for ${name}` }).textContent;
}

afterEach(() => {
  window.localStorage.clear();
});

describe('ModBox as a number to type', () => {
  it('shows a lone add step as its number', () => {
    seed(sumRow([{ op: 'add', value: 3 }]));
    renderTable();
    expect(modInput()).toHaveValue('3');
  });

  it('shows a lone subtract step as a negative number', () => {
    seed(sumRow([{ op: 'sub', value: 2 }]));
    renderTable();
    expect(modInput()).toHaveValue('-2');
  });

  it('shows 0 for a row with no chain', () => {
    seed(sumRow());
    renderTable();
    expect(modInput()).toHaveValue('0');
  });

  it('stores a typed 5 as one add step', () => {
    seed(sumRow([{ op: 'add', value: 3 }]));
    renderTable();
    typeAndBlur(modInput(), '5');
    expect(storedRow()).toEqual({ flatModifier: 0, mods: [{ op: 'add', value: 5 }] });
  });

  it('recomputes the row from the typed modifier', () => {
    seed(sumRow([{ op: 'add', value: 3 }]));
    renderTable();
    typeAndBlur(modInput(), '5');
    expect(formulaText()).toBe('2d6 + 5');
    expect(meanText()).toBe('12.00');
  });

  it('clears the chain when 0 is typed', () => {
    seed(sumRow([{ op: 'add', value: 3 }]));
    renderTable();
    typeAndBlur(modInput(), '0');
    expect(storedRow()).toEqual({ flatModifier: 0, mods: null });
    expect(formulaText()).toBe('2d6');
  });

  it('stores a typed -2 as a subtract step of size 2', () => {
    seed(sumRow());
    renderTable();
    typeAndBlur(modInput(), '-2');
    expect(storedRow()).toEqual({ flatModifier: 0, mods: [{ op: 'sub', value: 2 }] });
    expect(meanText()).toBe('5.00');
  });

  it('accepts a leading plus sign', () => {
    seed(sumRow());
    renderTable();
    typeAndBlur(modInput(), '+4');
    expect(storedRow()).toEqual({ flatModifier: 0, mods: [{ op: 'add', value: 4 }] });
  });

  it('edits a check row’s modifier as the check roll’s own number', () => {
    seed(longswordCheck);
    renderTable();
    expect(modInput()).toHaveValue('7');
    typeAndBlur(modInput(), '5');
    expect(storedRow()).toEqual({ flatModifier: 5, mods: null });
  });
});

describe('ModBox reading out a longer chain', () => {
  it('shows the chain compactly instead of an input', () => {
    seed(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    expect(chainButton()).toHaveTextContent('+3 ×2');
    expect(screen.queryByRole('textbox', { name: 'Modifier' })).not.toBeInTheDocument();
  });

  it('reads each step aloud and says where to change them', () => {
    seed(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    expect(chainButton()).toHaveAccessibleName(
      'Modifier steps: plus 3, then times 2. Open the roll to change them.',
    );
  });

  it('reads a pool row’s adds as automatic successes', () => {
    seed(poolRow([{ op: 'add', value: 2 }, { op: 'mul', value: 2 }]));
    renderTable();
    expect(chainButton()).toHaveAccessibleName(
      'Modifier steps: plus 2 automatic successes, then times 2. Open the roll to change them.',
    );
  });

  it('shows a lone multiply as the chain, since it is not a number to add', () => {
    seed(sumRow([{ op: 'mul', value: 3 }]));
    renderTable();
    expect(chainButton()).toHaveTextContent('×3');
  });

  it('opens the row’s editor when clicked', () => {
    seed(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    expect(screen.queryByRole('combobox', { name: 'Step 1 operation' })).not.toBeInTheDocument();
    fireEvent.click(chainButton());
    expect(screen.getByRole('combobox', { name: 'Step 1 operation' })).toBeInTheDocument();
  });

  it('puts focus on the first step’s operation once the editor opens', () => {
    seed(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    fireEvent.click(chainButton());
    expect(screen.getByRole('combobox', { name: 'Step 1 operation' })).toHaveFocus();
  });

  it('puts focus on the first step’s operation when the editor is already open', () => {
    seed(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]), 'hit');
    renderTable();
    expect(screen.getByRole('combobox', { name: 'Step 1 operation' })).not.toHaveFocus();
    fireEvent.click(chainButton());
    expect(screen.getByRole('combobox', { name: 'Step 1 operation' })).toHaveFocus();
  });
});

describe('ModBox following the chain editor', () => {
  // Typed into the Mod cell, then doubled from the editor, as a user would.
  function setPlusThreeThenTimesTwo() {
    seed(sumRow());
    renderTable();
    typeAndBlur(modInput(), '3');
    fireEvent.click(screen.getByRole('button', { name: 'Expand row' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a step' }));
  }

  it('setting +3 then ×2 shows +3 ×2 in the table', () => {
    setPlusThreeThenTimesTwo();
    expect(chainButton()).toHaveTextContent('+3 ×2');
  });

  it('setting +3 then ×2 changes the row’s mean to 20', () => {
    setPlusThreeThenTimesTwo();
    expect(meanText()).toBe('20.00');
  });

  it('reordering to ×2 +3 changes the table text to follow', () => {
    setPlusThreeThenTimesTwo();
    fireEvent.click(screen.getByRole('button', { name: 'Move step 2 earlier' }));
    expect(chainButton()).toHaveTextContent('×2 +3');
    expect(chainButton()).toHaveAccessibleName(
      'Modifier steps: times 2, then plus 3. Open the roll to change them.',
    );
  });

  it('reordering to ×2 +3 changes the row’s mean from 20 to 17', () => {
    setPlusThreeThenTimesTwo();
    fireEvent.click(screen.getByRole('button', { name: 'Move step 2 earlier' }));
    expect(meanText()).toBe('17.00');
  });

  it('goes back to a number to type once the chain is one add step again', () => {
    setPlusThreeThenTimesTwo();
    fireEvent.click(screen.getByRole('button', { name: 'Remove step 2' }));
    expect(modInput()).toHaveValue('3');
  });
});

describe('ModBox on a card', () => {
  it('shows a longer chain compactly', () => {
    seed(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderCards();
    expect(chainButton()).toHaveTextContent('+3 ×2');
  });

  it('opens the card’s editor and focuses the first step', () => {
    seed(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderCards();
    fireEvent.click(chainButton());
    expect(screen.getByRole('combobox', { name: 'Step 1 operation' })).toHaveFocus();
  });

  it('turns a typed modifier into the chain’s first step', () => {
    seed(sumRow());
    renderCards();
    typeAndBlur(modInput(), '3');
    fireEvent.click(screen.getByRole('button', { name: 'Expand card' }));
    expect(screen.getByRole('group', { name: 'Step 1 of 1: plus 3' })).toBeInTheDocument();
  });
});
