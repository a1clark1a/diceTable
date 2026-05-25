import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../state/AppContext';
import { TargetToolbar } from './TargetToolbar';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

function renderToolbar() {
  return render(
    <Providers>
      <TargetToolbar />
    </Providers>,
  );
}

function getInput(): HTMLInputElement {
  return screen.getByLabelText('Add target value') as HTMLInputElement;
}

function addValue(raw: string) {
  const input = getInput();
  fireEvent.change(input, { target: { value: raw } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

afterEach(() => {
  window.localStorage.clear();
});

describe('TargetToolbar', () => {
  it('starts with no target chips', () => {
    renderToolbar();
    expect(
      screen.queryByRole('button', { name: /^Remove target/i }),
    ).toBeNull();
  });

  it('adds a target chip when a number is entered and Enter is pressed', () => {
    renderToolbar();
    addValue('13');
    expect(
      screen.getByRole('button', { name: 'Remove target ≥ 13' }),
    ).toBeInTheDocument();
    expect(getInput().value).toBe('');
  });

  it('rejects a duplicate value silently', () => {
    renderToolbar();
    addValue('13');
    addValue('13');
    expect(
      screen.getAllByRole('button', { name: 'Remove target ≥ 13' }),
    ).toHaveLength(1);
  });

  it('removes a chip when its X button is clicked', () => {
    renderToolbar();
    addValue('13');
    addValue('16');
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove target ≥ 13' }),
    );
    expect(
      screen.queryByRole('button', { name: 'Remove target ≥ 13' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Remove target ≥ 16' }),
    ).toBeInTheDocument();
  });

  it('disables the input once five targets are present', () => {
    renderToolbar();
    addValue('10');
    addValue('11');
    addValue('12');
    addValue('13');
    addValue('14');
    expect(getInput().disabled).toBe(true);
  });

  it('removes the last chip when Backspace is pressed on an empty input', () => {
    renderToolbar();
    addValue('13');
    addValue('16');
    fireEvent.keyDown(getInput(), { key: 'Backspace' });
    expect(
      screen.queryByRole('button', { name: 'Remove target ≥ 16' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Remove target ≥ 13' }),
    ).toBeInTheDocument();
  });

  it('reflects the current ruling symbol on every chip', () => {
    renderToolbar();
    addValue('13');
    addValue('16');
    fireEvent.change(screen.getByLabelText('Target ruling'), {
      target: { value: 'lt' },
    });
    expect(
      screen.getByRole('button', { name: 'Remove target < 13' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove target < 16' }),
    ).toBeInTheDocument();
  });

  it('does not add a chip for non-numeric input', () => {
    renderToolbar();
    const input = getInput();
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(
      screen.queryByRole('button', { name: /^Remove target/ }),
    ).toBeNull();
    expect(input.value).toBe('');
  });

  it('keeps chips sorted ascending regardless of insertion order', () => {
    renderToolbar();
    addValue('19');
    addValue('13');
    addValue('16');
    const removeButtons = screen
      .getAllByRole('button', { name: /^Remove target ≥/ })
      .map((b) => b.getAttribute('aria-label'));
    expect(removeButtons).toEqual([
      'Remove target ≥ 13',
      'Remove target ≥ 16',
      'Remove target ≥ 19',
    ]);
  });
});
