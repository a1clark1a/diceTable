import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
