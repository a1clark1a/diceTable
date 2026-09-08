import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { ExpressionDiceText } from './ExpressionRender';
import { expressionNotation } from '../../share/notation';
import type { CheckSpec, Expression } from '../../types';

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

describe('ExpressionDiceText keepAcross', () => {
  const twoParts = [
    { id: 'p1', count: 1, sides: 8 },
    { id: 'p2', count: 1, sides: 6 },
  ];

  it('appends the rule after the dice body behind a middot', () => {
    const { container } = renderDiceText(
      makeExpression({ parts: twoParts, keepAcross: { type: 'highest', n: 1 } }),
    );
    expect(container.textContent).toBe('1d8 + 1d6 · keep highest 1');
  });

  it('renders the lowest direction and count verbatim', () => {
    const { container } = renderDiceText(
      makeExpression({ parts: twoParts, keepAcross: { type: 'lowest', n: 2 } }),
    );
    expect(container.textContent).toContain('keep lowest 2');
  });

  it('keeps the flat modifier ahead of the rule', () => {
    const { container } = renderDiceText(
      makeExpression({
        parts: twoParts,
        flatModifier: 2,
        keepAcross: { type: 'highest', n: 1 },
      }),
    );
    const text = container.textContent ?? '';
    expect(text.indexOf('+ 2')).toBeLessThan(text.indexOf('keep highest'));
  });

  it('describes the rule for screen readers', () => {
    renderDiceText(
      makeExpression({ parts: twoParts, keepAcross: { type: 'highest', n: 1 } }),
    );
    expect(
      screen.getByLabelText('keep the 1 highest dice across every part'),
    ).toBeInTheDocument();
  });

  it('says nothing when the row has no rule', () => {
    const { container } = renderDiceText(makeExpression({ parts: twoParts }));
    expect(container.textContent).not.toContain('keep');
  });
});

function makeCheck(overrides: Partial<CheckSpec> = {}): CheckSpec {
  return {
    threshold: { direction: 'gte', value: 10 },
    effect: { parts: [{ id: 'p2', count: 1, sides: 8 }], flatModifier: 0 },
    onSuccess: 'full',
    onFailure: 'none',
    ...overrides,
  };
}

function makeCheckExpression(
  check: CheckSpec,
  overrides: Partial<Expression> = {},
): Expression {
  return makeExpression({
    parts: [{ id: 'p1', count: 1, sides: 20 }],
    mode: 'check',
    check,
    ...overrides,
  });
}

describe('ExpressionDiceText check mode', () => {
  // The JSX and the plain-text notation are hand-assembled copies of each
  // other; this row lights up every segment both can produce so the exported
  // image and the table cannot disagree.
  const everySegment = makeCheckExpression(
    makeCheck({
      threshold: { direction: 'gte', value: 15 },
      effect: {
        parts: [{ id: 'p2', count: 2, sides: 8 }],
        flatModifier: 4,
        keepAcross: { type: 'highest', n: 1 },
      },
      onSuccess: 'half',
      onFailure: 'full',
      crit: { onFaces: [20, 19], effect: 'maxPlusRoll' },
    }),
    { flatModifier: 7, rollMode: 'advantage' },
  );

  it('renders the whole sentence with every segment in order', () => {
    const { container } = renderDiceText(everySegment, true);
    expect(container.textContent).toBe(
      '1d20 + 7 adv ≥15 → 2d8 + 4 · keep highest 1 · half on a success · full on a failure · crit 19,20 max+roll',
    );
  });

  it('matches the plain-text notation character for character', () => {
    const { container } = renderDiceText(everySegment, true);
    expect(container.textContent).toBe(expressionNotation(everySegment));
  });

  it('announces an at-most threshold as succeeding at or below the value', () => {
    const { container } = renderDiceText(
      makeCheckExpression(
        makeCheck({
          threshold: { direction: 'lte', value: 9 },
          crit: { onFaces: [20, 19], effect: 'extraDie' },
        }),
      ),
    );
    expect(container.textContent).toContain('≤9');
    expect(screen.getByLabelText('succeeds at or below 9')).toBeInTheDocument();
  });

  it('announces an at-least threshold as succeeding at or above the value', () => {
    renderDiceText(
      makeCheckExpression(makeCheck({ threshold: { direction: 'gte', value: 15 } })),
    );
    expect(screen.getByLabelText('succeeds at or above 15')).toBeInTheDocument();
  });

  it('sorts the critical faces ascending in both the text and its label', () => {
    const { container } = renderDiceText(
      makeCheckExpression(
        makeCheck({ crit: { onFaces: [20, 19], effect: 'extraDie' } }),
      ),
    );
    expect(container.textContent).toContain('crit 19,20 +1 die');
    expect(screen.getByLabelText('critical on 19,20')).toBeInTheDocument();
  });

  // The normaliser strips a row-level keepAcross on check rows, so rendering
  // it would show a rule the math ignores.
  it('ignores a row-level keep across on a check row', () => {
    const { container } = renderDiceText(
      makeCheckExpression(makeCheck(), { keepAcross: { type: 'highest', n: 1 } }),
    );
    expect(container.textContent).not.toContain('keep');
    expect(
      screen.queryByLabelText('keep the 1 highest dice across every part'),
    ).not.toBeInTheDocument();
  });

  it('renders a keep across on the effect after the effect dice', () => {
    const { container } = renderDiceText(
      makeCheckExpression(
        makeCheck({
          effect: {
            parts: [
              { id: 'p2', count: 1, sides: 8 },
              { id: 'p3', count: 1, sides: 6 },
            ],
            flatModifier: 0,
            keepAcross: { type: 'lowest', n: 2 },
          },
        }),
      ),
    );
    const text = container.textContent ?? '';
    expect(text).toContain('1d8 + 1d6 · keep lowest 2');
    expect(text.indexOf('→')).toBeLessThan(text.indexOf('keep lowest 2'));
    expect(
      screen.getByLabelText('keep the 2 lowest dice across every part'),
    ).toBeInTheDocument();
  });

  it('falls back to (no effect) when the effect has no parts', () => {
    const { container } = renderDiceText(
      makeCheckExpression(makeCheck({ effect: { parts: [], flatModifier: 0 } })),
    );
    expect(container.textContent).toBe('1d20 ≥10 → (no effect)');
  });
});

describe('ExpressionDiceText empty sum row', () => {
  it('falls back to (no parts) when the row has no dice', () => {
    const { container } = renderDiceText(makeExpression({ parts: [] }));
    expect(container.textContent).toBe('(no parts)');
  });
});
