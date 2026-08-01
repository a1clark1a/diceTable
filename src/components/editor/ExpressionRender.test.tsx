import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { ExpressionDiceText } from './ExpressionRender';
import type { Expression } from '../../types';

const Provider = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

function makeExpression(overrides: Partial<Expression> = {}): Expression {
  return {
    id: 'e1',
    name: 'Row',
    parts: [{ id: 'p1', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...overrides,
  };
}

function renderDiceText(expr: Expression, showRollMode = false) {
  return render(
    <Provider>
      <ExpressionDiceText expr={expr} showRollMode={showRollMode} />
    </Provider>,
  );
}

describe('ExpressionDiceText sum mode', () => {
  it('renders the dice body and flat modifier with no pool separators', () => {
    const { container } = renderDiceText(makeExpression({ flatModifier: 3 }));
    expect(container.textContent).toContain('2d6');
    expect(container.textContent).toContain('+ 3');
    expect(container.textContent).not.toContain('·');
  });

  it('shows the advantage suffix when roll mode display is on', () => {
    renderDiceText(
      makeExpression({ rollMode: 'advantage' }),
      true,
    );
    expect(screen.getByText('adv')).toBeInTheDocument();
  });
});

describe('ExpressionDiceText pool mode', () => {
  it('renders the dice body and the at-least count segment', () => {
    const { container } = renderDiceText(
      makeExpression({
        parts: [{ id: 'p1', count: 7, sides: 10 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 8 },
      }),
    );
    expect(container.textContent).toContain('7d10');
    expect(container.textContent).toContain('count ≥8');
    expect(screen.getByLabelText('count at least 8')).toBeInTheDocument();
  });

  it('renders the at-most count segment for a lte threshold', () => {
    const { container } = renderDiceText(
      makeExpression({
        parts: [{ id: 'p1', count: 7, sides: 10 }],
        mode: 'pool',
        successThreshold: { direction: 'lte', value: 2 },
      }),
    );
    expect(container.textContent).toContain('count ≤2');
    expect(screen.getByLabelText('count at most 2')).toBeInTheDocument();
  });

  it('shows a positive flat modifier as automatic successes', () => {
    const { container } = renderDiceText(
      makeExpression({
        parts: [{ id: 'p1', count: 7, sides: 10 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 8 },
        flatModifier: 2,
      }),
    );
    expect(container.textContent).toContain('+2 auto');
    expect(
      screen.getByLabelText('plus 2 automatic successes'),
    ).toBeInTheDocument();
  });

  it('shows a negative flat modifier with a true minus sign', () => {
    const { container } = renderDiceText(
      makeExpression({
        parts: [{ id: 'p1', count: 7, sides: 10 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 8 },
        flatModifier: -2,
      }),
    );
    expect(container.textContent).toContain('−2 auto');
    expect(container.textContent).not.toContain('-2 auto');
    expect(
      screen.getByLabelText('minus 2 automatic successes'),
    ).toBeInTheDocument();
  });

  it('omits the auto-success segment when the flat modifier is zero', () => {
    const { container } = renderDiceText(
      makeExpression({
        parts: [{ id: 'p1', count: 7, sides: 10 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 8 },
        flatModifier: 0,
      }),
    );
    expect(container.textContent).not.toContain('auto');
  });

  it('never shows the roll-mode suffix even when roll mode display is on', () => {
    const { container } = renderDiceText(
      makeExpression({
        parts: [{ id: 'p1', count: 7, sides: 10 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 8 },
        rollMode: 'advantage',
      }),
      true,
    );
    expect(container.textContent).not.toContain('adv');
  });

  it('never shows the sum-style modifier suffix for a pool modifier', () => {
    const { container } = renderDiceText(
      makeExpression({
        parts: [{ id: 'p1', count: 7, sides: 10 }],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 8 },
        flatModifier: 2,
      }),
    );
    expect(container.textContent).not.toContain(' + 2');
    expect(container.textContent).toContain('+2 auto');
  });

  it('keeps reroll notation inside the dice body', () => {
    const { container } = renderDiceText(
      makeExpression({
        parts: [
          {
            id: 'p1',
            count: 7,
            sides: 10,
            reroll: { values: [1], mode: 'once' },
          },
        ],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 8 },
      }),
    );
    expect(container.textContent).toContain('7d10 reroll 1s once');
  });

  it('joins multiple parts with plus before the count segment', () => {
    const { container } = renderDiceText(
      makeExpression({
        parts: [
          { id: 'p1', count: 2, sides: 6 },
          { id: 'p2', count: 3, sides: 8 },
        ],
        mode: 'pool',
        successThreshold: { direction: 'gte', value: 5 },
      }),
    );
    const text = container.textContent ?? '';
    expect(text).toContain('2d6 + 3d8');
    expect(text).toContain('count ≥5');
    expect(text.indexOf('2d6 + 3d8')).toBeLessThan(text.indexOf('count ≥5'));
  });

  it('renders just the dice body when the success threshold is missing', () => {
    const { container } = renderDiceText(
      makeExpression({
        parts: [{ id: 'p1', count: 7, sides: 10 }],
        mode: 'pool',
      }),
    );
    expect(container.textContent).toContain('7d10');
    expect(container.textContent).not.toContain('count');
  });
});
