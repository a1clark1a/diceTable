import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { RollHistoryProvider } from '../../state/RollHistoryContext';
import { SCHEMA_VERSION } from '../../state/persistedSchema';
import { RollsTable } from '../RollsTable';
import type { Expression, ModStep, PersistedState } from '../../types';

// Hand-computed fixtures. 2d6 totals 2..12 with weights 1,2,3,4,5,6,5,4,3,2,1
// over 36, so its mean is 7.
//   [+3]          → 7 + 3            = 10
//   [+3, ×2]      → (7 + 3) × 2      = 20
//   [×2, +3]      → 7 × 2 + 3        = 17
//   [×2]          → 7 × 2            = 14
//   [×3]          → 7 × 3            = 21
//   [+5, ×2]      → (7 + 5) × 2      = 24
//   [+3, ÷2]      → floor((s + 3) / 2) over s = 2..12 is 2,3,3,4,4,5,5,6,6,7,7;
//                   weighted 2+6+9+16+20+30+25+24+18+14+7 = 171, / 36 = 4.75
//   [+3, ÷3]      → floor((s + 3) / 3) is 1,2,2,2,3,3,3,4,4,4,5;
//                   weighted 1+4+6+8+15+18+15+16+12+8+5 = 108, / 36 = 3

const SUM_ROW_NAME = 'Hit';

function sumRow(mods?: ModStep[]): Expression {
  return {
    id: 'hit',
    name: SUM_ROW_NAME,
    parts: [{ id: 'hit-part', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
    ...(mods ? { mods } : {}),
  };
}

function poolRow(mods: ModStep[]): Expression {
  return {
    id: 'pool',
    name: 'Pool',
    parts: [{ id: 'pool-part', count: 6, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 4 },
    mods,
  };
}

const longswordCheck: Expression = {
  id: 'check-row',
  name: 'Longsword',
  parts: [{ id: 'check-part', count: 1, sides: 20 }],
  flatModifier: 7,
  rollMode: 'normal',
  mode: 'check',
  check: {
    threshold: { direction: 'gte', value: 15 },
    effect: { parts: [{ id: 'effect-part', count: 1, sides: 8 }], flatModifier: 4 },
    onSuccess: 'full',
    onFailure: 'none',
  },
};

/** Saves a one-row table with that row's editor open, as a reload would find it. */
function seedExpanded(row: Expression) {
  const state: PersistedState = {
    version: SCHEMA_VERSION,
    expressions: [row],
    ui: {
      expandedId: row.id,
      chartViews: { totals: 'pmf', successes: 'pmf', shape: 'pmf' },
      target: { values: [], ruling: 'gte' },
      view: 'table',
      poolTargets: [1],
      baselineId: null,
      targetSubView: 'grid',
      targetFilter: 'all',
      targetSort: null,
      rollOffSort: 'win',
    },
  };
  window.localStorage.setItem('dicetable.v2', JSON.stringify({ version: 2, value: state }));
}

function renderTable() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <RollHistoryProvider>
          <RollsTable />
        </RollHistoryProvider>
      </AppProvider>
    </ChakraProvider>,
  );
}

function meanText(name = SUM_ROW_NAME): string | null {
  return screen.getByRole('button', { name: `Inspect mean for ${name}` }).textContent;
}

function formulaText(name = SUM_ROW_NAME): string | null {
  return screen.getByRole('button', { name: `Inspect distribution for ${name}` }).textContent;
}

function stepLabels(): (string | null)[] {
  return screen
    .queryAllByRole('group', { name: /^Step \d of \d:/ })
    .map((group) => group.getAttribute('aria-label'));
}

function stepGroup(n: number): HTMLElement {
  return screen.getByRole('group', { name: new RegExp(`^Step ${n} of \\d:`) });
}

const addStep = () => screen.getByRole('button', { name: 'Add a step' });

function typeAndEnter(field: HTMLElement, raw: string) {
  fireEvent.change(field, { target: { value: raw } });
  fireEvent.keyDown(field, { key: 'Enter' });
}

const DIVIDE_BY_ZERO = 'Can’t divide by 0. This step still divides by 2.';

afterEach(() => {
  window.localStorage.clear();
});

describe('ModChainEditor steps', () => {
  it('labels each step group with its position and what it does', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    expect(stepLabels()).toEqual(['Step 1 of 2: plus 3', 'Step 2 of 2: times 2']);
  });

  it('names each step’s number by what it does to the total', () => {
    seedExpanded(
      sumRow([
        { op: 'add', value: 3 },
        { op: 'mul', value: 2 },
        { op: 'div', value: 2 },
      ]),
    );
    renderTable();
    expect(screen.getByRole('textbox', { name: 'Step 1 amount' })).toHaveValue('3');
    expect(screen.getByRole('textbox', { name: 'Step 2 multiplier' })).toHaveValue('2');
    expect(screen.getByRole('textbox', { name: 'Step 3 divisor' })).toHaveValue('2');
  });

  it('editing a step’s amount recomputes the row', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    const amount = screen.getByRole('textbox', { name: 'Step 1 amount' });
    fireEvent.change(amount, { target: { value: '5' } });
    fireEvent.blur(amount);
    expect(meanText()).toBe('24.00');
  });
});

