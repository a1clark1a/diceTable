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
    // A fresh mount starts with zero rolls, which is below the two-roll gate.
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

  it('names the pinned baseline and how to clear it', () => {
    seedRows('sum1');
    renderCaption();
    // The name is its own element now, so the sentence is split across nodes.
    expect(screen.getByText('Sum row')).toBeInTheDocument();
    expect(
      screen.getByText(/Tap the pin again to clear\./),
    ).toBeInTheDocument();
  });

  it('leaves the colour coding to a tooltip rather than the caption', () => {
    seedRows('sum1');
    renderCaption();
    expect(screen.queryByText(/Green means better/)).toBeNull();
  });
});
