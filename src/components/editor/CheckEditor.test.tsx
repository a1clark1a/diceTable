import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { useEffect, type ReactNode } from 'react';
import { AppProvider } from '../../state/AppContext';
import { useApp } from '../../state/useApp';
import { RollExpand } from '../RollExpand';
import { ExpressionModeToggle } from './PoolControls';
import { expressionDistribution } from '../../engine/expression';
import { max, mean, min, stddev } from '../../engine/stats';
import type { Expression } from '../../types';

// The editor only ever reads its row out of AppContext, so the tests drive the
// real provider and read the committed row back out instead of asserting on
// callback arguments that no user could see.
let current: Expression | undefined;

function Harness() {
  const { expressions, addExpression, updateExpression } = useApp();
  const expr = expressions[0];
  useEffect(() => {
    current = expr;
  }, [expr]);
  if (!expr) {
    return (
      <button type="button" onClick={addExpression}>
        seed
      </button>
    );
  }
  return (
    <>
      {/* The mode chips sit outside the editor subtree so a query for the
          "Check" panel heading cannot pick up the "Check" mode chip. */}
      <div data-testid="mode-toggle">
        <ExpressionModeToggle
          mode={expr.mode}
          onSelect={(mode) => updateExpression(expr.id, { mode })}
        />
      </div>
      <div data-testid="editor">
        <RollExpand expression={expr} />
      </div>
    </>
  );
}

const Wrapper = ({ children }: { children: ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

afterEach(() => {
  window.localStorage.clear();
  current = undefined;
});

function editor() {
  return within(screen.getByTestId('editor'));
}

function commit(input: HTMLElement, value: number) {
  fireEvent.change(input, { target: { value: String(value) } });
  fireEvent.keyDown(input, { key: 'Enter' });
  // These inputs buffer until Enter. A refused edit would otherwise surface as a
  // wrong mean several assertions later, pointing at the maths instead of here.
  expect(input).toHaveValue(String(value));
}

function startSumRow() {
  render(
    <Wrapper>
      <Harness />
    </Wrapper>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'seed' }));
}

function startCheckRow() {
  startSumRow();
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
}

function dist() {
  return expressionDistribution(current!);
}

// Two dice rows are on screen for a check: the check die comes first, the
// effect's part second.
function checkDieControl(label: string) {
  return screen.getAllByLabelText(label)[0]!;
}

function effectDieControl(label: string) {
  return screen.getAllByLabelText(label)[1]!;
}

// Both the Check and the Effect panel carry an Add part button, in that order.
function addCheckPart() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Add part' })[0]!);
}

function addEffectPart() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Add part' })[1]!);
}

