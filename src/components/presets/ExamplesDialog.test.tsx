import { afterEach, describe, expect, it } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { useApp } from '../../state/useApp';
import { STARTER_PRESETS } from '../../presets/starterRolls';
import { RECIPES } from '../../presets/recipes';
import { expressionDistribution } from '../../engine/expression';
import { computeRowStats } from '../../state/rowStats';
import { formatNumber } from '../chart/format';
import type { Expression } from '../../types';
import { ExamplesDialog } from './ExamplesDialog';

// Serializing state into the DOM keeps the probe pure (no writes to test
// scope during render, which react-hooks/globals forbids).
function RowsProbe() {
  const { expressions } = useApp();
  return <div data-testid="rows">{JSON.stringify(expressions)}</div>;
}

function readRows(): Expression[] {
  return JSON.parse(
    screen.getByTestId('rows').textContent ?? '[]',
  ) as Expression[];
}

function readNames(): string[] {
  return readRows().map((e) => e.name);
}

function renderDialog() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <ExamplesDialog />
        <RowsProbe />
      </AppProvider>
    </ChakraProvider>,
  );
}

// The dialog machine opens a beat after the trigger click, so mount waits on
// the dialog role appearing rather than querying synchronously.
async function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Find a roll' }));
  return await screen.findByRole('dialog');
}

function search(query: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search rolls' }), {
    target: { value: query },
  });
}

function cardButtons(): HTMLElement[] {
  return screen.queryAllByRole('button', {
    name: /^Use (this roll|these \d+ rolls)$/,
  });
}

function familyChip(label: string): HTMLElement {
  return within(
    screen.getByRole('group', { name: 'Filter by kind of roll' }),
  ).getByRole('button', { name: label });
}

// What a card promises for one row, built from the row the table actually
// holds after Add, in the card's own one-decimal format.
function expectedStatLine(row: Expression): { avg: string; range: string } {
  const stats = computeRowStats(expressionDistribution(row));
  const unit = row.mode === 'pool' ? ' succ.' : '';
  return {
    avg: `avg ${formatNumber(stats.mean, 1)}${unit}`,
    range: `range ${stats.min}–${stats.max}`,
  };
}

function displayedStatLines(dialog: HTMLElement): { avg: string; range: string }[] {
  const avgs = within(dialog).getAllByText(/^avg /);
  const ranges = within(dialog).getAllByText(/^range /);
  expect(ranges).toHaveLength(avgs.length);
  return avgs.map((avg, i) => ({
    avg: avg.textContent ?? '',
    range: ranges[i]?.textContent ?? '',
  }));
}

afterEach(() => {
  window.localStorage.clear();
});