describe('ModChainEditor adding a step', () => {
  it('appends a times 2 step after the existing ones', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }]));
    renderTable();
    fireEvent.click(addStep());
    expect(stepLabels()).toEqual(['Step 1 of 2: plus 3', 'Step 2 of 2: times 2']);
  });

  it('brackets the total so far in the formula when the new step multiplies', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }]));
    renderTable();
    fireEvent.click(addStep());
    expect(formulaText()).toBe('(2d6 + 3) × 2');
  });

  it('doubles the row’s mean from 10 to 20', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }]));
    renderTable();
    expect(meanText()).toBe('10.00');
    fireEvent.click(addStep());
    expect(meanText()).toBe('20.00');
  });

  it('starts a chain on a row that has none', () => {
    seedExpanded(sumRow());
    renderTable();
    fireEvent.click(addStep());
    expect(stepLabels()).toEqual(['Step 1 of 1: times 2']);
    expect(meanText()).toBe('14.00');
  });

  it('moves focus to the new step’s operation', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }]));
    renderTable();
    fireEvent.click(addStep());
    expect(screen.getByRole('combobox', { name: 'Step 2 operation' })).toHaveFocus();
  });

  it('blocks Add a step at three steps rather than hiding it', () => {
    seedExpanded(
      sumRow([
        { op: 'add', value: 3 },
        { op: 'mul', value: 2 },
        { op: 'div', value: 2 },
      ]),
    );
    renderTable();
    expect(addStep()).toHaveAttribute('aria-disabled', 'true');
  });

  it('adds nothing when the blocked Add a step is clicked at three steps', () => {
    seedExpanded(
      sumRow([
        { op: 'add', value: 3 },
        { op: 'mul', value: 2 },
        { op: 'div', value: 2 },
      ]),
    );
    renderTable();
    fireEvent.click(addStep());
    expect(stepLabels()).toHaveLength(3);
    expect(screen.queryByRole('combobox', { name: 'Step 4 operation' })).not.toBeInTheDocument();
  });
});

describe('ModChainEditor changing a step’s operation', () => {
  it('says a divide rounds down', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    expect(screen.queryByText('rounds down')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Step 2 operation' }), {
      target: { value: 'div' },
    });
    expect(within(stepGroup(2)).getByText('rounds down')).toBeInTheDocument();
  });

  it('rounds the row down after switching a step to divide', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    fireEvent.change(screen.getByRole('combobox', { name: 'Step 2 operation' }), {
      target: { value: 'div' },
    });
    expect(meanText()).toBe('4.75');
  });

  it('keeps the step’s number when it fits the new operation', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }]));
    renderTable();
    fireEvent.change(screen.getByRole('combobox', { name: 'Step 1 operation' }), {
      target: { value: 'mul' },
    });
    expect(formulaText()).toBe('2d6 × 3');
    expect(meanText()).toBe('21.00');
  });

  // A multiply by 0 is a step the validator refuses, and one refused row drops
  // the whole saved table on the next load.
  it('starts a multiplier at 2 when the step was adding 0', () => {
    seedExpanded(sumRow([{ op: 'add', value: 0 }]));
    renderTable();
    fireEvent.change(screen.getByRole('combobox', { name: 'Step 1 operation' }), {
      target: { value: 'mul' },
    });
    expect(screen.getByRole('textbox', { name: 'Step 1 multiplier' })).toHaveValue('2');
    expect(meanText()).toBe('14.00');
  });
});

describe('ModChainEditor reordering steps', () => {
  it('moves step 2 ahead of step 1', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Move step 2 earlier' }));
    expect(stepLabels()).toEqual(['Step 1 of 2: times 2', 'Step 2 of 2: plus 3']);
  });

  it('recomputes the mean in the new order, 20 becoming 17', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    expect(meanText()).toBe('20.00');
    fireEvent.click(screen.getByRole('button', { name: 'Move step 2 earlier' }));
    expect(meanText()).toBe('17.00');
  });

  it('drops the brackets once the multiply comes first', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Move step 2 earlier' }));
    expect(formulaText()).toBe('2d6 × 2 + 3');
  });

  it('blocks moving the step that just reached the top any earlier', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Move step 2 earlier' }));
    expect(screen.getByRole('button', { name: 'Move step 1 earlier' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('keeps focus on the arrow that moved the step', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Move step 2 earlier' }));
    expect(screen.getByRole('button', { name: 'Move step 1 earlier' })).toHaveFocus();
  });

  it('leaves the chain alone when the last step is moved later', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    const later = screen.getByRole('button', { name: 'Move step 2 later' });
    expect(later).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(later);
    expect(stepLabels()).toEqual(['Step 1 of 2: plus 3', 'Step 2 of 2: times 2']);
  });
});

