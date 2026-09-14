import { useCallback, useMemo, useState } from 'react';

export interface SeriesFocus {
  /** The series the chart should single out, whichever way it was chosen. */
  focusedId: string | null;
  /** Set only by an explicit pick, so the chip can report itself pressed. */
  pickedId: string | null;
  preview: (id: string | null) => void;
  toggle: (id: string) => void;
  clear: () => void;
}

/**
 * Isolating one roll, from a pointer, a keyboard or a finger.
 *
 * The legend chip announced itself as a button and had no onClick, so
 * activating it did nothing: Enter and Space were silent, and on touch the only
 * thing that could fire was a synthesized mouseover that the next tap cancelled.
 * Hover alone cannot be the mechanism on a layout this project treats as
 * first-class on a phone.
 *
 * So a pick is sticky and a hover is a preview, and the pick wins: once you have
 * chosen a roll, moving the pointer across the others does not steal it back.
 */
export function useSeriesFocus(): SeriesFocus {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setPickedId((current) => (current === id ? null : id));
  }, []);

  const clear = useCallback(() => {
    setPickedId(null);
    setPreviewId(null);
  }, []);

  return useMemo(
    () => ({
      focusedId: pickedId ?? previewId,
      pickedId,
      preview: setPreviewId,
      toggle,
      clear,
    }),
    [pickedId, previewId, toggle, clear],
  );
}
