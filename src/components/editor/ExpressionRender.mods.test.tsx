import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { ExpressionDiceText } from './ExpressionRender';
import { tipForId } from '../../docs/glossary';
import type { Expression, ModStep } from '../../types';

function row(mode: 'sum' | 'pool', mods: ModStep[]): Expression {
  const expr: Expression = {
    id: 'e1',
    name: 'Row',
    parts: [{ id: 'p1', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode,
    mods,
  };
  if (mode === 'pool') expr.successThreshold = { direction: 'gte', value: 5 };
  return expr;
}

function renderDiceText(expr: Expression) {
  render(
    <ChakraProvider value={defaultSystem}>
      <ExpressionDiceText expr={expr} />
    </ChakraProvider>,
  );
}

// The tip is the only place a reader learns that ÷ rounds down or that × does
// not roll again, so each step has to open the tip written for its own mode.
async function tipOf(label: string): Promise<HTMLElement> {
  const term = screen.getByLabelText(label);
  // The tooltip machine opens on a mouse pointer, not on a bare focus() in
  // jsdom, which has no keyboard modality to read.
  fireEvent.pointerMove(term, { pointerType: 'mouse' });
  return screen.findByRole('tooltip');
}

describe('ExpressionDiceText chain tips', () => {
  it('explains a sum row’s multiply step', async () => {
    renderDiceText(row('sum', [{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    expect(await tipOf('times 2')).toHaveTextContent(tipForId('modMultiply'));
  });

  it('says a sum row’s divide step rounds down', async () => {
    renderDiceText(row('sum', [{ op: 'div', value: 2 }]));
    expect(await tipOf('divided by 2, rounded down')).toHaveTextContent(
      tipForId('modDivide'),
    );
  });

  it('leaves a sum row’s add step as plain text with no tip', () => {
    renderDiceText(row('sum', [{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    expect(screen.queryByLabelText('plus 3')).not.toBeInTheDocument();
  });

  it('calls a pool row’s add step automatic successes', async () => {
    renderDiceText(row('pool', [{ op: 'add', value: 2 }, { op: 'mul', value: 2 }]));
    expect(await tipOf('plus 2 automatic successes')).toHaveTextContent(
      tipForId('poolAutoSuccess'),
    );
  });

  it('explains a pool row’s multiply step in successes, not totals', async () => {
    renderDiceText(row('pool', [{ op: 'add', value: 2 }, { op: 'mul', value: 2 }]));
    expect(await tipOf('times 2')).toHaveTextContent(tipForId('poolMultiply'));
  });

  it('explains a pool row’s divide step in successes', async () => {
    renderDiceText(row('pool', [{ op: 'div', value: 2 }]));
    expect(await tipOf('divided by 2, rounded down')).toHaveTextContent(
      tipForId('poolDivide'),
    );
  });
});
