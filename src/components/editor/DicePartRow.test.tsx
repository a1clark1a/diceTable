import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { DicePartRow } from './DicePartRow';
import type { DicePart } from '../../types';

const Provider = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

function basePart(): DicePart {
  return {
    id: 'p1',
    count: 4,
    sides: 6,
    reroll: { values: [1], mode: 'once' },
  };
}

function renderRow() {
  render(
    <Provider>
      <DicePartRow
        part={basePart()}
        onChange={vi.fn()}
        onRemove={vi.fn()}
        canRemove
      />
    </Provider>,
  );
}

function renderWith(part: DicePart, onChange = vi.fn()) {
  render(
    <Provider>
      <DicePartRow
        part={part}
        onChange={onChange}
        onRemove={vi.fn()}
        canRemove
      />
    </Provider>,
  );
  return { onChange };
}

describe('DicePartRow FacePicker', () => {
  it('gives each face checkbox a unique input id and matching label for=', () => {
    renderRow();
    const group = screen.getByRole('group', { name: 'Reroll faces' });
    const inputs = group.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(inputs.length).toBe(6);
    const inputIds = Array.from(inputs).map((i) => i.id);
    expect(new Set(inputIds).size).toBe(6);

    const labels = group.querySelectorAll<HTMLLabelElement>(
      '[data-scope="checkbox"][data-part="root"]',
    );
    expect(labels.length).toBe(6);
    labels.forEach((label, i) => {
      expect(label.getAttribute('for')).toBe(inputIds[i]);
    });
  });
});

describe('DicePartRow KeepRuleEditor', () => {
  function partWithKeep(n = 3): DicePart {
    return {
      id: 'p1',
      count: 4,
      sides: 6,
      keep: { type: 'highest', n },
    };
  }

  it('renders the committed keep.n in the buffered input', () => {
    renderWith(partWithKeep(2));
    const input = screen.getByLabelText('n') as HTMLInputElement;
    expect(input.value).toBe('2');
  });

  it('shows no validation error when committed keep.n is within bounds', () => {
    renderWith(partWithKeep(3));
    expect(screen.queryByText('Keep ≤ count')).toBeNull();
  });

  it('shows the validation error from the committed value', () => {
    renderWith({ ...partWithKeep(99), count: 4 });
    expect(screen.getByText('Keep ≤ count')).toBeInTheDocument();
  });

  it('commits the keep type select immediately', () => {
    const { onChange } = renderWith(partWithKeep(3));
    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: 'lowest' },
    });
    expect(onChange).toHaveBeenCalledWith({
      keep: { type: 'lowest', n: 3 },
    });
  });

  it('renders the new keep.n after Keep is toggled off and back on', () => {
    const { rerender } = render(
      <Provider>
        <DicePartRow
          part={partWithKeep(2)}
          onChange={vi.fn()}
          onRemove={vi.fn()}
          canRemove
        />
      </Provider>,
    );
    rerender(
      <Provider>
        <DicePartRow
          part={{ id: 'p1', count: 4, sides: 6 }}
          onChange={vi.fn()}
          onRemove={vi.fn()}
          canRemove
        />
      </Provider>,
    );
    expect(screen.queryByLabelText('n')).toBeNull();
    rerender(
      <Provider>
        <DicePartRow
          part={partWithKeep(5)}
          onChange={vi.fn()}
          onRemove={vi.fn()}
          canRemove
        />
      </Provider>,
    );
    expect((screen.getByLabelText('n') as HTMLInputElement).value).toBe('5');
  });
});

describe('DicePartRow ExplodeRuleEditor', () => {
  function partWithExplode(depthCap = 10): DicePart {
    return {
      id: 'p1',
      count: 4,
      sides: 6,
      explode: { onFaces: [6], depthCap },
    };
  }

  it('renders the committed depth-cap in the buffered input', () => {
    renderWith(partWithExplode(7));
    const input = screen.getByLabelText('Depth cap') as HTMLInputElement;
    expect(input.value).toBe('7');
  });

  it('shows the explode-depth validation error from the committed value', () => {
    renderWith({
      id: 'p1',
      count: 4,
      sides: 6,
      explode: { onFaces: [6], depthCap: -1 },
    });
    expect(screen.getByText('Depth ≥ 0')).toBeInTheDocument();
  });

  it('renders the explode face picker against the committed sides', () => {
    renderWith(partWithExplode(10));
    const group = screen.getByRole('group', { name: 'Explode faces' });
    const checkboxes = group.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkboxes.length).toBe(6);
    expect(checkboxes[5]!.checked).toBe(true);
  });
});