describe('CheckEditor building a whole roll through the GUI', () => {
  it('builds a longsword attack with a mean of 5.75', () => {
    startCheckRow();

    commit(screen.getByLabelText('Check modifier'), 7);
    commit(screen.getByLabelText('Success threshold'), 15);
    fireEvent.click(screen.getAllByRole('button', { name: 'd8' })[1]!);
    commit(screen.getByLabelText('Effect modifier'), 4);
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    expect(mean(dist())).toBeCloseTo(5.75, 8);
  });

  it('gives the longsword attack a spread of 4.7342', () => {
    startCheckRow();

    commit(screen.getByLabelText('Check modifier'), 7);
    commit(screen.getByLabelText('Success threshold'), 15);
    fireEvent.click(screen.getAllByRole('button', { name: 'd8' })[1]!);
    commit(screen.getByLabelText('Effect modifier'), 4);
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    expect(stddev(dist())).toBeCloseTo(4.7342, 4);
  });

  it('lets the longsword attack land anywhere from 0 to 20', () => {
    startCheckRow();

    commit(screen.getByLabelText('Check modifier'), 7);
    commit(screen.getByLabelText('Success threshold'), 15);
    fireEvent.click(screen.getAllByRole('button', { name: 'd8' })[1]!);
    commit(screen.getByLabelText('Effect modifier'), 4);
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    expect(min(dist())).toBe(0);
    expect(max(dist())).toBe(20);
  });

  it('reads back the longsword attack as succeeding 65% of the time', () => {
    startCheckRow();

    commit(screen.getByLabelText('Check modifier'), 7);
    commit(screen.getByLabelText('Success threshold'), 15);
    fireEvent.click(screen.getAllByRole('button', { name: 'd8' })[1]!);
    commit(screen.getByLabelText('Effect modifier'), 4);
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    expect(screen.getByText(/Succeeds 65% of the time/)).toBeInTheDocument();
  });

  it('seeds the critical on the top face of the check die', () => {
    startCheckRow();
    // A d12 check, not the default d20, so the assertion can tell reading the
    // die's own top face apart from assuming a 20.
    fireEvent.click(screen.getAllByRole('button', { name: 'd12' })[0]!);

    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    expect(current?.check?.crit).toEqual({ onFaces: [12], effect: 'doubleDice' });
  });

  it('builds a fireball with a mean of 21.5875', () => {
    startCheckRow();

    commit(screen.getByLabelText('Check modifier'), 3);
    commit(screen.getByLabelText('Success threshold'), 15);
    commit(effectDieControl('Count'), 8);
    fireEvent.click(screen.getByRole('button', { name: 'Effect on a success: Half' }));
    fireEvent.click(screen.getByRole('button', { name: 'Effect on a failure: Full' }));

    expect(mean(dist())).toBeCloseTo(21.5875, 8);
  });

  it('gives the fireball a spread of 8.1083', () => {
    startCheckRow();

    commit(screen.getByLabelText('Check modifier'), 3);
    commit(screen.getByLabelText('Success threshold'), 15);
    commit(effectDieControl('Count'), 8);
    fireEvent.click(screen.getByRole('button', { name: 'Effect on a success: Half' }));
    fireEvent.click(screen.getByRole('button', { name: 'Effect on a failure: Full' }));

    expect(stddev(dist())).toBeCloseTo(8.1083, 4);
  });

  it('lets the fireball land anywhere from 4 to 48', () => {
    startCheckRow();

    commit(screen.getByLabelText('Check modifier'), 3);
    commit(screen.getByLabelText('Success threshold'), 15);
    commit(effectDieControl('Count'), 8);
    fireEvent.click(screen.getByRole('button', { name: 'Effect on a success: Half' }));
    fireEvent.click(screen.getByRole('button', { name: 'Effect on a failure: Full' }));

    expect(min(dist())).toBe(4);
    expect(max(dist())).toBe(48);
  });
});

