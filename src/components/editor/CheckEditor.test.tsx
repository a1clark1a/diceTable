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

function setDirection(direction: 'gte' | 'lte') {
  fireEvent.change(screen.getByLabelText('Success direction'), {
    target: { value: direction },
  });
}

// Reads the rule off the rendered picker, which is the only place the user can
// see which face the seed landed on.
function pressedCritFaces(): number[] {
  const group = within(screen.getByRole('group', { name: 'Critical faces' }));
  return group
    .getAllByRole('button', { pressed: true })
    .map((b) => Number((b.getAttribute('aria-label') ?? '').slice('Face '.length)));
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

  it('shows the seeded critical face pressed in the face picker', () => {
    startCheckRow();
    fireEvent.click(screen.getAllByRole('button', { name: 'd12' })[0]!);

    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    expect(pressedCritFaces()).toEqual([12]);
  });

  it('seeds the critical on the bottom face when the check succeeds at most the threshold', () => {
    startCheckRow();
    setDirection('lte');

    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    expect(pressedCritFaces()).toEqual([1]);
  });

  // A critical face succeeds without being threshold-tested, so seeding the top
  // face of a roll-under check would hand the automatic success to the worst
  // roll the die can make.
  it('seeds the bottom face of a roll-under check rather than the die top', () => {
    startCheckRow();
    fireEvent.click(screen.getAllByRole('button', { name: 'd12' })[0]!);
    setDirection('lte');

    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    expect(pressedCritFaces()).toEqual([1]);
    expect(pressedCritFaces()).not.toContain(12);
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

// Typed-garbage clamping on the threshold and count steppers of a check row is
// covered by the battery in controls.stress.test.tsx, which also re-validates
// the persisted envelope after every commit.

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

// The Check modifier is the one stepper on this row with a negative floor; a
// wrong floor (0, or none) would either block penalties or persist a value the
// schema validator rejects, wiping the table on reload.
describe('CheckEditor check modifier floor', () => {
  it('clamps a typed -100 up to the floor of -99', () => {
    startCheckRow();
    const input = screen.getByLabelText('Check modifier');
    fireEvent.change(input, { target: { value: '-100' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input).toHaveValue('-99');
    expect(current?.flatModifier).toBe(-99);
  });

  it('reads 0% once the penalty puts the bar out of reach', () => {
    startCheckRow();
    const input = screen.getByLabelText('Check modifier');
    fireEvent.change(input, { target: { value: '-100' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // The best the die can do is 20 - 99 = -79, well short of 10.
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText('55%')).not.toBeInTheDocument();
  });
});

describe('CheckEditor critical odds line', () => {
  it('reflects every selected face in the Crits on line', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));
    fireEvent.click(screen.getByRole('button', { name: 'Face 19' }));

    // Two faces of twenty: 2/20 = 10%.
    expect(current?.check?.crit?.onFaces).toEqual([19, 20]);
    expect(screen.getByText('Crits on 10% of rolls.')).toBeInTheDocument();
  });

  it('folds both critical faces into the summary strip', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));
    fireEvent.click(screen.getByRole('button', { name: 'Face 19' }));

    // Faces 10 to 18 succeed plainly (9/20) and 19, 20 crit (2/20): 11/20.
    expect(
      screen.getByText(
        'Succeeds 55% of the time, crits 10%. On a success: full. On a failure: nothing.',
      ),
    ).toBeInTheDocument();
  });
});

// A d100 has too many faces for the picker, so seeding on the top face is the
// only way a percentile check ever gets its critical.
describe('CheckEditor critical on a d100 check die', () => {
  it('seeds the critical on face 100', () => {
    startCheckRow();
    fireEvent.click(screen.getAllByRole('button', { name: 'd100' })[0]!);

    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    expect(current?.check?.crit).toEqual({ onFaces: [100], effect: 'doubleDice' });
  });

  it('replaces the face grid with the too-many-faces message', () => {
    startCheckRow();
    fireEvent.click(screen.getAllByRole('button', { name: 'd100' })[0]!);

    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    expect(
      screen.getByText(
        'd100 has too many faces to list here. Pick a die with 30 sides or fewer.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Face 100' })).not.toBeInTheDocument();
  });

  it('reads the critical as 1% and the check as 91%', () => {
    startCheckRow();
    fireEvent.click(screen.getAllByRole('button', { name: 'd100' })[0]!);

    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    // Faces 10 to 99 succeed plainly (90/100) and face 100 crits (1/100).
    expect(screen.getByText('Crits on 1% of rolls.')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
  });
});

// The odds are dropped, not zeroed, when the effect is too heavy to enumerate;
// a confident 0% on a row whose math never ran is the trust break the
// full-convolution rule exists to prevent.
describe('CheckEditor when the effect is too complex', () => {
  function makeTooComplex() {
    startCheckRow();
    // A hundred d100s land on 9,901 totals, whose square is past the guard. The
    // check die carries its own controls, so the effect's are the second.
    fireEvent.click(screen.getAllByRole('button', { name: 'd100' })[1]!);
    commit(effectDieControl('Count'), 100);
  }

  it('says the odds are too complex instead of claiming a percentage', () => {
    makeTooComplex();
    expect(screen.getByText('(too complex)')).toBeInTheDocument();
    expect(screen.queryByText('55%')).not.toBeInTheDocument();
  });

  it('says so in the summary strip as well', () => {
    makeTooComplex();
    expect(
      screen.getByText(
        'Too complex to compute the odds. On a success: full. On a failure: nothing.',
      ),
    ).toBeInTheDocument();
  });
});

// The editor promises that advantage and disadvantage apply to the check roll
// and not to the effect; the mean is what tells those two apart.
describe('CheckEditor roll mode on the check', () => {
  it('reads a tiny but real chance as <1% rather than 0% under disadvantage', () => {
    startCheckRow();
    fireEvent.click(screen.getAllByRole('button', { name: 'd100' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Disadvantage' }));
    commit(screen.getByLabelText('Success threshold'), 100);

    // Both draws must show 100: (1/100)^2 = 0.0001.
    expect(screen.getByText('<1%')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Succeeds <1% of the time. On a success: full. On a failure: nothing.',
      ),
    ).toBeInTheDocument();
  });

  it('weights the effect by the disadvantaged odds', () => {
    startCheckRow();
    fireEvent.click(screen.getAllByRole('button', { name: 'd100' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Disadvantage' }));
    commit(screen.getByLabelText('Success threshold'), 100);

    // 0.0001 of the time a d6 lands (mean 3.5): 0.00035.
    expect(mean(dist())).toBeCloseTo(0.00035, 12);
  });

  it('raises the check odds under advantage', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Advantage' }));

    // A single d20 misses 10 on 9/20 = 0.45; two tries miss on 0.45^2 = 0.2025,
    // so 79.75% succeeds and rounds to 80%.
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('leaves the effect dice untouched by advantage', () => {
    startCheckRow();
    fireEvent.click(screen.getByRole('button', { name: 'Advantage' }));

    // 0.7975 * 3.5 = 2.79125. Had advantage leaked into the d6 its mean would
    // be 4.4722, not 3.5, and the row would read 3.5666.
    expect(mean(dist())).toBeCloseTo(2.79125, 12);
    expect(max(dist())).toBe(6);
  });
});

describe('CheckEditor critical adding the highest the dice can show', () => {
  it('stores the max-plus-roll rule without touching the faces', () => {
    startCheckRow();
    commit(effectDieControl('Count'), 2);
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));

    fireEvent.change(
      screen.getByRole('combobox', { name: 'What a critical does' }),
      { target: { value: 'maxPlusRoll' } },
    );

    expect(current?.check?.crit).toEqual({ onFaces: [20], effect: 'maxPlusRoll' });
  });

  // With the bar at 21 only the critical face pays out, so the mean is the crit
  // arm alone: 2d6 shifted by its own maximum of 12 has mean 19, and 1/20 of
  // 19 is 0.95. Double dice would give 0.7 and an extra die 0.525.
  it('pays the maximum plus a fresh roll on a critical', () => {
    startCheckRow();
    commit(effectDieControl('Count'), 2);
    fireEvent.click(screen.getByRole('button', { name: 'Critical' }));
    commit(screen.getByLabelText('Success threshold'), 21);

    fireEvent.change(
      screen.getByRole('combobox', { name: 'What a critical does' }),
      { target: { value: 'maxPlusRoll' } },
    );

    expect(max(dist())).toBe(24);
    expect(mean(dist())).toBeCloseTo(0.95, 12);
  });
});
