import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import OverlayChartImpl from './OverlayChartImpl';
import type { Distribution, Expression, TargetState } from '../../types';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

const Plain = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

function poolExpr(): Expression {
  return {
    id: 'e1',
    name: 'Pool A',
    parts: [{ id: 'p1', count: 4, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 5 },
  };
}

function sumExpr(): Expression {
  return {
    id: 'e1',
    name: 'Sword',
    parts: [{ id: 'p1', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
}

function renderTargetView(
  expr: Expression,
  target: TargetState,
  unit?: 'totals' | 'successes',
) {
  const dist: Distribution = new Map([
    [1, 0.5],
    [2, 0.5],
  ]);
  return render(
    <Plain>
      <OverlayChartImpl
        expressions={[expr]}
        dists={new Map([[expr.id, dist]])}
        effectiveView="target"
        target={target}
        hoveredId={null}
        colors={new Map([[expr.id, '#123456']])}
        {...(unit !== undefined && { unit })}
      />
    </Plain>,
  );
}

describe('OverlayChartImpl target view unit wording', () => {
  it('describes the totals panel as targets by default', () => {
    renderTargetView(sumExpr(), { values: [10], ruling: 'gte' });
    expect(screen.getByText('Hit rate · Target')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Hit rate per roll for targets ≥ 10',
      }),
    ).toBeInTheDocument();
  });

  it('describes the successes panel as successes, not targets', () => {
    renderTargetView(poolExpr(), { values: [3], ruling: 'gte' }, 'successes');
    expect(screen.getByText('Hit rate · Successes')).toBeInTheDocument();
    expect(screen.queryByText('Hit rate · Target')).toBeNull();
    expect(
      screen.getByRole('img', {
        name: 'Hit rate per roll for 3 or more successes',
      }),
    ).toBeInTheDocument();
  });
});
