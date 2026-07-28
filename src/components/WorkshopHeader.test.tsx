import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../state/AppContext';
import { useApp } from '../state/useApp';
import { WorkshopHeader } from './WorkshopHeader';
import type { WorkshopViewChip } from './WorkshopViewSwitcher';
import type { RollMode } from '../types';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

const VIEWS: WorkshopViewChip[] = [
  { id: 'table', label: 'Table & chart', mobileLabel: 'Rolls' },
];

function seedRows(modes: RollMode[]) {
  const state = {
    version: 2,
    expressions: modes.map((mode, i) => ({
      id: `e${i}`,
      name: `Row ${i}`,
      parts: [{ id: `p${i}`, count: 1, sides: 6 }],
      flatModifier: 0,
      rollMode: mode,
    })),
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [] as number[], ruling: 'gte' as const },
      view: 'table' as const,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

function RowCount() {
  const { expressions } = useApp();
  return <div data-testid="row-count">{expressions.length}</div>;
}

function renderHeader(
  props: Partial<React.ComponentProps<typeof WorkshopHeader>> = {},
) {
  const onSelectView = props.onSelectView ?? vi.fn();
  render(
    <Providers>
      <WorkshopHeader
        views={props.views ?? VIEWS}
        activeView={props.activeView ?? 'table'}
        onSelectView={onSelectView}
      />
      <RowCount />
    </Providers>,
  );
  return { onSelectView };
}

// jsdom has no matchMedia, so useIsDesktop defaults to the desktop branch.
// Emulate a viewport to exercise the responsive Add-button label.
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

describe('WorkshopHeader', () => {
  it('renders the view switcher, roll-mode chips, and an Add button', () => {
    seedRows(['normal']);
    renderHeader();
    expect(
      screen.getByRole('button', { name: 'Table & chart' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Normal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adv' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dis' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add roll/i }),
    ).toBeInTheDocument();
  });

  it('marks the shared roll mode as the active chip', () => {
    seedRows(['advantage', 'advantage']);
    renderHeader();
    expect(screen.getByRole('button', { name: 'Adv' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Dis' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByText(/mixed/i)).toBeNull();
  });

  it('shows no active chip and a mixed label when rows differ', () => {
    seedRows(['normal', 'advantage']);
    renderHeader();
    for (const name of ['Normal', 'Adv', 'Dis']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
    expect(screen.getByText(/mixed/i)).toBeInTheDocument();
  });

  it('rewrites every row and updates the active chip when a mode is clicked', () => {
    seedRows(['normal', 'advantage']);
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Dis' }));
    expect(screen.getByRole('button', { name: 'Dis' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText(/mixed/i)).toBeNull();
  });

  it('keeps a plain "Roll mode" label with no active chip on an empty table', () => {
    seedRows([]);
    renderHeader();
    expect(screen.getByText('Roll mode')).toBeInTheDocument();
    expect(screen.queryByText(/mixed/i)).toBeNull();
    for (const name of ['Normal', 'Adv', 'Dis']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  });

  it('appends a row when Add is clicked', () => {
    seedRows(['normal', 'normal']);
    renderHeader();
    expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('button', { name: /add roll/i }));
    expect(screen.getByTestId('row-count')).toHaveTextContent('3');
  });

  it('forwards view selection to onSelectView', () => {
    seedRows(['normal']);
    const views: WorkshopViewChip[] = [
      { id: 'table', label: 'Table & chart', mobileLabel: 'Rolls' },
      { id: 'target', label: 'Target hit' },
    ];
    const { onSelectView } = renderHeader({ views, activeView: 'table' });
    fireEvent.click(screen.getByRole('button', { name: 'Target hit' }));
    expect(onSelectView).toHaveBeenCalledWith('target');
  });

  it('labels the Add button "Add" below the desktop breakpoint', () => {
    mockViewport(false);
    seedRows(['normal']);
    renderHeader();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add roll/i })).toBeNull();
  });
});
