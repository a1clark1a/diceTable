import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { PanelLegend } from './ChartPanel';

// The legend chip is the only control that isolates one roll, and it had no
// click handler at all: it announced itself as a button, so Enter and Space
// were a false promise, and on touch the one thing that could fire was a
// synthesized mouseover that the next tap cancelled. Every test here fails
// against that version.

const Plain = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

function entries(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    name: `Roll ${i}`,
    color: '#000',
  }));
}

function renderLegend(count = 3) {
  const onPick = vi.fn();
  const onPreview = vi.fn();
  const view = render(
    <Plain>
      <PanelLegend
        entries={entries(count)}
        focusedId={null}
        pickedId={null}
        onPreview={onPreview}
        onPick={onPick}
      />
    </Plain>,
  );
  return { onPick, onPreview, view };
}

function chip(name: string): HTMLElement {
  return screen.getByRole('button', { name: `Focus ${name} in chart` });
}

describe('PanelLegend picking', () => {
  it('picks a roll on a real click, not only on hover', () => {
    const { onPick } = renderLegend();

    fireEvent.click(chip('Roll 1'));

    expect(onPick).toHaveBeenCalledWith('e1');
  });

  it('picks a roll from the keyboard', () => {
    const { onPick } = renderLegend();

    fireEvent.keyDown(chip('Roll 0'), { key: 'Enter' });

    expect(onPick).toHaveBeenCalledWith('e0');
  });

  it('picks a roll with the space bar too', () => {
    const { onPick } = renderLegend();

    fireEvent.keyDown(chip('Roll 2'), { key: ' ' });

    expect(onPick).toHaveBeenCalledWith('e2');
  });

  it('reports which roll is picked, so it reads as pressed', () => {
    render(
      <Plain>
        <PanelLegend
          entries={entries(3)}
          focusedId="e1"
          pickedId="e1"
          onPreview={vi.fn()}
          onPick={vi.fn()}
        />
      </Plain>,
    );

    expect(chip('Roll 1')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Roll 0')).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps a hover from reading as a pick', () => {
    // A previewed roll is focused but not pressed: the distinction is what
    // lets a pick survive the pointer moving away.
    render(
      <Plain>
        <PanelLegend
          entries={entries(3)}
          focusedId="e1"
          pickedId={null}
          onPreview={vi.fn()}
          onPick={vi.fn()}
        />
      </Plain>,
    );

    expect(chip('Roll 1')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('PanelLegend overflow', () => {
  it('caps the entries it shows', () => {
    renderLegend(30);

    expect(screen.queryByRole('button', { name: /Focus Roll 20/ })).toBeNull();
    expect(screen.getByRole('button', { name: '+18 more' })).toBeInTheDocument();
  });

  it('expands to reach the rolls it cut, rather than stranding them', () => {
    // The overflow has to be a real control: these chips are the only way to
    // isolate a roll, so an inert "+18 more" would put those rolls out of reach.
    renderLegend(30);

    fireEvent.click(screen.getByRole('button', { name: '+18 more' }));

    expect(
      screen.getByRole('button', { name: 'Focus Roll 29 in chart' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show fewer' }),
    ).toBeInTheDocument();
  });

  it('shows every roll with no overflow control when they all fit', () => {
    renderLegend(12);

    expect(
      screen.getByRole('button', { name: 'Focus Roll 11 in chart' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more$/ })).toBeNull();
  });
});
