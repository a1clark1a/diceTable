// The Mod cell opens a row's chain editor for a chain it cannot show as one
// number. The editor may already be open, so mounting alone cannot carry the
// request; an open editor listens for it as well.
let pending: string | null = null;
const listeners = new Set<() => void>();

/** Puts focus on a row's first chain step, once its editor is on screen. */
export function focusModChain(exprId: string): void {
  pending = exprId;
  for (const listener of listeners) listener();
}

/** Whether a request is waiting for this row; answering it clears it. */
export function takeModChainFocus(exprId: string): boolean {
  if (pending !== exprId) return false;
  pending = null;
  return true;
}

export function onModChainFocus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
