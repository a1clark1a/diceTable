import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { useApp } from '../../state/useApp';
import { SCHEMA_VERSION } from '../../state/persistedSchema';
import { RollExpand } from '../RollExpand';
import { MAX_EXPRESSIONS, type Expression, type PersistedState } from '../../types';

// The table, reduced to what the sweep touches: one keyed item per row, in
// order, with the editor mounted under the expanded one.
function Rows() {
  const { expressions, expandedId } = useApp();
  return (
    <ol aria-label="Rolls">
      {expressions.map((e) => (
        <li key={e.id} data-name={e.name}>
          <span>{e.name}</span>
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

const TWO_D6: Expression = {
  id: 'two-d6',
  name: '2d6',
  parts: [{ id: 'two-d6-part', count: 2, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};

const MACE: Expression = {
  id: 'mace',
  name: 'Mace',
  parts: [{ id: 'mace-part', count: 2, sides: 6 }],
  flatModifier: 3,
  rollMode: 'normal',
  mode: 'sum',
};

const STAT: Expression = {
  id: 'stat',
  name: 'Stat',
  parts: [{ id: 'stat-part', count: 3, sides: 6, keep: { type: 'highest', n: 3 } }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};

const BLAST: Expression = {
  id: 'blast',
  name: 'Blast',
  parts: [{ id: 'blast-part', count: 1, sides: 6, explode: { onFaces: [6], depthCap: 3 } }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};

const POOL: Expression = {
  id: 'pool',
  name: 'Pool',
  parts: [{ id: 'pool-part', count: 6, sides: 6 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'pool',
  successThreshold: { direction: 'gte', value: 4 },
};

const MIXED: Expression = {
  id: 'mixed',
  name: 'Mixed',
  parts: [
    { id: 'mixed-a', count: 2, sides: 6 },
    { id: 'mixed-b', count: 1, sides: 8 },
  ],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};

const AFTER: Expression = {
  id: 'after',
  name: 'Dagger',
  parts: [{ id: 'after-part', count: 1, sides: 4 }],
  flatModifier: 0,
  rollMode: 'normal',
  mode: 'sum',
};

function seed(expressions: Expression[], expandedId: string) {
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

function seedOne(expr: Expression) {
  seed([expr, AFTER], expr.id);
}

/**
 * jsdom ships no matchMedia and the hook answers true without it, so the
 * default is the wide table layout and its popover. A phone has to say so.
 */
function mockPhone() {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// dom-accessibility-api joins "Variants" and the visually hidden " of <name>"
// without the space a browser keeps, so the trigger is found by its text.
function variantsTrigger(name: string): HTMLElement {
  const trigger = screen
    .getAllByRole('button')
    .find((b) => b.textContent === `Variants of ${name}`);
  if (trigger === undefined) throw new Error(`no Variants trigger for ${name}`);
  return trigger;
}

async function openVariants(name: string): Promise<HTMLElement> {
  fireEvent.click(variantsTrigger(name));
  return await screen.findByRole('dialog', { name: `Variants of ${name}` });
}

function varyGroup(panel: HTMLElement): HTMLElement {
  return within(panel).getByRole('group', { name: 'Value to vary' });
}

function pressedChips(panel: HTMLElement): HTMLElement[] {
  return within(varyGroup(panel)).getAllByRole('button', { pressed: true });
}

function diceGroup(panel: HTMLElement): HTMLElement {
  return within(panel).getByRole('group', { name: 'Dice to try' });
}

function confirmButton(panel: HTMLElement): HTMLElement {
  return within(panel).getByRole('button', { name: /^Add (\d+ )?rolls?$/ });
}

function setStepper(panel: HTMLElement, label: string, value: number) {
  const input = within(panel).getByRole('textbox', { name: label });
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

afterEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('SweepPanel chooser', () => {
  it('opens with exactly one value chosen, the die, on a sum row', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    const pressed = pressedChips(panel);
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAccessibleName('Die, now d6');
  });

  it('opens on the success number on a pool row', async () => {
    seedOne(POOL);
    renderRows();
    const panel = await openVariants('Pool');
    const pressed = pressedChips(panel);
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAccessibleName('Success, now ≥4');
  });

  it('calls a pool row’s modifier auto-successes', async () => {
    seedOne(POOL);
    renderRows();
    const panel = await openVariants('Pool');
    const group = varyGroup(panel);
    expect(within(group).getByRole('button', { name: 'Auto-successes, now +0' })).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: /^Modifier/ })).toBeNull();
  });

  it('offers Count, Die and Modifier on a plain sum row, and no Keep', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    const names = within(varyGroup(panel))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Count, now 2', 'Die, now d6', 'Modifier, now +0']);
  });

  it('offers Keep on a row that keeps dice', async () => {
    seedOne(STAT);
    renderRows();
    const panel = await openVariants('Stat');
    expect(
      within(varyGroup(panel)).getByRole('button', { name: 'Keep, now 3 of 3' }),
    ).toBeInTheDocument();
  });

  it('moves the single choice when another value is picked', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Modifier, now +0' }));
    const pressed = pressedChips(panel);
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAccessibleName('Modifier, now +0');
  });

  it('groups a multi-part row’s chips by part and names the part on each', async () => {
    seedOne(MIXED);
    renderRows();
    const panel = await openVariants('Mixed');
    const group = varyGroup(panel);
    expect(within(group).getByText('Part 1 · 2d6')).toBeInTheDocument();
    expect(within(group).getByText('Part 2 · 1d8')).toBeInTheDocument();
    expect(within(group).getByText('Whole roll')).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Count of part 2, now 1' })).toBeInTheDocument();
    // The first part's die is the default, and only it is chosen.
    expect(pressedChips(panel).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Die of part 1, now d6',
    ]);
  });
});

describe('SweepPanel die chips', () => {
  it('preselects the standard dice either side of the source die', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    const dice = diceGroup(panel);
    expect(within(dice).getByRole('button', { name: 'd4' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dice).getByRole('button', { name: 'd8' })).toHaveAttribute('aria-pressed', 'true');
    for (const d of ['d10', 'd12', 'd20', 'd100']) {
      expect(within(dice).getByRole('button', { name: d })).toHaveAttribute('aria-pressed', 'false');
    }
    expect(within(panel).getByText('Adds 2 rolls')).toBeInTheDocument();
  });

  it('shows the source die as chosen but blocked', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    const source = within(diceGroup(panel)).getByRole('button', { name: 'd6, this roll’s die' });
    expect(source).toHaveAttribute('aria-pressed', 'true');
    expect(source).toHaveAttribute('aria-disabled', 'true');
  });

  it('ignores a press on the source die', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    const source = within(diceGroup(panel)).getByRole('button', { name: 'd6, this roll’s die' });
    fireEvent.click(source);
    expect(source).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).getByText('Adds 2 rolls')).toBeInTheDocument();
  });

  it('only preselects the die above when the source is the smallest standard die', async () => {
    seedOne(AFTER);
    renderRows();
    const panel = await openVariants('Dagger');
    const dice = diceGroup(panel);
    expect(within(dice).getByRole('button', { name: 'd6' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dice).getByRole('button', { name: 'd8' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(panel).getByText('Adds 1 roll')).toBeInTheDocument();
  });

  it('adds a die to the family when its chip is pressed', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    const d20 = within(diceGroup(panel)).getByRole('button', { name: 'd20' });
    fireEvent.click(d20);
    expect(d20).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).getByText('Adds 3 rolls')).toBeInTheDocument();
  });

  it('says which variants lose explode faces their die cannot show', async () => {
    seedOne(BLAST);
    renderRows();
    const panel = await openVariants('Blast');
    expect(
      within(panel).getByText('d4: reroll or explode faces that die doesn’t have are cleared.'),
    ).toBeInTheDocument();
  });
});

describe('SweepPanel number ranges', () => {
  it('shows From, To and Go up by for the modifier, a five-value window around it', async () => {
    seedOne(MACE);
    renderRows();
    const panel = await openVariants('Mace');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Modifier, now +3' }));

    expect(within(panel).getByText('From')).toBeInTheDocument();
    expect(within(panel).getByText('To')).toBeInTheDocument();
    expect(within(panel).getByText('Go up by')).toBeInTheDocument();
    expect(within(panel).getByRole('textbox', { name: 'Modifier from' })).toHaveValue('1');
    expect(within(panel).getByRole('textbox', { name: 'Modifier to' })).toHaveValue('5');
    expect(within(panel).getByRole('textbox', { name: 'Modifier step' })).toHaveValue('1');
  });

  it('previews the count the window adds, leaving out the source value', async () => {
    seedOne(MACE);
    renderRows();
    const panel = await openVariants('Mace');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Modifier, now +3' }));
    expect(within(panel).getByText('Adds 4 rolls')).toBeInTheDocument();
    expect(confirmButton(panel)).toHaveTextContent('Add 4 rolls');
    for (const token of ['+1', '+2', '+4', '+5']) {
      expect(within(panel).getByText(token)).toBeInTheDocument();
    }
  });

  it('says in words that the source value is skipped', async () => {
    seedOne(MACE);
    renderRows();
    const panel = await openVariants('Mace');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Modifier, now +3' }));
    expect(within(panel).getByText('Skips +3: that is this roll.')).toBeInTheDocument();
  });

  it('hides the die chips once a number is chosen', async () => {
    seedOne(MACE);
    renderRows();
    const panel = await openVariants('Mace');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Modifier, now +3' }));
    expect(within(panel).queryByRole('group', { name: 'Dice to try' })).toBeNull();
  });

  it('updates the preview when the range changes', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Modifier, now +0' }));
    setStepper(panel, 'Modifier from', 0);
    setStepper(panel, 'Modifier to', 5);
    expect(within(panel).getByText('Adds 5 rolls')).toBeInTheDocument();
  });

  it('opens a pool row on a window of success numbers the die can show', async () => {
    seedOne(POOL);
    renderRows();
    const panel = await openVariants('Pool');
    expect(within(panel).getByRole('textbox', { name: 'Success from' })).toHaveValue('2');
    expect(within(panel).getByRole('textbox', { name: 'Success to' })).toHaveValue('6');
    expect(within(panel).getByText('Adds 4 rolls')).toBeInTheDocument();
    expect(within(panel).getByText('Skips ≥4: that is this roll.')).toBeInTheDocument();
  });

  it('opens a keep on every legal keep and skips the source keep in words', async () => {
    seedOne(STAT);
    renderRows();
    const panel = await openVariants('Stat');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Keep, now 3 of 3' }));
    expect(within(panel).getByRole('textbox', { name: 'Keep from' })).toHaveValue('1');
    expect(within(panel).getByRole('textbox', { name: 'Keep to' })).toHaveValue('3');
    expect(within(panel).getByText('Skips keep 3: that is this roll.')).toBeInTheDocument();
    expect(within(panel).getByText('Adds 2 rolls')).toBeInTheDocument();
  });

  it('says in words that a keep above the dice rolled is skipped, before confirm', async () => {
    seedOne(STAT);
    renderRows();
    const panel = await openVariants('Stat');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Keep, now 3 of 3' }));
    setStepper(panel, 'Keep to', 5);
    expect(
      within(panel).getByText('Skips keep 4, keep 5: you can’t keep more dice than you roll.'),
    ).toBeInTheDocument();
    expect(within(panel).getByText('Skips keep 3: that is this roll.')).toBeInTheDocument();
    expect(within(panel).getByText('Adds 2 rolls')).toBeInTheDocument();
  });

  it('gives a screen reader only the counts, not every token again', async () => {
    seedOne(STAT);
    renderRows();
    const panel = await openVariants('Stat');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Keep, now 3 of 3' }));
    setStepper(panel, 'Keep to', 5);
    // The source keep is not counted as a skip; keep 4 and keep 5 are.
    const status = within(panel).getByRole('status');
    expect(status).toHaveTextContent('Adds 2 rolls. Skips 2.');
  });

  it('moves focus to the confirm button when Enter is pressed in From', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Modifier, now +0' }));
    const from = within(panel).getByRole('textbox', { name: 'Modifier from' });
    from.focus();
    fireEvent.change(from, { target: { value: '1' } });
    fireEvent.keyDown(from, { key: 'Enter' });
    expect(confirmButton(panel)).toHaveFocus();
  });

  it('commits the typed From before focus moves on', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Modifier, now +0' }));
    const from = within(panel).getByRole('textbox', { name: 'Modifier from' });
    from.focus();
    fireEvent.change(from, { target: { value: '1' } });
    fireEvent.keyDown(from, { key: 'Enter' });
    // 1 to 2 leaves +1 and +2.
    expect(confirmButton(panel)).toHaveTextContent('Add 2 rolls');
  });
});

