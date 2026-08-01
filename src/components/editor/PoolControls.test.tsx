import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { PoolBadge, PoolModeToggle, PoolThresholdEditor } from './PoolControls';
import type { ExpressionMode, SuccessThreshold } from '../../types';

const Provider = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

describe('PoolBadge', () => {
  it('renders a Pool label', () => {
    render(
      <Provider>
        <PoolBadge />
      </Provider>,
    );
    expect(screen.getByText('Pool')).toBeInTheDocument();
  });
});

describe('PoolModeToggle', () => {
  function renderToggle(mode: ExpressionMode, onSelect = vi.fn()) {
    render(
      <Provider>
        <PoolModeToggle mode={mode} onSelect={onSelect} />
      </Provider>,
    );
    return { onSelect };
  }

  it('marks the Sum chip pressed and the Pool chip unpressed in sum mode', () => {
    renderToggle('sum');
    expect(screen.getByRole('button', { name: 'Sum' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Pool' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('clicking the Pool chip selects pool mode', () => {
    const { onSelect } = renderToggle('sum');
    fireEvent.click(screen.getByRole('button', { name: 'Pool' }));
    expect(onSelect).toHaveBeenCalledWith('pool');
  });

  it('clicking the Sum chip selects sum mode', () => {
    const { onSelect } = renderToggle('sum');
    fireEvent.click(screen.getByRole('button', { name: 'Sum' }));
    expect(onSelect).toHaveBeenCalledWith('sum');
  });
});

describe('PoolThresholdEditor', () => {
  function renderEditor(threshold: SuccessThreshold, onChange = vi.fn()) {
    render(
      <Provider>
        <PoolThresholdEditor threshold={threshold} onChange={onChange} />
      </Provider>,
    );
    return { onChange };
  }

  it('flipping the direction button turns at-or-above into at-or-below', () => {
    const { onChange } = renderEditor({ direction: 'gte', value: 8 });
    fireEvent.click(
      screen.getByRole('button', { name: 'Success direction: at or above' }),
    );
    expect(onChange).toHaveBeenCalledWith({ direction: 'lte', value: 8 });
  });

  it('names the direction button at-or-below when the direction is lte', () => {
    renderEditor({ direction: 'lte', value: 8 });
    expect(
      screen.getByRole('button', { name: 'Success direction: at or below' }),
    ).toBeInTheDocument();
  });

  it('shows the committed threshold value in the input', () => {
    renderEditor({ direction: 'gte', value: 8 });
    const input = screen.getByLabelText('Success threshold') as HTMLInputElement;
    expect(input.value).toBe('8');
  });

  it('typing a new value and pressing Enter commits it', () => {
    const { onChange } = renderEditor({ direction: 'gte', value: 8 });
    const input = screen.getByLabelText('Success threshold');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ direction: 'gte', value: 12 });
  });

  it('clamps a committed zero up to the minimum of 1', () => {
    const { onChange } = renderEditor({ direction: 'gte', value: 8 });
    const input = screen.getByLabelText('Success threshold');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ direction: 'gte', value: 1 });
  });

  it('commits the minimum of 1 when the typed value is not a number', () => {
    const { onChange } = renderEditor({ direction: 'gte', value: 8 });
    const input = screen.getByLabelText('Success threshold');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ direction: 'gte', value: 1 });
  });
});
