import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { FacePicker, NumberStepper, Panel } from './controls';

const Provider = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

interface StepperProps {
  value: number;
  min: number;
  max?: number;
  ariaLabel: string;
}

function renderStepper({ value, min, max, ariaLabel }: StepperProps) {
  const onCommit = vi.fn();
  // Spread rather than max={max}: exactOptionalPropertyTypes refuses an explicit
  // undefined, and "no max" is exactly the case the Count stepper relies on.
  const ceiling = max === undefined ? {} : { max };
  render(
    <Provider>
      <NumberStepper
        value={value}
        min={min}
        ariaLabel={ariaLabel}
        onCommit={onCommit}
        {...ceiling}
      />
    </Provider>,
  );
  return { onCommit, input: screen.getByLabelText(ariaLabel) };
}

// The Check and Effect modifiers are the only steppers whose floor is negative;
// the garbage battery elsewhere only drives fields whose minimum is 1.
describe('NumberStepper below a negative floor', () => {
  it('commits the floor when the typed value is below a negative minimum', () => {
    const { onCommit, input } = renderStepper({
      value: 0,
      min: -99,
      max: 99,
      ariaLabel: 'Check modifier',
    });
    fireEvent.change(input, { target: { value: '-100' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(-99);
  });

  it('shows the floor in the field after clamping a value below it', () => {
    const { input } = renderStepper({
      value: 0,
      min: -99,
      max: 99,
      ariaLabel: 'Check modifier',
    });
    fireEvent.change(input, { target: { value: '-100' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('-99');
  });
});

// The dice Count stepper has no ceiling, so its Increase button must never
// switch off no matter how large the count already is.
describe('NumberStepper without a maximum', () => {
  it('leaves Increase enabled at a very large value', () => {
    renderStepper({ value: 999999, min: 1, ariaLabel: 'Count' });
    expect(screen.getByRole('button', { name: 'Increase Count' })).toBeEnabled();
  });

  it('steps past a very large value when Increase is pressed', () => {
    const { onCommit } = renderStepper({ value: 999999, min: 1, ariaLabel: 'Count' });
    fireEvent.click(screen.getByRole('button', { name: 'Increase Count' }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(1000000);
  });
});

// A committed value can end up outside the range when the bounds move under it
// (keep-across count after a part shrinks). The buttons are the only way back
// short of retyping, so a step has to land on the nearest bound, not refuse.
describe('NumberStepper with a value outside its range', () => {
  it('steps a value above the maximum back down onto the maximum', () => {
    const { onCommit } = renderStepper({
      value: 4,
      min: 1,
      max: 2,
      ariaLabel: 'Dice to keep across parts',
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Decrease Dice to keep across parts' }),
    );

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(2);
  });

  it('keeps Increase switched off while the value sits above the maximum', () => {
    renderStepper({ value: 4, min: 1, max: 2, ariaLabel: 'Dice to keep across parts' });
    expect(
      screen.getByRole('button', { name: 'Increase Dice to keep across parts' }),
    ).toBeDisabled();
  });

  it('steps a value below the minimum back up onto the minimum', () => {
    const { onCommit } = renderStepper({ value: -5, min: 1, max: 9, ariaLabel: 'Count' });
    fireEvent.click(screen.getByRole('button', { name: 'Increase Count' }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(1);
  });
});

// The buffering rules themselves live in useBufferedValue.test.ts; these two
// only check that the stepper wires the input's change, key, and blur events
// into that hook, since a commit per keystroke would persist half-typed values.
describe('NumberStepper buffering', () => {
  it('holds a typed draft without committing until Enter or blur', () => {
    const { onCommit, input } = renderStepper({
      value: 5,
      min: 0,
      max: 10,
      ariaLabel: 'Depth cap',
    });
    fireEvent.change(input, { target: { value: '7' } });

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('7');
  });

  // In a browser Escape also blurs the field, so the blur that follows must
  // not commit the draft the Escape just threw away.
  it('does not commit the reverted draft when the field blurs after Escape', () => {
    const { onCommit, input } = renderStepper({
      value: 5,
      min: 0,
      max: 10,
      ariaLabel: 'Depth cap',
    });
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('5');
  });
});

function renderPicker(sides: number, selected: number[], ariaLabel = 'Explode faces') {
  const onChange = vi.fn();
  render(
    <Provider>
      <FacePicker sides={sides} selected={selected} onChange={onChange} ariaLabel={ariaLabel} />
    </Provider>,
  );
  return { onChange };
}

// Custom sides go up to 1000, so the 30-face boundary is the only thing
// standing between the user and a thousand-button grid.
describe('FacePicker face limit', () => {
  it('lists every face of a 30-sided die', () => {
    renderPicker(30, []);
    const group = within(screen.getByRole('group', { name: 'Explode faces' }));
    const names = group.getAllByRole('button').map((b) => b.getAttribute('aria-label'));

    expect(names).toEqual(Array.from({ length: 30 }, (_, i) => `Face ${i + 1}`));
    expect(screen.queryByText(/too many faces/)).not.toBeInTheDocument();
  });

  it('starts every face of a 30-sided die unpressed when nothing is selected', () => {
    renderPicker(30, []);
    const group = within(screen.getByRole('group', { name: 'Explode faces' }));

    expect(group.getAllByRole('button', { pressed: false })).toHaveLength(30);
  });

  it('replaces the grid with an explanation at 31 sides', () => {
    renderPicker(31, []);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'd31 has too many faces to list here. Pick a die with 30 sides or fewer.',
      ),
    ).toBeInTheDocument();
  });

  it('asks for valid sides when the die has fewer than 2', () => {
    renderPicker(1, []);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByText('Set valid sides first.')).toBeInTheDocument();
  });

  it('asks for valid sides when the side count is not a whole number', () => {
    renderPicker(2.5, []);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByText('Set valid sides first.')).toBeInTheDocument();
  });
});

// The reroll and explode engines receive the raw array, so the picker has to
// keep it sorted rather than leaving the order to whoever reads it next.
describe('FacePicker selection', () => {
  it('marks the selected faces pressed and the rest unpressed', () => {
    renderPicker(6, [1, 6], 'Reroll faces');
    expect(screen.getByRole('button', { name: 'Face 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Face 6' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Face 3' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('inserts a newly picked face in ascending order rather than appending it', () => {
    const { onChange } = renderPicker(6, [1, 6], 'Reroll faces');
    fireEvent.click(screen.getByRole('button', { name: 'Face 3' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([1, 3, 6]);
  });
});

// tipForId returns '' for an unknown id, so '' has to mean "no help term" and
// not "a focusable heading with a blank tooltip".
describe('Panel heading', () => {
  it('turns the label into a focusable help term when a tip is supplied', () => {
    render(
      <Provider>
        <Panel label="Outcomes" tip="How much of the effect lands.">
          x
        </Panel>
      </Provider>,
    );
    expect(screen.getByText('Outcomes')).toHaveAttribute('tabindex', '0');
  });

  it('renders the label as plain text when the tip is empty', () => {
    render(
      <Provider>
        <Panel label="Outcomes" tip="">
          x
        </Panel>
      </Provider>,
    );
    expect(screen.getByText('Outcomes')).not.toHaveAttribute('tabindex');
  });

  it('renders the label as plain text when no tip is given', () => {
    render(
      <Provider>
        <Panel label="Outcomes">x</Panel>
      </Provider>,
    );
    expect(screen.getByText('Outcomes')).not.toHaveAttribute('tabindex');
  });
});