describe('ExamplesDialog', () => {
  it('opens from the Find a roll button and lists every recipe card', async () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).toBeNull();

    await openDialog();

    expect(screen.getByRole('heading', { name: 'Find a roll' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /^Use (this roll|these \d+ rolls)$/ }),
    ).toHaveLength(RECIPES.length);
  });

  it('"Use this roll" appends to the table and keeps the dialog open', async () => {
    renderDialog();
    await openDialog();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Use this roll' })[0]!,
    );

    expect(readNames()).toEqual(['Weapon attack']);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('"Load the starter set" appends all presets and closes the dialog', async () => {
    renderDialog();
    await openDialog();

    fireEvent.click(
      screen.getByRole('button', { name: 'Load the starter set' }),
    );

    expect(readNames()).toHaveLength(STARTER_PRESETS.length);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('ExamplesDialog search', () => {
  it('narrows the cards to the recipes that match a game name', async () => {
    renderDialog();
    await openDialog();

    search('Blades');

    expect(screen.getByText('Best die decides, two 6s crit')).toBeInTheDocument();
    expect(
      screen.getByText('Stress to resist: 6 minus your best die'),
    ).toBeInTheDocument();
    expect(cardButtons()).toHaveLength(2);
  });

  it('announces the number of matches in a polite live region', async () => {
    renderDialog();
    await openDialog();

    search('Blades');

    expect(screen.getByText('2 results')).toHaveAttribute('aria-live', 'polite');
  });

  it('reads "1 result" in the singular when exactly one recipe matches', async () => {
    renderDialog();
    await openDialog();

    search('Ironsworn');

    expect(screen.getByText('1 result')).toHaveAttribute('aria-live', 'polite');
    expect(cardButtons()).toHaveLength(1);
  });

  it('shows the empty state and 0 results when nothing matches', async () => {
    renderDialog();
    await openDialog();

    search('qwertyuiop');

    expect(screen.getByText('Nothing matches “qwertyuiop”.')).toBeInTheDocument();
    expect(
      screen.getByText('Try a game name, or a word like advantage or explode.'),
    ).toBeInTheDocument();
    expect(screen.getByText('0 results')).toHaveAttribute('aria-live', 'polite');
    expect(cardButtons()).toHaveLength(0);
  });

  it('starts with an empty search and every card each time the dialog reopens', async () => {
    renderDialog();
    const dialog = await openDialog();
    search('Blades');
    expect(cardButtons()).toHaveLength(2);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await openDialog();

    expect(screen.getByRole('searchbox', { name: 'Search rolls' })).toHaveValue('');
    expect(cardButtons()).toHaveLength(RECIPES.length);
  });
});

describe('ExamplesDialog family chips', () => {
  it('starts with All pressed and every other chip unpressed', async () => {
    renderDialog();
    await openDialog();

    expect(familyChip('All')).toHaveAttribute('aria-pressed', 'true');
    for (const label of [
      'Add it up',
      'Count successes',
      'Best or worst of',
      'Head to head',
      'Beat a number',
    ]) {
      expect(familyChip(label)).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('pressing a chip filters the cards to that kind of roll and marks it pressed', async () => {
    renderDialog();
    await openDialog();

    fireEvent.click(familyChip('Head to head'));

    expect(familyChip('Head to head')).toHaveAttribute('aria-pressed', 'true');
    expect(familyChip('All')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Two d20s against each other')).toBeInTheDocument();
    expect(
      screen.getByText('Beat two d10s with a d6 plus a stat'),
    ).toBeInTheDocument();
    expect(cardButtons()).toHaveLength(2);
    expect(screen.getByText('2 results')).toBeInTheDocument();
  });

  it('pressing All clears the chip and brings every card back', async () => {
    renderDialog();
    await openDialog();
    fireEvent.click(familyChip('Head to head'));

    fireEvent.click(familyChip('All'));

    expect(familyChip('All')).toHaveAttribute('aria-pressed', 'true');
    expect(familyChip('Head to head')).toHaveAttribute('aria-pressed', 'false');
    expect(cardButtons()).toHaveLength(RECIPES.length);
  });

  it('a chip and a search narrow together, so both have to match', async () => {
    renderDialog();
    await openDialog();

    // "Blades" alone finds two recipes, one counting successes and one adding
    // up stress; the chip keeps only the first.
    search('Blades');
    fireEvent.click(familyChip('Count successes'));

    expect(screen.getByText('Best die decides, two 6s crit')).toBeInTheDocument();
    expect(cardButtons()).toHaveLength(1);
  });
});

describe('ExamplesDialog multi-row recipes', () => {
  it('labels a three-row card "Use these 3 rolls" and adds all three in order', async () => {
    renderDialog();
    await openDialog();
    search('Ironsworn');

    fireEvent.click(screen.getByRole('button', { name: 'Use these 3 rolls' }));

    expect(readNames()).toEqual([
      'Action score +2',
      'Higher challenge die',
      'Lower challenge die',
    ]);
  });

  it('appends a multi-row recipe below the rows already in the table', async () => {
    renderDialog();
    await openDialog();
    search('Ironsworn');
    fireEvent.click(screen.getByRole('button', { name: 'Use these 3 rolls' }));

    search('advantage against disadvantage');
    fireEvent.click(screen.getByRole('button', { name: 'Use these 3 rolls' }));

    expect(readNames()).toEqual([
      'Action score +2',
      'Higher challenge die',
      'Lower challenge die',
      'Normal',
      'Advantage',
      'Disadvantage',
    ]);
  });
});

describe('ExamplesDialog headline numbers', () => {
  // Each query isolates one card, chosen to cover a negative modifier, a pool
  // row, keep-highest across two rows, check rows with crits, and exploding
  // dice kept across parts.
  it.each([
    { query: 'Fate', rows: 1 },
    { query: 'Shadowrun', rows: 1 },
    { query: 'Lancer', rows: 2 },
    { query: 'Champion', rows: 2 },
    { query: 'Savage Worlds', rows: 1 },
    { query: 'L5R', rows: 1 },
  ])(
    'the "$query" card shows the avg and range its added rows compute',
    async ({ query, rows }) => {
      renderDialog();
      const dialog = await openDialog();
      search(query);
      expect(screen.getByText('1 result')).toBeInTheDocument();
      const shown = displayedStatLines(dialog);

      const [use] = cardButtons();
      fireEvent.click(use!);

      const added = readRows();
      expect(added).toHaveLength(rows);
      expect(shown).toEqual(added.map(expectedStatLine));
    },
  );
});
