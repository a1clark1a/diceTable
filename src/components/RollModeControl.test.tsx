import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../state/AppContext';
import { useApp } from '../state/useApp';
import { RollModeControl } from './RollModeControl';
import type { ExpressionMode, RollMode } from '../types';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

function ModeReadout() {
  const { expressions } = useApp();
  return (
    <div data-testid="modes">{expressions.map((e) => e.rollMode).join(',')}</div>
  );
}

function renderControl() {
  render(
    <Providers>
      <RollModeControl />
      <ModeReadout />
    </Providers>,
  );
}

interface SeedRow {
  rollMode: RollMode;
  mode: ExpressionMode;
}

function seedTable(rows: SeedRow[]) {
  const state = {
    version: 2,
    expressions: rows.map((row, i) => ({
      id: `e${i}`,
      name: `Row ${i}`,
      parts: [{ id: `p${i}`, count: 1, sides: 6 }],
      flatModifier: 0,
      rollMode: row.rollMode,
      mode: row.mode,
      ...(row.mode === 'pool'
        ? { successThreshold: { direction: 'gte', value: 4 } }
        : {}),
    })),
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [] as number[], ruling: 'gte' as const },
      poolTarget: 1,
      view: 'table' as const,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

function seedRows(modes: RollMode[]) {
  seedTable(modes.map((rollMode): SeedRow => ({ rollMode, mode: 'sum' })));
}

afterEach(() => {
  window.localStorage.clear();
});

describe('RollModeControl', () => {

  it('marks the shared roll mode as the active chip', () => {

    seedRows(['advantage', 'advantage']);

    renderControl();

    expect(screen.getByRole('button', { name: 'Advantage' })).toHaveAttribute(

      'aria-pressed',

      'true',

    );

    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute(

      'aria-pressed',

      'false',

    );

    expect(screen.queryByText(/mixed/i)).toBeNull();

  });



  it('shows no active chip and a mixed label when rows differ', () => {

    seedRows(['normal', 'advantage']);

    renderControl();

    for (const name of ['Normal', 'Advantage', 'Disadvantage']) {

      expect(screen.getByRole('button', { name })).toHaveAttribute(

        'aria-pressed',

        'false',

      );

    }

    expect(screen.getByText(/mixed/i)).toBeInTheDocument();

  });



  it('ignores a pool row when deriving the shared mode from sum rows', () => {

    seedTable([

      { rollMode: 'normal', mode: 'sum' },

      { rollMode: 'advantage', mode: 'pool' },

    ]);

    renderControl();

    expect(screen.getByTestId('modes')).toHaveTextContent('normal,advantage');

    expect(screen.queryByText(/mixed/i)).toBeNull();

    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute(

      'aria-pressed',

      'true',

    );

  });



  it('falls back to the stored modes when every row is a pool row', () => {

    seedTable([

      { rollMode: 'advantage', mode: 'pool' },

      { rollMode: 'advantage', mode: 'pool' },

    ]);

    renderControl();

    expect(screen.queryByText(/mixed/i)).toBeNull();

    expect(screen.getByRole('button', { name: 'Advantage' })).toHaveAttribute(

      'aria-pressed',

      'true',

    );

  });



  it("marks the first row's stored mode when an all-pool table disagrees", () => {

    seedTable([

      { rollMode: 'normal', mode: 'pool' },

      { rollMode: 'advantage', mode: 'pool' },

    ]);

    renderControl();

    expect(screen.queryByText(/mixed/i)).toBeNull();

    expect(screen.getByRole('button', { name: 'Normal' })).toHaveAttribute(

      'aria-pressed',

      'true',

    );

  });



  it('still shows mixed when sum rows differ alongside a pool row', () => {

    seedTable([

      { rollMode: 'normal', mode: 'sum' },

      { rollMode: 'advantage', mode: 'sum' },

      { rollMode: 'normal', mode: 'pool' },

    ]);

    renderControl();

    expect(screen.getByText(/mixed/i)).toBeInTheDocument();

  });



  it('rewrites every row and updates the active chip when a mode is clicked', () => {

    seedRows(['normal', 'advantage']);

    renderControl();

    fireEvent.click(screen.getByRole('button', { name: 'Disadvantage' }));

    expect(screen.getByRole('button', { name: 'Disadvantage' })).toHaveAttribute(

      'aria-pressed',

      'true',

    );

    expect(screen.queryByText(/mixed/i)).toBeNull();

  });





});