describe('CheckEditor panels', () => {
  it('renders the Check panel only for a check row', () => {
    startCheckRow();
    expect(editor().getByText('Check')).toBeInTheDocument();
  });

  it('renders the Effect panel only for a check row', () => {
    startCheckRow();
    expect(editor().getByText('Effect')).toBeInTheDocument();
  });

  it('renders the Outcomes panel only for a check row', () => {
    startCheckRow();
    expect(editor().getByText('Outcomes')).toBeInTheDocument();
  });

  it('renders none of the three panels for a sum row', () => {
    startSumRow();
    expect(editor().queryByText('Check')).not.toBeInTheDocument();
    expect(editor().queryByText('Effect')).not.toBeInTheDocument();
    expect(editor().queryByText('Outcomes')).not.toBeInTheDocument();
  });

  it('replaces the plain dice-parts panel when the row becomes a check', () => {
    startSumRow();
    expect(editor().getByText('Dice parts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(editor().queryByText('Dice parts')).not.toBeInTheDocument();
  });

  it('summarises the outcomes in the strip at the foot of the editor', () => {
    startCheckRow();
    expect(
      screen.getByText(
        'Succeeds 55% of the time. On a success: full. On a failure: nothing.',
      ),
    ).toBeInTheDocument();
  });

  it('names the critical in the summary strip once one is set', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    expect(
      screen.getByText(
        'Succeeds 55% of the time, crits 5%. On a success: full. On a failure: nothing.',
      ),
    ).toBeInTheDocument();
  });
});

describe('CheckEditor effect scale controls', () => {
  it('starts a success on the full effect', () => {
    startCheckRow();
    expect(
      screen.getByRole('button', { name: 'Effect on a success: Full' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks Half pressed once it is chosen', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Effect on a success: Half' }));

    expect(
      screen.getByRole('button', { name: 'Effect on a success: Half' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('unmarks Full once Half is chosen', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Effect on a success: Half' }));

    expect(
      screen.getByRole('button', { name: 'Effect on a success: Full' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('leaves Nothing unpressed once Half is chosen', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Effect on a success: Half' }));

    expect(
      screen.getByRole('button', { name: 'Effect on a success: Nothing' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks a failure scale pressed once it is chosen', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Effect on a failure: Full' }));

    expect(
      screen.getByRole('button', { name: 'Effect on a failure: Full' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(current?.check?.onFailure).toBe('full');
  });

  it('leaves the failure group alone when the success scale changes', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Effect on a success: Half' }));

    expect(
      screen.getByRole('button', { name: 'Effect on a failure: Nothing' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(current?.check?.onFailure).toBe('none');
  });

  it('collapses a check to a flat zero when neither outcome does anything', () => {
    startCheckRow();
    fireEvent.click(
      screen.getByRole('button', { name: 'Effect on a success: Nothing' }),
    );

    expect(min(dist())).toBe(0);
    expect(max(dist())).toBe(0);
    expect(mean(dist())).toBeCloseTo(0, 12);
  });
});

describe('CheckEditor critical rule', () => {
  it('offers the Critical toggle when the check rolls one die', () => {
    startCheckRow();
    expect(screen.getByRole('button', { name: 'Critical' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('drops the Critical toggle when the check rolls more than one die', () => {
    startCheckRow();
    commit(checkDieControl('Count'), 2);

    expect(screen.queryByRole('button', { name: 'Critical' })).not.toBeInTheDocument();
  });

  it('keeps the Critical card and explains why it is unavailable', () => {
    startCheckRow();
    commit(checkDieControl('Count'), 2);

    expect(editor().getByText('Critical')).toBeInTheDocument();
    expect(
      screen.getByText(/needs a check of exactly one die/),
    ).toBeInTheDocument();
  });

  it('turns an existing critical off when the check grows past one die', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));
    expect(current?.check?.crit).toBeDefined();

    commit(checkDieControl('Count'), 2);

    expect(current?.check?.crit).toBeUndefined();
  });

  it('turns the whole rule off when the last critical face is cleared', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    fireEvent.click(screen.getByRole('button', { name: 'Face 20' }));

    expect(current?.check?.crit).toBeUndefined();
  });

  it('unpresses the Critical toggle when the last face is cleared', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    fireEvent.click(screen.getByRole('button', { name: 'Face 20' }));

    expect(screen.getByRole('button', { name: 'Critical' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByRole('button', { name: 'Face 20' })).not.toBeInTheDocument();
  });

  it('keeps the rule alive when one of two critical faces is cleared', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));
    fireEvent.click(screen.getByRole('button', { name: 'Face 19' }));

    fireEvent.click(screen.getByRole('button', { name: 'Face 20' }));

    expect(current?.check?.crit).toEqual({ onFaces: [19], effect: 'doubleDice' });
  });

  it('changes what a critical does without touching its faces', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    fireEvent.change(
      screen.getByRole('combobox', { name: 'What a critical does' }),
      { target: { value: 'extraDie' } },
    );

    expect(current?.check?.crit).toEqual({ onFaces: [20], effect: 'extraDie' });
  });

  // A 2d6 effect is the smallest one where doubling the dice and adding a die
  // part company, and a bar of 21 leaves the critical as the only branch that
  // pays out, so the mean is the crit arm on its own.
  it('rolls double the dice on a critical', () => {
    startCheckRow();
    commit(effectDieControl('Count'), 2);
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));
    commit(screen.getByLabelText('Success threshold'), 21);

    expect(max(dist())).toBe(24);
    expect(mean(dist())).toBeCloseTo(0.7, 10);
  });

  it('rolls one extra die on a critical once that rule is chosen', () => {
    startCheckRow();
    commit(effectDieControl('Count'), 2);
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));
    commit(screen.getByLabelText('Success threshold'), 21);

    fireEvent.change(
      screen.getByRole('combobox', { name: 'What a critical does' }),
      { target: { value: 'extraDie' } },
    );

    expect(max(dist())).toBe(18);
    expect(mean(dist())).toBeCloseTo(0.525, 10);
  });
});

describe('CheckEditor dice rows', () => {
  it('renders a dice row for the check die and one for the effect part', () => {
    startCheckRow();
    expect(screen.getAllByLabelText('Count')).toHaveLength(2);
  });

  it('disables both remove buttons while each list holds a single part', () => {
    startCheckRow();
    const removeButtons = screen.getAllByRole('button', { name: 'Remove part' });
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]).toBeDisabled();
    expect(removeButtons[1]).toBeDisabled();
  });

  it('enables removing once a second effect part is added', () => {
    startCheckRow();
    addEffectPart();

    // The check die's button stays disabled; both effect parts can go.
    const removeButtons = screen.getAllByRole('button', { name: 'Remove part' });
    expect(removeButtons).toHaveLength(3);
    expect(removeButtons[0]).toBeDisabled();
    expect(removeButtons[1]).toBeEnabled();
    expect(removeButtons[2]).toBeEnabled();
  });

  it('adds the second effect part as a d6', () => {
    startCheckRow();
    addEffectPart();

    expect(current?.check?.effect.parts).toHaveLength(2);
    expect(current?.check?.effect.parts[1]).toMatchObject({ count: 1, sides: 6 });
  });

  it('drops back to one effect part when a part is removed', () => {
    startCheckRow();
    addEffectPart();

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove part' })[2]!);

    expect(current?.check?.effect.parts).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: 'Remove part' })[1],
    ).toBeDisabled();
  });

  it('edits the check die without touching the effect die', () => {
    startCheckRow();

    commit(checkDieControl('Count'), 3);

    expect(current?.parts[0]).toMatchObject({ count: 3, sides: 20 });
    expect(current?.check?.effect.parts[0]).toMatchObject({ count: 1, sides: 6 });
  });
});

describe('CheckEditor multi-part check roll', () => {
  it('adds a second check part as a d20', () => {
    startCheckRow();
    addCheckPart();

    expect(current?.parts).toHaveLength(2);
    expect(current?.parts[1]).toMatchObject({ count: 1, sides: 20 });
  });

  it('shows a dice row for every check part', () => {
    startCheckRow();
    addCheckPart();

    // Two check parts plus the effect part.
    expect(screen.getAllByLabelText('Count')).toHaveLength(3);
  });

  it('edits the second check part through its own row', () => {
    startCheckRow();
    addCheckPart();

    commit(screen.getAllByLabelText('Count')[1]!, 3);

    expect(current?.parts[1]).toMatchObject({ count: 3, sides: 20 });
    expect(current?.parts[0]).toMatchObject({ count: 1, sides: 20 });
  });

  it('removes an extra check part through its own row', () => {
    startCheckRow();
    addCheckPart();

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove part' })[1]!);

    expect(current?.parts).toHaveLength(1);
  });

  it('restores the Critical toggle once the extra check part is removed', () => {
    startCheckRow();
    addCheckPart();
    expect(screen.queryByRole('button', { name: 'Critical' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove part' })[1]!);

    expect(screen.getByRole('button', { name: 'Critical' })).toBeInTheDocument();
  });
});

// The stepper commits typed input through the same [min, max] its buttons
// respect; an unclamped commit would persist a value the schema validator
// rejects, and one rejected row drops the user's whole saved table on reload.
describe('CheckEditor stepper clamping', () => {
  it('clamps a typed 0 in the Succeeds when field up to 1', () => {
    startCheckRow();
    const input = screen.getByLabelText('Success threshold');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('1');
    expect(current?.check?.threshold.value).toBe(1);
  });

  it('clamps a cleared Succeeds when field up to 1', () => {
    startCheckRow();
    const input = screen.getByLabelText('Success threshold');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('1');
    expect(current?.check?.threshold.value).toBe(1);
  });

  it('clamps garbage in a count field up to 1', () => {
    startCheckRow();
    const input = checkDieControl('Count');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('1');
    expect(current?.parts[0]?.count).toBe(1);
  });
});

describe('CheckEditor keep across the effect parts', () => {
  it('clears a per-part keep when keeping across parts is turned on', () => {
    startCheckRow();
    commit(effectDieControl('Count'), 3);
    // The check die carries its own Keep chip, so the effect's is the second.
    fireEvent.click(screen.getAllByRole('button', { name: 'Keep' })[1]!);
    expect(current?.check?.effect.parts[0]?.keep).toEqual({ type: 'highest', n: 2 });

    fireEvent.click(screen.getByRole('button', { name: 'Keep across parts' }));

    // Named rather than `.every`, which passes on an empty parts list.
    expect(current?.check?.effect.parts).toHaveLength(1);
    expect(current?.check?.effect.parts[0]?.keep).toBeUndefined();
  });

  it('keeps one fewer than every effect die when the rule is turned on', () => {
    startCheckRow();
    commit(effectDieControl('Count'), 3);

    fireEvent.click(screen.getByRole('button', { name: 'Keep across parts' }));

    expect(current?.check?.effect.keepAcross).toEqual({ type: 'highest', n: 2 });
  });

  it('blocks the per-part Keep chip while the effect keeps across parts', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Keep across parts' }));

    const effectKeep = screen.getAllByRole('button', { name: 'Keep' })[1]!;
    expect(effectKeep).toHaveAttribute('aria-disabled', 'true');
    expect(effectKeep).toHaveAttribute('aria-pressed', 'false');
  });

  it('ignores a press on the blocked per-part Keep chip', () => {
    startCheckRow();
    commit(effectDieControl('Count'), 3);
    fireEvent.click(screen.getByRole('button', { name: 'Keep across parts' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Keep' })[1]!);

    // The chip is only aria-disabled, so nothing but the handler's own guard
    // stops the press from replacing the across-parts rule.
    expect(current?.check?.effect.keepAcross).toEqual({ type: 'highest', n: 2 });
    expect(current?.check?.effect.parts[0]?.keep).toBeUndefined();
  });

  it('leaves the check die alone when the effect keeps across parts', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Keep across parts' }));

    expect(current?.keepAcross).toBeUndefined();
    // Still live, not merely missing an aria-disabled attribute.
    fireEvent.click(screen.getAllByRole('button', { name: 'Keep' })[0]!);
    expect(current?.parts[0]?.keep).toEqual({ type: 'highest', n: 1 });
  });

  it('keeps the best 2 of 3 effect dice in the resulting numbers', () => {
    startCheckRow();
    commit(effectDieControl('Count'), 3);
    // Always succeed so the mixture is the effect on its own: 3d6 keep highest 2.
    commit(screen.getByLabelText('Success threshold'), 1);

    fireEvent.click(screen.getByRole('button', { name: 'Keep across parts' }));

    expect(min(dist())).toBe(2);
    expect(max(dist())).toBe(12);
    expect(mean(dist())).toBeCloseTo(8.4583333333, 8);
  });

  it('turns the rule back off when the chip is pressed again', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Keep across parts' }));
    expect(current?.check?.effect.keepAcross).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Keep across parts' }));

    expect(current?.check?.effect.keepAcross).toBeUndefined();
  });
});

describe('CheckEditor success readout', () => {
  it('starts at 55% for a plain d20 needing 10 or better', () => {
    startCheckRow();
    expect(screen.getByText('55%')).toBeInTheDocument();
  });

  it('updates when the threshold changes', () => {
    startCheckRow();

    commit(screen.getByLabelText('Success threshold'), 15);

    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.queryByText('55%')).not.toBeInTheDocument();
  });

  it('updates when the modifier changes', () => {
    startCheckRow();

    commit(screen.getByLabelText('Check modifier'), 5);

    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('updates when the direction flips to at most', () => {
    startCheckRow();

    fireEvent.change(screen.getByRole('combobox', { name: 'Success direction' }), {
      target: { value: 'lte' },
    });

    expect(current?.check?.threshold).toEqual({ direction: 'lte', value: 10 });
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('reads 100% when the bar is at the bottom of the die', () => {
    startCheckRow();

    commit(screen.getByLabelText('Success threshold'), 1);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('reads 0% when the bar is out of reach', () => {
    startCheckRow();

    commit(screen.getByLabelText('Success threshold'), 21);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('counts a critical face as a success even when the bar is out of reach', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    commit(screen.getByLabelText('Success threshold'), 21);

    expect(screen.getByText('5%')).toBeInTheDocument();
  });
});
