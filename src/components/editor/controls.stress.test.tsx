import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { useApp } from '../../state/useApp';
import {
  SCHEMA_VERSION,
  validatePersistedState,
} from '../../state/persistedSchema';
import { RollExpand } from '../RollExpand';
import type { PersistedState } from '../../types';

// The table-wipe invariant, driven from the keyboard: no string a user can type
// into a stepper may commit a value outside the field's bounds, because an
// out-of-range value in the persisted envelope makes the validator drop the
// whole saved table on the next load. Each battery types the same garbage into
// a different stepper and checks the display, the committed state, and the
// validator after every single commit.

interface Snapshot {
  state: PersistedState | null;
}

function Harness({ onState }: { onState: (state: PersistedState) => void }) {
  const app = useApp();
  // Render must stay pure, so the snapshot is reported from an effect; it runs
  // after every committed state change, which is exactly when the validator
  // check needs a fresh copy.
  React.useEffect(() => {
    onState({
      version: SCHEMA_VERSION,
      expressions: app.expressions,
      ui: {
        expandedId: app.expandedId,
        chartViews: app.chartViews,
        target: app.target,
        view: app.view,
        poolTargets: app.poolTargets,
        baselineId: app.baselineId,
        targetSubView: app.targetSubView,
        targetFilter: app.targetFilter,
        targetSort: app.targetSort,
        rollOffSort: app.rollOffSort,
      },
    });
  });
  const expr = app.expressions[0];
  return expr ? <RollExpand expression={expr} /> : null;
}

function seedAndRender(expressions: unknown[]): Snapshot {
  const value = {
    version: SCHEMA_VERSION,
    expressions,
    ui: {
      expandedId: null,
      chartView: 'pmf',
      target: { values: [] as number[], ruling: 'gte' as const },
      view: 'table' as const,
      poolTargets: [1],
      baselineId: null,
    },
  };
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value }),
  );
  const snap: Snapshot = { state: null };
  render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <Harness
          onState={(state) => {
            snap.state = state;
          }}
        />
      </AppProvider>
    </ChakraProvider>,
  );
  return snap;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const GARBAGE = ['', 'abc', '0', '-3', '999999', ' 2 ', '3.9'] as const;

function runBattery(
  label: string,
  expected: readonly number[],
  snap: Snapshot,
  read: (state: PersistedState) => number | undefined,
): void {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  GARBAGE.forEach((typed, i) => {
    fireEvent.change(input, { target: { value: typed } });
    fireEvent.blur(input);
    const want = expected[i]!;
    const hint = `after typing ${JSON.stringify(typed)}`;
    expect(input.value, hint).toBe(String(want));
    expect(read(snap.state!), hint).toBe(want);
    const round = JSON.parse(JSON.stringify(snap.state)) as unknown;
    expect(validatePersistedState(round), hint).not.toBeNull();
  });
}

describe('NumberStepper garbage battery', () => {
  it('the check threshold commits inside [1, 999] for every garbage string and the state always re-validates', () => {
    const snap = seedAndRender([
      {
        id: 'e0',
        name: 'Check row',
        parts: [{ id: 'p0', count: 1, sides: 20 }],
        flatModifier: 0,
        rollMode: 'normal',
        mode: 'check',
        check: {
          threshold: { direction: 'gte', value: 10 },
          effect: { parts: [{ id: 'fx0', count: 1, sides: 6 }], flatModifier: 0 },
          onSuccess: 'full',
          onFailure: 'none',
        },
      },
    ]);
    runBattery(
      'Success threshold',
      [1, 1, 1, 1, 999, 2, 3],
      snap,
      (s) => s.expressions[0]?.check?.threshold.value,
    );
  });

  it('the keep-across count commits inside [1, dice] for every garbage string and the state always re-validates', () => {
    const snap = seedAndRender([
      {
        id: 'e0',
        name: 'Keep across row',
        parts: [
          { id: 'p0', count: 2, sides: 6 },
          { id: 'p1', count: 1, sides: 8 },
        ],
        flatModifier: 0,
        rollMode: 'normal',
        mode: 'sum',
        keepAcross: { type: 'highest', n: 2 },
      },
    ]);
    runBattery(
      'Dice to keep across parts',
      [1, 1, 1, 1, 3, 2, 3],
      snap,
      (s) => s.expressions[0]?.keepAcross?.n,
    );
  });

  it('the dice count commits at or above 1 for every garbage string and the state always re-validates', () => {
    const snap = seedAndRender([
      {
        id: 'e0',
        name: 'Sum row',
        parts: [{ id: 'p0', count: 1, sides: 6 }],
        flatModifier: 0,
        rollMode: 'normal',
        mode: 'sum',
      },
    ]);
    runBattery(
      'Count',
      [1, 1, 1, 1, 999999, 2, 3],
      snap,
      (s) => s.expressions[0]?.parts[0]?.count,
    );
  });
});