describe('SweepPanel confirm', () => {
  it('inserts the family directly below the source, named by the changed value', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Modifier, now +0' }));
    setStepper(panel, 'Modifier from', 0);
    setStepper(panel, 'Modifier to', 5);
    fireEvent.click(confirmButton(panel));
    expect(rowNames()).toEqual([
      '2d6',
      '2d6 · +1',
      '2d6 · +2',
      '2d6 · +3',
      '2d6 · +4',
      '2d6 · +5',
      'Dagger',
    ]);
  });

  it('closes the panel and keeps the source’s editor open', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    fireEvent.click(confirmButton(panel));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(variantsTrigger('2d6')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate 2d6' })).toBeInTheDocument();
  });

  it('creates only the legal keeps from a keep sweep of 1 to 5 on 3d6 kh3', async () => {
    seedOne(STAT);
    renderRows();
    const panel = await openVariants('Stat');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Keep, now 3 of 3' }));
    setStepper(panel, 'Keep to', 5);
    fireEvent.click(confirmButton(panel));
    expect(rowNames()).toEqual(['Stat', 'Stat · kh1', 'Stat · kh2', 'Dagger']);
  });

  it('is blocked when nothing would be added, and pressing it adds nothing', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    const dice = diceGroup(panel);
    fireEvent.click(within(dice).getByRole('button', { name: 'd4' }));
    fireEvent.click(within(dice).getByRole('button', { name: 'd8' }));
    expect(within(panel).getByText('Nothing to add yet')).toBeInTheDocument();
    const confirm = confirmButton(panel);
    expect(confirm).toHaveTextContent('Add rolls');
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(confirm);
    expect(rowNames()).toEqual(['2d6', 'Dagger']);
    expect(screen.getByRole('dialog', { name: 'Variants of 2d6' })).toBeInTheDocument();
  });

  it('is blocked when the only value in range is the source', async () => {
    seedOne(MACE);
    renderRows();
    const panel = await openVariants('Mace');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Modifier, now +3' }));
    setStepper(panel, 'Modifier from', 3);
    setStepper(panel, 'Modifier to', 3);
    expect(confirmButton(panel)).toHaveAttribute('aria-disabled', 'true');
  });

  it('says only the rows that fit will be added, then adds just those', async () => {
    const filler = Array.from({ length: MAX_EXPRESSIONS - 4 }, (_, i) => ({
      ...AFTER,
      id: `fill-${i}`,
      name: `Fill ${i}`,
      parts: [{ id: `fill-${i}-part`, count: 1, sides: 4 }],
    }));
    // 97 rows in all, so a five-value sweep has room for three.
    seed([TWO_D6, ...filler], TWO_D6.id);
    renderRows();
    const panel = await openVariants('2d6');
    fireEvent.click(within(varyGroup(panel)).getByRole('button', { name: 'Modifier, now +0' }));
    setStepper(panel, 'Modifier from', 0);
    setStepper(panel, 'Modifier to', 5);
    expect(within(panel).getByText('Adds 3 rolls')).toBeInTheDocument();
    expect(
      within(panel).getByText(`Only 3 fit. The table holds up to ${MAX_EXPRESSIONS} rolls.`),
    ).toBeInTheDocument();
    fireEvent.click(confirmButton(panel));
    expect(rowNames()).toHaveLength(MAX_EXPRESSIONS);
    expect(rowNames().slice(0, 4)).toEqual(['2d6', '2d6 · +1', '2d6 · +2', '2d6 · +3']);
  });

  it('Cancel closes the panel and adds nothing', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(rowNames()).toEqual(['2d6', 'Dagger']);
  });
});

