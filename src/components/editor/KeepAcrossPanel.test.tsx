import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { KeepAcrossPanel } from './KeepAcrossPanel';
import type { ExpressionPatch } from '../../state/useApp';
import type { Expression } from '../../types';

const Provider = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

function makeExpression(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e1',
    name: 'Trait roll',
    parts: [
      { id: 'p1', count: 1, sides: 8 },
      { id: 'p2', count: 1, sides: 6 },
    ],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function renderPanel(overrides: Partial<Expression> = {}) {
  const updateExpression = vi.fn<(id: string, patch: ExpressionPatch) => void>();
  render(
    <Provider>
      <KeepAcrossPanel
        expression={makeExpression(overrides)}
        updateExpression={updateExpression}
      />
    </Provider>,
  );
  return { updateExpression };
}

// Exact match: the stepper's labels also contain "keep across parts".
const chip = () => screen.getByRole('button', { name: 'Keep across parts' });

describe('KeepAcrossPanel when the rule is off', () => {
  it('shows the chip unpressed', () => {
    renderPanel();
    expect(chip()).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides the direction and count controls', () => {
    renderPanel();
    expect(
      screen.queryByLabelText('Keep highest or lowest across parts'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Dice to keep across parts'),
    ).not.toBeInTheDocument();
  });

  it('turns the rule on keeping one fewer die than the roll has', () => {
    const { updateExpression } = renderPanel();
    fireEvent.click(chip());
    expect(updateExpression).toHaveBeenCalledWith('e1', {
      keepAcross: { type: 'highest', n: 1 },
    });
  });

  it('counts every die in the roll, not every part', () => {
    const { updateExpression } = renderPanel({
      parts: [
        { id: 'p1', count: 3, sides: 6 },
        { id: 'p2', count: 1, sides: 8 },
      ],
    });
    fireEvent.click(chip());
    expect(updateExpression).toHaveBeenCalledWith('e1', {
      keepAcross: { type: 'highest', n: 3 },
    });
  });

  it('never seeds a count below one', () => {
    const { updateExpression } = renderPanel({
      parts: [{ id: 'p1', count: 1, sides: 20 }],
    });
    fireEvent.click(chip());
    expect(updateExpression).toHaveBeenCalledWith('e1', {
      keepAcross: { type: 'highest', n: 1 },
    });
  });
});

describe('KeepAcrossPanel when the rule is on', () => {
  const active = { keepAcross: { type: 'highest', n: 1 } } as const;

  it('shows the chip pressed', () => {
    renderPanel(active);
    expect(chip()).toHaveAttribute('aria-pressed', 'true');
  });

  // The reducer only clears the rule when the key is present in the patch, so
  // an equality matcher (which treats a missing key and an undefined one the
  // same) cannot tell "turn it off" apart from "leave it alone".
  it('turns the rule off again with the key present in the patch', () => {
    const { updateExpression } = renderPanel(active);
    fireEvent.click(chip());
    expect(updateExpression).toHaveBeenCalledTimes(1);
    const [id, patch] = updateExpression.mock.calls[0] ?? [];
    expect(id).toBe('e1');
    expect(Object.keys(patch ?? {})).toEqual(['keepAcross']);
    expect(patch?.keepAcross).toBeUndefined();
  });

  it('switches direction without losing the count', () => {
    const { updateExpression } = renderPanel({
      keepAcross: { type: 'highest', n: 2 },
    });
    fireEvent.change(screen.getByLabelText('Keep highest or lowest across parts'), {
      target: { value: 'lowest' },
    });
    expect(updateExpression).toHaveBeenCalledWith('e1', {
      keepAcross: { type: 'lowest', n: 2 },
    });
  });

  it('raises the count from the stepper', () => {
    const { updateExpression } = renderPanel(active);
    fireEvent.click(
      screen.getByRole('button', { name: 'Increase Dice to keep across parts' }),
    );
    expect(updateExpression).toHaveBeenCalledWith('e1', {
      keepAcross: { type: 'highest', n: 2 },
    });
  });

  it('will not let the count exceed the dice available', () => {
    renderPanel({ keepAcross: { type: 'highest', n: 2 } });
    expect(
      screen.getByRole('button', { name: 'Increase Dice to keep across parts' }),
    ).toBeDisabled();
  });

  it('will not let the count fall below one', () => {
    renderPanel(active);
    expect(
      screen.getByRole('button', { name: 'Decrease Dice to keep across parts' }),
    ).toBeDisabled();
  });

  // Typed input has to respect the same bounds as the buttons: a committed 0
  // would be rejected by the schema validator, and one rejected row drops the
  // whole saved table on the next load.
  it('clamps a typed 0 in the count up to 1', () => {
    const { updateExpression } = renderPanel({
      keepAcross: { type: 'highest', n: 2 },
    });
    const input = screen.getByLabelText('Dice to keep across parts');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateExpression).toHaveBeenCalledWith('e1', {
      keepAcross: { type: 'highest', n: 1 },
    });
  });

  it('clamps a cleared count up to 1', () => {
    const { updateExpression } = renderPanel({
      keepAcross: { type: 'highest', n: 2 },
    });
    const input = screen.getByLabelText('Dice to keep across parts');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateExpression).toHaveBeenCalledWith('e1', {
      keepAcross: { type: 'highest', n: 1 },
    });
  });

  it('clamps a typed count down to the dice available', () => {
    const { updateExpression } = renderPanel(active);
    const input = screen.getByLabelText('Dice to keep across parts');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateExpression).toHaveBeenCalledWith('e1', {
      keepAcross: { type: 'highest', n: 2 },
    });
  });

  it('says how many dice the roll has', () => {
    renderPanel(active);
    expect(screen.getByText('of 2 dice')).toBeInTheDocument();
  });

  it('says "1 die" rather than "1 dice"', () => {
    renderPanel({
      parts: [{ id: 'p1', count: 1, sides: 20 }],
      keepAcross: { type: 'highest', n: 1 },
    });
    expect(screen.getByText('of 1 die')).toBeInTheDocument();
  });

  it('lists the dice it is choosing between', () => {
    renderPanel(active);
    expect(screen.getByText('d8')).toBeInTheDocument();
    expect(screen.getByText('d6')).toBeInTheDocument();
  });

  it('shows a part holding several dice as a count', () => {
    renderPanel({
      parts: [{ id: 'p1', count: 3, sides: 6 }],
      keepAcross: { type: 'highest', n: 2 },
    });
    expect(screen.getByText('3d6')).toBeInTheDocument();
  });
});