describe('ModChainEditor removing a step', () => {
  it('removes the chosen step and renumbers the rest', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Remove step 1' }));
    expect(stepLabels()).toEqual(['Step 1 of 1: times 2']);
    expect(meanText()).toBe('14.00');
  });

  it('leaves the bare dice when the only step is removed', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }]));
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Remove step 1' }));
    expect(stepLabels()).toEqual([]);
    expect(formulaText()).toBe('2d6');
    expect(meanText()).toBe('7.00');
  });

  it('moves focus to Add a step', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Remove step 2' }));
    expect(addStep()).toHaveFocus();
  });
});

describe('ModChainEditor refusing a divisor of 0', () => {
  function refuseZeroDivisor() {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'div', value: 2 }]));
    renderTable();
    typeAndEnter(screen.getByRole('textbox', { name: 'Step 2 divisor' }), '0');
  }

  // The field remounts on a refusal, so every check queries it afresh.
  const divisor = () => screen.getByRole('textbox', { name: 'Step 2 divisor' });

  it('says what was refused and what the step still does', () => {
    refuseZeroDivisor();
    expect(within(stepGroup(2)).getByText(DIVIDE_BY_ZERO)).toBeInTheDocument();
  });

  it('marks the field invalid and ties the message to it', () => {
    refuseZeroDivisor();
    expect(divisor()).toHaveAttribute('aria-invalid', 'true');
    expect(divisor()).toHaveAccessibleDescription(DIVIDE_BY_ZERO);
  });

  it('keeps the row’s numbers instead of blanking them', () => {
    refuseZeroDivisor();
    expect(meanText()).toBe('4.75');
    expect(formulaText()).toBe('(2d6 + 3) ÷ 2');
  });

  it('puts the kept divisor back in the field', () => {
    refuseZeroDivisor();
    expect(divisor()).toHaveValue('2');
  });

  // Enter blurs the field, so its description would not be read until focus
  // came back; the status line is what says it at once.
  it('announces the refusal in the status line', () => {
    refuseZeroDivisor();
    const said = screen.getAllByRole('status').map((s) => s.textContent);
    expect(said).toContain(DIVIDE_BY_ZERO);
  });

  it('clears the message once a valid divisor is typed', () => {
    refuseZeroDivisor();
    typeAndEnter(divisor(), '3');
    expect(divisor()).not.toHaveAttribute('aria-invalid');
    expect(divisor()).not.toHaveAccessibleDescription();
    expect(within(stepGroup(2)).queryByText(DIVIDE_BY_ZERO)).not.toBeInTheDocument();
  });

  it('applies the valid divisor typed after a refusal', () => {
    refuseZeroDivisor();
    typeAndEnter(divisor(), '3');
    expect(meanText()).toBe('3.00');
  });
});

describe('ModChainEditor refusing a multiplier of 0', () => {
  it('says the step still multiplies by its kept number', () => {
    seedExpanded(sumRow([{ op: 'add', value: 3 }, { op: 'mul', value: 2 }]));
    renderTable();
    typeAndEnter(screen.getByRole('textbox', { name: 'Step 2 multiplier' }), '0');
    expect(
      within(stepGroup(2)).getByText('Can’t multiply by 0. This step still multiplies by 2.'),
    ).toBeInTheDocument();
    expect(meanText()).toBe('20.00');
  });
});

describe('ModChainEditor on a pool row', () => {
  it('says an add step adds successes', () => {
    seedExpanded(poolRow([{ op: 'add', value: 2 }]));
    renderTable();
    const step = screen.getByRole('group', { name: 'Step 1 of 1: plus 2 automatic successes' });
    expect(within(step).getByText('successes')).toBeInTheDocument();
  });

  it('does not call a multiply successes', () => {
    seedExpanded(poolRow([{ op: 'mul', value: 2 }]));
    renderTable();
    const step = screen.getByRole('group', { name: 'Step 1 of 1: times 2' });
    expect(within(step).queryByText('successes')).not.toBeInTheDocument();
  });

  it('offers the same four operations as a sum row', () => {
    seedExpanded(poolRow([{ op: 'add', value: 2 }]));
    renderTable();
    const options = within(screen.getByRole('combobox', { name: 'Step 1 operation' }))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['+ Add', '− Subtract', '× Multiply', '÷ Divide']);
  });
});

describe('ModChainEditor on a check row', () => {
  it('shows Add a step blocked', () => {
    seedExpanded(longswordCheck);
    renderTable();
    expect(addStep()).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows no step controls', () => {
    seedExpanded(longswordCheck);
    renderTable();
    expect(stepLabels()).toEqual([]);
    expect(screen.queryByRole('combobox', { name: /^Step \d operation$/ })).not.toBeInTheDocument();
  });

  it('adds no step when the blocked button is clicked', () => {
    seedExpanded(longswordCheck);
    renderTable();
    fireEvent.click(addStep());
    expect(stepLabels()).toEqual([]);
  });
});
