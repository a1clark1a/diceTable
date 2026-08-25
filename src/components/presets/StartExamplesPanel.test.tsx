import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { useApp } from '../../state/useApp';
import type { SuccessThreshold } from '../../types';
import { STARTER_PRESETS } from '../../presets/starterRolls';
import { StartExamplesPanel } from './StartExamplesPanel';

interface ProbedExpression {
  id: string;
  name: string;
  mode: string;
  partIds: string[];
  successThreshold: SuccessThreshold | null;
}

// Serializing state into the DOM keeps the probe pure (no writes to test
// scope during render, which react-hooks/globals forbids).
function StateProbe() {
  const { expressions } = useApp();
  const probed: ProbedExpression[] = expressions.map((e) => ({
    id: e.id,
    name: e.name,
    mode: e.mode,
    partIds: e.parts.map((p) => p.id),
    successThreshold: e.successThreshold ?? null,
  }));
  return <div data-testid="state">{JSON.stringify(probed)}</div>;
}

function readState(): ProbedExpression[] {
  return JSON.parse(
    screen.getByTestId('state').textContent ?? '[]',
  ) as ProbedExpression[];
}

function renderPanel() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <StartExamplesPanel />
        <StateProbe />
      </AppProvider>
    </ChakraProvider>,
  );
}

function useThisRollButtons() {
  return screen.getAllByRole('button', { name: 'Use this roll' });
}

afterEach(() => {
  window.localStorage.clear();
});

describe('StartExamplesPanel', () => {
  it('renders one card per preset with engine-computed stats', () => {
    renderPanel();
    expect(useThisRollButtons()).toHaveLength(STARTER_PRESETS.length);
    expect(screen.getByText('Weapon attack')).toBeInTheDocument();
    expect(screen.getByText('avg 6.5')).toBeInTheDocument();
    expect(screen.getByText('range 3–10')).toBeInTheDocument();
    // The pool card reports successes, not totals.
    expect(screen.getByText('avg 2.1 succ.')).toBeInTheDocument();
    expect(screen.getByText('range 0–7')).toBeInTheDocument();
  });

  it('"Use this roll" appends the pool preset already in pool mode with fresh ids', () => {
    renderPanel();
    const poolIdx = STARTER_PRESETS.findIndex((p) => p.expr.mode === 'pool');
    fireEvent.click(useThisRollButtons()[poolIdx]!);

    const state = readState();
    expect(state).toHaveLength(1);
    const added = state[0]!;
    expect(added.name).toBe('Success pool');
    expect(added.mode).toBe('pool');
    expect(added.successThreshold).toEqual({ direction: 'gte', value: 8 });
    expect(added.id).not.toBe('preset-pool');
    expect(added.partIds[0]).not.toBe('preset-pool-p1');
  });

  it('appending the same preset twice renames the copy instead of colliding', () => {
    renderPanel();
    fireEvent.click(useThisRollButtons()[0]!);
    fireEvent.click(useThisRollButtons()[0]!);

    const state = readState();
    expect(state.map((e) => e.name)).toEqual([
      'Weapon attack',
      'Weapon attack (2)',
    ]);
    expect(state[0]!.id).not.toBe(state[1]!.id);
  });

  it('"Load every example" appends all presets in table order', () => {
    renderPanel();
    fireEvent.click(
      screen.getByRole('button', { name: 'Load every example' }),
    );
    expect(readState().map((e) => e.name)).toEqual(
      STARTER_PRESETS.map((p) => p.expr.name),
    );
  });

  it('"Start from a blank roll" adds the default new roll', () => {
    renderPanel();
    fireEvent.click(
      screen.getByRole('button', { name: /start from a blank roll/i }),
    );
    const state = readState();
    expect(state).toHaveLength(1);
    expect(state[0]!.name).toBe('New roll');
    expect(state[0]!.mode).toBe('sum');
  });
});
