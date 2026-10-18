import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { SCHEMA_VERSION } from '../../state/persistedSchema';
import { useApp, type ExpressionPatch } from '../../state/useApp';
import { MAX_NOTE_LENGTH, type PersistedState } from '../../types';
import { NoteField } from './NoteField';

const Plain = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

afterEach(() => {
  window.localStorage.clear();
});

function renderField(note: string | undefined) {
  const updateExpression =
    vi.fn<(id: string, patch: ExpressionPatch) => void>();
  render(
    <Plain>
      <NoteField exprId="e1" note={note} updateExpression={updateExpression} />
    </Plain>,
  );
  return { updateExpression, input: screen.getByLabelText('Roll note') };
}

describe('NoteField commits', () => {
  it('commits the trimmed note when the field loses focus', () => {
    const { updateExpression, input } = renderField(undefined);
    fireEvent.change(input, { target: { value: '  v2: d8, the d10 spiked  ' } });
    fireEvent.blur(input);
    expect(updateExpression).toHaveBeenCalledTimes(1);
    expect(updateExpression).toHaveBeenCalledWith('e1', {
      note: 'v2: d8, the d10 spiked',
    });
  });

  it('commits on Enter', () => {
    const { updateExpression, input } = renderField(undefined);
    fireEvent.change(input, { target: { value: 'needs a nerf' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(updateExpression).toHaveBeenCalledTimes(1);
    expect(updateExpression).toHaveBeenCalledWith('e1', { note: 'needs a nerf' });
  });

  it('does not touch the row when focus leaves an untouched field', () => {
    const { updateExpression, input } = renderField('keep me');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(updateExpression).not.toHaveBeenCalled();
  });

  // Padding the same note with spaces trims back to what is stored, so the row
  // must not be rebuilt (a new row object recomputes its distribution).
  it('does not touch the row when the edit trims back to the stored note', () => {
    const { updateExpression, input } = renderField('keep me');
    fireEvent.change(input, { target: { value: '  keep me ' } });
    fireEvent.blur(input);
    expect(updateExpression).not.toHaveBeenCalled();
  });

  it('does not commit whitespace typed into an empty field', () => {
    const { updateExpression, input } = renderField(undefined);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(updateExpression).not.toHaveBeenCalled();
  });

  it('reverts on Escape without committing', () => {
    const { updateExpression, input } = renderField('original');
    fireEvent.change(input, { target: { value: 'changed my mind' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(updateExpression).not.toHaveBeenCalled();
    expect(input).toHaveValue('original');
  });

  it('sends an empty note when the field is cleared', () => {
    const { updateExpression, input } = renderField('old reason');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(updateExpression).toHaveBeenCalledWith('e1', { note: '' });
  });
});

describe('NoteField length limit', () => {
  it('stops typing at 200 characters', () => {
    const { input } = renderField(undefined);
    expect(MAX_NOTE_LENGTH).toBe(200);
    expect(input).toHaveAttribute('maxlength', '200');
  });

  it('shows no counter below 160 characters', () => {
    const { input } = renderField(undefined);
    fireEvent.change(input, { target: { value: 'x'.repeat(159) } });
    expect(screen.queryByText('159/200')).toBeNull();
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('shows the counter from 160 characters and links it to the field', () => {
    const { input } = renderField(undefined);
    fireEvent.change(input, { target: { value: 'x'.repeat(160) } });
    const counter = screen.getByText('160/200');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(counter.id).toBe(describedBy);
    expect(input).toHaveAccessibleDescription('160/200');
  });

  it('counts up to the cap', () => {
    const { input } = renderField(undefined);
    fireEvent.change(input, { target: { value: 'x'.repeat(200) } });
    expect(screen.getByText('200/200')).toBeInTheDocument();
  });

  it('shows the counter for a stored note that is already near the cap', () => {
    renderField('y'.repeat(180));
    expect(screen.getByText('180/200')).toBeInTheDocument();
  });

  it('drops the counter again when the note is shortened below 160', () => {
    const { input } = renderField(undefined);
    fireEvent.change(input, { target: { value: 'x'.repeat(170) } });
    expect(screen.getByText('170/200')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'x'.repeat(20) } });
    expect(screen.queryByText(/\/200$/)).toBeNull();
    expect(input).not.toHaveAttribute('aria-describedby');
  });
});

// Through the real provider: what the user typed is what the row holds, and
// clearing the field removes the note rather than storing an empty string.
function seedRowWithNote(note: string | undefined) {
  const state: PersistedState = {
    version: SCHEMA_VERSION,
    expressions: [
      {
        id: 'e1',
        name: 'Longsword',
        parts: [{ id: 'p1', count: 1, sides: 8 }],
        flatModifier: 3,
        rollMode: 'normal',
        mode: 'sum',
        ...(note !== undefined && { note }),
      },
    ],
    ui: {
      expandedId: null,
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
  window.localStorage.setItem(
    'dicetable.v2',
    JSON.stringify({ version: 2, value: state }),
  );
}

function Harness() {
  const { expressions, updateExpression } = useApp();
  const expr = expressions.find((e) => e.id === 'e1');
  if (!expr) return null;
  return (
    <>
      <NoteField
        exprId={expr.id}
        note={expr.note}
        updateExpression={updateExpression}
      />
      <span data-testid="stored-note">
        {'note' in expr ? `note:${expr.note ?? ''}` : 'no note key'}
      </span>
    </>
  );
}

function renderWithProvider() {
  render(
    <Plain>
      <AppProvider>
        <Harness />
      </AppProvider>
    </Plain>,
  );
  return screen.getByLabelText('Roll note');
}

describe('NoteField with the app state', () => {
  it('shows the stored note in the field', () => {
    seedRowWithNote('v2: d8');
    const input = renderWithProvider();
    expect(input).toHaveValue('v2: d8');
  });

  it('stores the trimmed note on the row', () => {
    seedRowWithNote(undefined);
    const input = renderWithProvider();
    expect(screen.getByTestId('stored-note')).toHaveTextContent('no note key');
    fireEvent.change(input, { target: { value: '  too swingy  ' } });
    fireEvent.blur(input);
    expect(screen.getByTestId('stored-note')).toHaveTextContent('note:too swingy');
    expect(input).toHaveValue('too swingy');
  });

  it('removes the note key from the row when the field is cleared', () => {
    seedRowWithNote('old reason');
    const input = renderWithProvider();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(screen.getByTestId('stored-note')).toHaveTextContent('no note key');
    expect(input).toHaveValue('');
  });

  it('removes the note key when only spaces are left', () => {
    seedRowWithNote('old reason');
    const input = renderWithProvider();
    fireEvent.change(input, { target: { value: '    ' } });
    fireEvent.blur(input);
    expect(screen.getByTestId('stored-note')).toHaveTextContent('no note key');
  });
});