describe('SweepPanel shells', () => {
  it('opens as a popover beside the trigger where the table fits', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    expect(panel).not.toHaveAttribute('aria-modal', 'true');
    expect(within(panel).queryByRole('heading')).toBeNull();
  });

  it('puts focus on the chosen value when the popover opens', async () => {
    seedOne(TWO_D6);
    renderRows();
    const panel = await openVariants('2d6');
    await waitFor(() => expect(pressedChips(panel)[0]).toHaveFocus());
  });

  it('opens as a titled bottom sheet on a phone', async () => {
    mockPhone();
    seedOne(TWO_D6);
    renderRows();
    const sheet = await openVariants('2d6');
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(within(sheet).getByRole('heading', { name: 'Variants of 2d6' })).toBeInTheDocument();
    expect(pressedChips(sheet)).toHaveLength(1);
  });

  it('adds the family and closes from the sheet too', async () => {
    mockPhone();
    seedOne(TWO_D6);
    renderRows();
    const sheet = await openVariants('2d6');
    fireEvent.click(confirmButton(sheet));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(rowNames()).toEqual(['2d6', '2d6 · d4', '2d6 · d8', 'Dagger']);
  });

  it('moves focus to confirm on Enter in the sheet too', async () => {
    mockPhone();
    seedOne(TWO_D6);
    renderRows();
    const sheet = await openVariants('2d6');
    fireEvent.click(within(varyGroup(sheet)).getByRole('button', { name: 'Modifier, now +0' }));
    const from = within(sheet).getByRole('textbox', { name: 'Modifier from' });
    from.focus();
    fireEvent.change(from, { target: { value: '1' } });
    fireEvent.keyDown(from, { key: 'Enter' });
    expect(confirmButton(sheet)).toHaveFocus();
  });
});