describe('KeepAcrossPanel on a roll that counts successes', () => {
  const pool: Partial<Expression> = {
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 5 },
  };

  it('marks the chip disabled', () => {
    renderPanel(pool);
    expect(chip()).toHaveAttribute('aria-disabled', 'true');
  });

  it('ignores a click rather than storing a rule the math ignores', () => {
    const { updateExpression } = renderPanel(pool);
    fireEvent.click(chip());
    expect(updateExpression).not.toHaveBeenCalled();
  });

  it('keeps the chip focusable so its reason stays reachable', () => {
    renderPanel(pool);
    expect(chip()).not.toHaveAttribute('disabled');
  });
});

// Shrinking a part after the rule is on leaves the count above the dice total
// (4d6 + 1d8, keep across, then set the d6 count to 1); nothing clamps it on
// the way in, and the validator only asks for n >= 1, so the state persists.
describe('KeepAcrossPanel with a count left above the dice total', () => {
  const stale = { keepAcross: { type: 'highest', n: 4 } } as const;

  it('shows the stale count against the dice actually in play', () => {
    renderPanel(stale);
    expect(screen.getByLabelText('Dice to keep across parts')).toHaveValue('4');
    expect(screen.getByText('of 2 dice')).toBeInTheDocument();
  });

  it('clamps a typed count down to the dice available', () => {
    const { updateExpression } = renderPanel(stale);
    const input = screen.getByLabelText('Dice to keep across parts');
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(updateExpression).toHaveBeenCalledWith('e1', {
      keepAcross: { type: 'highest', n: 2 },
    });
    expect(input).toHaveValue('2');
  });
});
