import { act, fireEvent, screen, within } from '@testing-library/react';

/**
 * A parameter group states its value on a trigger and keeps its editor behind
 * it, so a test that reaches for a control inside one has to open it first.
 *
 * Async because the popover state machine lands its update on a microtask
 * rather than inside the click: a synchronous assertion after fireEvent reads
 * the DOM one tick too early and sees the group still closed.
 *
 * A no-op where the group is not on screen, so callers asking whether a group
 * rendered at all stay able to ask, and a no-op where it is already open,
 * because the trigger toggles.
 */
/**
 * The two layouts name their opener differently, and both are correct. The
 * touch layout has a separate "Edit" button, so it carries the edit label. The
 * pointer layout's trigger IS the label and the summary, so its accessible name
 * is that content: giving it an edit label instead would hide the current value
 * and drop the visible word out of the name.
 */
const POINTER_TRIGGER: Record<string, RegExp> = {
  'Edit targets': /^Target\b/,
  'Edit pool targets': /^Pool target\b/,
};

export async function openParams(editLabel: string): Promise<void> {
  const pattern = POINTER_TRIGGER[editLabel];
  // "Target hit" is a view tab and matches the same prefix, so the opener is
  // picked by the thing only a disclosure has rather than by name alone.
  const byContent =
    pattern === undefined
      ? []
      : screen
          .queryAllByRole('button', { name: pattern })
          .filter((b) => b.hasAttribute('aria-expanded'));
  const trigger =
    screen.queryByRole('button', { name: editLabel }) ?? byContent[0] ?? null;
  if (trigger === null || trigger.getAttribute('aria-expanded') === 'true') {
    return;
  }
  await act(async () => {
    fireEvent.click(trigger);
  });
}

/**
 * An open editor, scoped. The trigger repeats its values as a summary, so a
 * query for "4" across the whole document would match twice.
 */
export function paramsPanel(title: string) {
  return within(screen.getByRole('dialog', { name: title }));
}
