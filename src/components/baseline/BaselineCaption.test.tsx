import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { BaselineCaption } from './BaselineCaption';

function seedRows(baselineId: string | null) {
  const state = {
    version: 3,
    expressions: [
      {
        id: 'sum1',
        name: 'Sum row',
        parts: [{ id: 'sp1', count: 2, sides: 6 }],
        flatModifier: 0,
        rollMode: 'normal',
        mode: 'sum',
      },
      {
        id: 'sum2',
        name: 'Bonus row',
        parts: [{ id: 'sp2', count: 1, sides: 6 }],
        flatModifier: 5,
        rollMode: 'normal',
        mode: 'sum',
      },
    ],
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [], ruling: 'gte' },
      view: 'table',
      poolTarget: 1,
      baselineId,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

function renderCaption() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <BaselineCaption />
      </AppProvider>
    </ChakraProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('BaselineCaption', () => {
  it('renders nothing while there are fewer than two rolls', () => {
    // The default seed table has a single roll.
    renderCaption();
    expect(screen.queryByText(/Pin a roll/)).toBeNull();
  });

  it('invites pinning when no baseline is set', () => {
    seedRows(null);
    renderCaption();
    expect(
      screen.getByText('Pin a roll to compare the others against it.'),
    ).toBeInTheDocument();
  });

  it('explains the comparison and how to clear it when a baseline is pinned', () => {
    seedRows('sum1');
    renderCaption();
    expect(
      screen.getByText(
        'Comparing to Sum row. Green means better, red worse, grey shows spread change. Tap the pin again to clear.',
      ),
    ).toBeInTheDocument();
  });
});
