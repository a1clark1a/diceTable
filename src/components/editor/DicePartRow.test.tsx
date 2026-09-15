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
        mode="sum"
        keepAcrossActive={false}
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
        mode="sum"
        keepAcrossActive={false}
        onChange={onChange}
        onRemove={vi.fn()}
        canRemove
      />
    </Provider>,
  );
  return { onChange };
}

describe('DicePartRow FacePicker', () => {
  it('renders one toggle button per face with the selected face pressed', () => {
    renderRow();
    const group = screen.getByRole('group', { name: 'Reroll faces' });
    const buttons = group.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons.length).toBe(6);
    const pressed = Array.from(buttons).filter(
      (b) => b.getAttribute('aria-pressed') === 'true',
    );
    expect(pressed.length).toBe(1);
    expect(pressed[0]!.getAttribute('aria-label')).toBe('Face 1');
  });
});

// Typed input has to land inside the same bounds the +/- buttons enforce: an
// out-of-range commit would be rejected by the schema validator on the next
// load, and one rejected row drops the whole saved table.
describe('DicePartRow count stepper clamping', () => {
  it('clamps a typed 0 up to the minimum of 1', () => {
    const { onChange } = renderWith(basePart());
    const input = screen.getByLabelText('Count');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ count: 1 });
  });

  it('clamps a cleared field up to the minimum of 1', () => {
    const { onChange } = renderWith(basePart());
    const input = screen.getByLabelText('Count');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ count: 1 });
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
    const input = screen.getByLabelText('How many (n)') as HTMLInputElement;
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
          mode="sum"
          keepAcrossActive={false}
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
          mode="sum"
          keepAcrossActive={false}
          onChange={vi.fn()}
          onRemove={vi.fn()}
          canRemove
        />
      </Provider>,
    );
    expect(screen.queryByLabelText('How many (n)')).toBeNull();
    rerender(
      <Provider>
        <DicePartRow
          part={partWithKeep(5)}
          mode="sum"
          keepAcrossActive={false}
          onChange={vi.fn()}
          onRemove={vi.fn()}
          canRemove
        />
      </Provider>,
    );
    expect((screen.getByLabelText('How many (n)') as HTMLInputElement).value).toBe('5');
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
    const buttons = group.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons.length).toBe(6);
    expect(buttons[5]!.getAttribute('aria-pressed')).toBe('true');
  });

  it('says so when every face the die can still show would explode', () => {
    // Rerolling 1 to 3 away leaves 4, 5 and 6, and all three explode, so the
    // chain has no ending and the engine answers with a blank row. Counting the
    // picked faces against the die's size passed this, because three is fewer
    // than six, and the user got the blank row with no reason for it.
    renderWith({
      id: 'p1',
      count: 4,
      sides: 6,
      reroll: { values: [1, 2, 3], mode: 'always' },
      explode: { onFaces: [4, 5, 6], depthCap: 3 },
    });
    expect(screen.getByText('Cannot explode on all faces')).toBeInTheDocument();
  });
});

describe('DicePartRow pool-mode chip disabling', () => {
  function barePart(): DicePart {
    return { id: 'p1', count: 4, sides: 6 };
  }

  function renderInMode(
    mode: 'sum' | 'pool',
    part: DicePart = barePart(),
    onChange = vi.fn(),
  ) {
    render(
      <Provider>
        <DicePartRow
          part={part}
          mode={mode}
          keepAcrossActive={false}
          onChange={onChange}
          onRemove={vi.fn()}
          canRemove
        />
      </Provider>,
    );
    return { onChange };
  }

  it('marks Keep and Explode as disabled in pool mode while Reroll stays enabled', () => {
    renderInMode('pool');
    const keep = screen.getByRole('button', { name: 'Keep' });
    const explode = screen.getByRole('button', { name: 'Explode' });
    const reroll = screen.getByRole('button', { name: 'Reroll' });
    expect(keep).toHaveAttribute('aria-disabled', 'true');
    expect(keep).toHaveAttribute('data-disabled');
    expect(explode).toHaveAttribute('aria-disabled', 'true');
    expect(explode).toHaveAttribute('data-disabled');
    expect(reroll).not.toHaveAttribute('aria-disabled');
    expect(reroll).not.toHaveAttribute('data-disabled');
  });

  it('ignores clicks on the disabled Keep and Explode chips in pool mode', () => {
    const { onChange } = renderInMode('pool');
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    fireEvent.click(screen.getByRole('button', { name: 'Explode' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggles Reroll on with the default rule in pool mode', () => {
    const { onChange } = renderInMode('pool');
    fireEvent.click(screen.getByRole('button', { name: 'Reroll' }));
    expect(onChange).toHaveBeenCalledWith({
      reroll: { values: [1], mode: 'once' },
    });
  });

  it('toggles Keep on with a keep rule in sum mode', () => {
    const { onChange } = renderInMode('sum');
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(onChange).toHaveBeenCalledWith({
      keep: { type: 'highest', n: 3 },
    });
  });

  it('keeps the disabled Keep chip in the tab order in pool mode', () => {
    renderInMode('pool');
    const keep = screen.getByRole('button', { name: 'Keep' });
    expect(keep).not.toHaveAttribute('disabled');
    expect(keep.tabIndex).toBe(0);
  });
});
