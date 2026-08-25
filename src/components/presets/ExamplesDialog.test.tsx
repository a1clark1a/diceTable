import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { useApp } from '../../state/useApp';
import { STARTER_PRESETS } from '../../presets/starterRolls';
import { ExamplesDialog } from './ExamplesDialog';

// Serializing state into the DOM keeps the probe pure (no writes to test
// scope during render, which react-hooks/globals forbids).
function NamesProbe() {
  const { expressions } = useApp();
  return (
    <div data-testid="names">
      {JSON.stringify(expressions.map((e) => e.name))}
    </div>
  );
}

function readNames(): string[] {
  return JSON.parse(
    screen.getByTestId('names').textContent ?? '[]',
  ) as string[];
}

function renderDialog() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <ExamplesDialog />
        <NamesProbe />
      </AppProvider>
    </ChakraProvider>,
  );
}

// The dialog machine opens a beat after the trigger click, so mount waits on
// the dialog role appearing rather than querying synchronously.
async function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Examples' }));
  return await screen.findByRole('dialog');
}

afterEach(() => {
  window.localStorage.clear();
});

describe('ExamplesDialog', () => {
  it('opens from the Examples button and lists every preset card', async () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).toBeNull();

    await openDialog();

    expect(screen.getByText('Example rolls')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Use this roll' }),
    ).toHaveLength(STARTER_PRESETS.length);
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

  it('"Load every example" appends all presets and closes the dialog', async () => {
    renderDialog();
    await openDialog();

    fireEvent.click(
      screen.getByRole('button', { name: 'Load every example' }),
    );

    expect(readNames()).toHaveLength(STARTER_PRESETS.length);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
