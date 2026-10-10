import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../state/useApp';
import { RELEASES, type Release } from '../../whatsNew/releases';
import { decideOnOpen, markSeen, readLastSeen } from '../../whatsNew/lastSeen';
import { clearShareVisitMarker, shareVisitSource } from '../../share/autoload';

export type WhatsNewMode = 'since' | 'all';

export interface WhatsNew {
  open: boolean;
  mode: WhatsNewMode;
  releases: readonly Release[];
  sinceVersion: string | null;
  current: string;
  openAll: () => void;
  close: () => void;
}

export function useWhatsNew(): WhatsNew {
  const { expressions } = useApp();
  const current = __APP_VERSION__;

  // Decided once and without side effects: StrictMode runs this twice and keeps
  // one result, and it has to run before the share autoload effect strips the
  // link from the URL.
  const [initial] = useState(() => {
    const source = shareVisitSource(Date.now());
    const decision = decideOnOpen({
      read: readLastSeen(),
      current,
      releases: RELEASES,
      hasSavedTable: expressions.length > 0,
      shareVisit: source !== null,
    });
    return { decision, fromMarker: source === 'marker' };
  });

  const [open, setOpen] = useState(initial.decision.autoOpen !== null);
  const [mode, setMode] = useState<WhatsNewMode>('since');

  useEffect(() => {
    if (initial.decision.recordNow) markSeen(current);
    // Only a marker this load consumed is cleared. A link in the URL leaves its
    // marker alone, since the reload it guards against has not happened yet.
    if (initial.fromMarker) clearShareVisitMarker();
  }, [initial, current]);

  const openAll = useCallback(() => {
    setMode('all');
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    markSeen(current);
    setOpen(false);
  }, [current]);

  return {
    open,
    mode,
    releases: mode === 'since' ? (initial.decision.autoOpen ?? []) : RELEASES,
    sinceVersion: initial.decision.sinceVersion,
    current,
    openAll,
    close,
  };
}
