import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../state/AppContext';
import { useApp } from '../state/useApp';
import { RowActions } from './RowActions';
import { ExamplesDialog } from './presets/ExamplesDialog';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

function RowCount() {
  const { expressions } = useApp();
  return <div data-testid="row-count">{expressions.length}</div>;
}

// The page owns the library dialog and the button only asks for it, so the
// harness stands in for the page.
function RowActionsWithLibrary() {
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  return (
    <>
      <RowActions onFindRoll={() => setLibraryOpen(true)} />
      <ExamplesDialog open={libraryOpen} onOpenChange={setLibraryOpen} />
    </>
  );
}

function renderActions() {
  render(
    <Providers>
      <RowActionsWithLibrary />
      <RowCount />
    </Providers>,
  );
}

function seedRows(count: number) {
  const state = {
    version: 2,
    expressions: Array.from({ length: count }, (_, i) => ({
      id: `e${i}`,
      name: `Row ${i}`,
      parts: [{ id: `p${i}`, count: 1, sides: 6 }],
      flatModifier: 0,
      rollMode: 'normal' as const,
      mode: 'sum' as const,
    })),
    ui: {
      expandedId: null,
      chartView: 'pmf' as const,
      target: { values: [], ruling: 'gte' as const },
      poolTarget: 1,
      view: 'table' as const,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

// jsdom has no matchMedia, so useIsDesktop defaults to the desktop branch.
// Emulate a viewport to exercise the phone layout.
function mockViewport(isDesktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isDesktop,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.localStorage.clear();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('RowActions on desktop', () => {
  it('offers Add roll, Find a roll and Clear all rolls side by side', () => {
    mockViewport(true);
    seedRows(2);
    renderActions();
    expect(
      screen.getByRole('button', { name: /add roll/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Find a roll' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear all rolls' }),
    ).toBeInTheDocument();
  });
});

describe('RowActions on a phone', () => {
  it('opens the roll library from a labelled Find a roll button', async () => {
    mockViewport(false);
    seedRows(2);
    renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'Find a roll' }));

    // The dialog machine opens a beat after the click.
    await screen.findByRole('dialog');
    expect(
      screen.getByRole('heading', { name: 'Find a roll' }),
    ).toBeInTheDocument();
  });

  it('leaves Add roll and Clear all rolls to the overflow menu', () => {
    mockViewport(false);
    seedRows(2);
    renderActions();
    expect(screen.queryByRole('button', { name: /add roll/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear all rolls' })).toBeNull();
  });

  it('renders no buttons at all on an empty table', () => {
    mockViewport(false);
    seedRows(0);
    renderActions();
    expect(screen.getByTestId('row-count')).toHaveTextContent('0');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('RowActions add', () => {
  it('appends a row when Add roll is clicked', () => {
    seedRows(2);
    renderActions();
    expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: /add roll/i }));
    expect(screen.getByTestId('row-count')).toHaveTextContent('3');
  });

  it('disables Add roll at the 100-roll cap', () => {
    seedRows(100);
    renderActions();
    expect(screen.getByTestId('row-count')).toHaveTextContent('100');
    expect(screen.getByRole('button', { name: /add roll/i })).toBeDisabled();
  });

  it('keeps Add roll on an empty table and drops the rest', () => {
    seedRows(0);
    renderActions();
    expect(
      screen.getByRole('button', { name: /add roll/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /find a roll/i })).toBeNull();
  });
});

describe('RowActions clear', () => {
  // The dialog machine opens a beat after the trigger click, so every test
  // waits on the alertdialog role appearing rather than querying synchronously.
  async function openClearDialog() {
    fireEvent.click(screen.getByRole('button', { name: 'Clear all rolls' }));
    return await screen.findByRole('alertdialog');
  }

  it('opens a confirmation dialog naming the roll count', async () => {
    seedRows(2);
    renderActions();
    await openClearDialog();
    expect(screen.getByText('Clear the table?')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear 2 rolls' }),
    ).toBeInTheDocument();
  });

  it('Cancel closes the dialog and keeps every roll', async () => {
    seedRows(2);
    renderActions();
    await openClearDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('confirming empties the table and hides the clear button', async () => {
    seedRows(3);
    renderActions();
    await openClearDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Clear 3 rolls' }));
    expect(screen.getByTestId('row-count')).toHaveTextContent('0');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });
});
