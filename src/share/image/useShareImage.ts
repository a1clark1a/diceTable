import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../state/useApp';
import { getRowData } from '../../state/useDistributions';
import { rowColorHex } from '../../components/chart/palette';
import { useColorMode } from '../../components/ui/color-mode';
import { toaster } from '../../components/share/toaster-store';
import { canMiss, isTotalsMode } from '../../engine/expression';
import { winChances } from '../../engine/compare';
import {
  hasMixedScales,
  toCompareRows,
} from '../../components/compare/compareRows';
import { toTargetRows } from '../../components/target/targetHitRows';
import { CHART_ROW_LIMIT, type Expression } from '../../types';
import { expressionNotation } from '../notation';
import { shareUrlFor } from '../encode';
import { downloadBlob } from '../download';
import { buildShareSvg, type ShareImageRow } from './buildShareSvg';
import { buildTargetHitSvg, targetHitCardBlock } from './buildTargetHitSvg';
import { buildRollOffSvg } from './buildRollOffSvg';
import { buildMatrixSvg } from './buildMatrixSvg';
import { rasterize } from './rasterize';
import {
  canShareImage,
  copyImageWithLink,
  shareImage,
  shareImageFilename,
} from './clipboard';

const IMAGE_SCALE = 2;

/**
 * Why the current view cannot be pictured, or 'ready'. Derived per view because
 * the four cards have different minimums: the compare views need two rolls to
 * say anything, the target card needs something to measure against, and the
 * chart card is the only one with no row cap of its own.
 */
export type ShareCardState =
  | 'ready'
  | 'noRows'
  | 'needsTwo'
  | 'overLimit'
  | 'noTargets'
  | 'noSumRows';

export interface ShareImageActions {
  busy: boolean;
  canShareSheet: boolean;
  cardState: ShareCardState;
  copyImage: (title: string) => Promise<void>;
  savePng: (title: string) => Promise<void>;
  shareSheet: (title: string) => Promise<void>;
}

function omittedNote(count: number): string {
  return count === 1
    ? '1 roll left out (too complex)'
    : `${count} rolls left out (too complex)`;
}

interface ChartCardRows {
  rows: ShareImageRow[];
  poolRows: ShareImageRow[];
  /** Rolls the complexity guard refused to enumerate. */
  tooComplex: number;
  /** Rolls with nothing to enumerate: no parts, or dice that cannot roll. */
  unmeasured: number;
}

// Pool rows count successes, so they cannot share an axis with totals; they go
// to their own stacked panel instead of being dropped. Colours stay keyed to
// the unfiltered row position so the image matches the table's swatches.
function chartCardRows(
  expressions: Expression[],
  theme: 'light' | 'dark',
): ChartCardRows {
  const rows: ShareImageRow[] = [];
  const poolRows: ShareImageRow[] = [];
  let tooComplex = 0;
  let unmeasured = 0;
  expressions.forEach((expr, idx) => {
    const data = getRowData(expr);
    const { dist, stats } = data;
    // A blank row and a refused one both draw nothing, but they are not the
    // same news: telling someone their empty row is "too complex" sends them
    // looking for a problem that is not there.
    if (dist.size === 0) {
      if (data.tooComplex) tooComplex += 1;
      else unmeasured += 1;
    }
    (isTotalsMode(expr) ? rows : poolRows).push({
      id: expr.id,
      name: expr.name,
      notation: expressionNotation(expr),
      slot: idx,
      color: rowColorHex(idx, theme),
      dist,
      canMiss: canMiss(expr),
      mean: stats.mean,
      stddev: stats.stddev,
      min: stats.min,
      max: stats.max,
    });
  });
  return { rows, poolRows, tooComplex, unmeasured };
}

// toTargetRows drops a roll with unusable dice as well as one the complexity
// guard refused, so this card cannot borrow omittedNote's "(too complex)".
function unmeasuredNote(count: number): string {
  return count === 1
    ? '1 roll left out (nothing to measure)'
    : `${count} rolls left out (nothing to measure)`;
}

function joinNotes(notes: string[]): string {
  return notes.filter((n) => n.length > 0).join('. ');
}

function renderErrorToast(err: unknown): void {
  toaster.create({
    type: 'error',
    title: "Couldn't make the image",
    description:
      err instanceof Error ? err.message : 'Something went wrong drawing it.',
  });
}

export function useShareImage(): ShareImageActions {
  const {
    expressions,
    view,
    chartViews,
    target,
    poolTargets,
    targetSubView,
    targetFilter,
    targetSort,
    rollOffSort,
  } = useApp();
  const { colorMode } = useColorMode();
  const [busy, setBusy] = useState(false);

  // The Share popover mounts this hook permanently, so only the cheap flags
  // stay reactive; the full row build (notation strings and all) waits until a
  // share action is actually clicked. getRowData is WeakMap-cached per
  // expression, so the row builders here cost nothing after the first pass.
  const cardState = useMemo<ShareCardState>(() => {
    // Every card is gated on the rule it draws by, so no view can hand over a
    // PNG of the same empty-state sentence the screen is already showing.
    if (view === 'rolloff' || view === 'matrix') {
      return toCompareRows(expressions).length >= 2 ? 'ready' : 'needsTwo';
    }
    if (view === 'target') {
      return (
        targetHitCardBlock({
          rows: toTargetRows(expressions),
          target,
          poolTargets,
          subView: targetSubView,
          filter: targetFilter,
        }) ?? 'ready'
      );
    }
    const usable = expressions.filter(
      (expr) => getRowData(expr).dist.size > 0,
    ).length;
    if (usable === 0) return 'noRows';
    // The chart card is the only one with no row cap of its own.
    if (expressions.length > CHART_ROW_LIMIT) return 'overLimit';
    return 'ready';
  }, [expressions, view, target, poolTargets, targetSubView, targetFilter]);

  // Probed with an empty stand-in file: the real image does not exist until a
  // share is clicked, and canShare only inspects the file's name and type.
  const canShareSheet = useMemo(
    () => canShareImage(new Blob([], { type: 'image/png' }), shareImageFilename()),
    [],
  );

  // One renderer per workshop view, so the picture is of what the user is
  // looking at rather than of the table view's chart.
  const render = useCallback(
    (title: string): Promise<Blob> => {
      const theme = colorMode === 'dark' ? 'dark' : 'light';
      const shell = { theme, title, scale: IMAGE_SCALE } as const;

      switch (view) {
        case 'table': {
          const { rows, poolRows, tooComplex, unmeasured } =
            chartCardRows(expressions, theme);
          return rasterize(
            buildShareSvg({
              ...shell,
              rows,
              poolRows,
              totalsView: chartViews.totals,
              successesView: chartViews.successes,
              // Each panel resolves the target view against its own target, the
              // way the chart does: pool rows answer to the shared pool targets,
              // so Successes can show them while the numeric list is empty and
              // Totals falls back to the chance of each result.
              target,
              poolTarget: { values: poolTargets, ruling: 'gte' },
              note: joinNotes([
                tooComplex > 0 ? omittedNote(tooComplex) : '',
                unmeasured > 0 ? unmeasuredNote(unmeasured) : '',
              ]),
            }),
          );
        }
        case 'target': {
          // The view's own eligibility rule, reused rather than re-derived: a
          // roll with unusable dice, or one the complexity guard refused, has
          // no chance to show and never reaches the card.
          const rows = toTargetRows(expressions, theme);
          const omitted = expressions.length - rows.length;
          return rasterize(
            buildTargetHitSvg({
              ...shell,
              rows,
              target,
              poolTargets,
              subView: targetSubView,
              filter: targetFilter,
              sort: targetSort,
              note: omitted > 0 ? unmeasuredNote(omitted) : '',
            }),
          );
        }
        case 'rolloff': {
          // Not the chart card's row builder: the roll-off deliberately puts
          // pool rows in the running on their success-count scale.
          const compared = toCompareRows(expressions, theme);
          const chances = winChances(compared.map((r) => r.dist));
          const dropped = expressions.length - compared.length;
          return rasterize(
            buildRollOffSvg({
              ...shell,
              rows: compared.map((r, i) => ({
                id: r.expr.id,
                name: r.expr.name,
                notation: expressionNotation(r.expr),
                color: r.color,
                win: chances[i]?.win ?? 0,
                tie: chances[i]?.tie ?? 0,
              })),
              mixedScales: hasMixedScales(compared),
              order: rollOffSort,
              note: dropped > 0 ? unmeasuredNote(dropped) : '',
            }),
          );
        }
        case 'matrix': {
          const compared = toCompareRows(expressions, theme);
          const dropped = expressions.length - compared.length;
          return rasterize(
            buildMatrixSvg({
              ...shell,
              rows: compared.map((r) => ({
                id: r.expr.id,
                name: r.expr.name,
                color: r.color,
                dist: r.dist,
              })),
              mixedScales: hasMixedScales(compared),
              note: dropped > 0 ? unmeasuredNote(dropped) : '',
            }),
          );
        }
      }
    },
    [
      expressions,
      view,
      chartViews,
      target,
      poolTargets,
      targetSubView,
      targetFilter,
      targetSort,
      rollOffSort,
      colorMode,
    ],
  );

  const copyImage = useCallback(
    async (title: string) => {
      if (busy) return;
      setBusy(true);
      try {
        // The clipboard write has to start inside the click's user activation
        // (see copyImageWithLink), so the pending blob promise goes onto the
        // clipboard before anything here is awaited. Both calls stay inside the
        // try: a synchronous throw from either one would otherwise escape as an
        // unhandled rejection, leaving busy stuck true and every share action
        // wedged until the popover unmounts.
        const blobPromise = render(title);
        const copied = copyImageWithLink(blobPromise, shareUrlFor(expressions));
        if (await copied) {
          toaster.create({
            type: 'success',
            title: 'Image copied',
            description: 'The link came along as text, so either one pastes.',
          });
          return;
        }
        // A file the user keeps beats nothing, whatever refused the copy.
        const blob = await blobPromise;
        downloadBlob(blob, shareImageFilename());
        toaster.create({
          type: 'info',
          title: "Couldn't copy the image",
          description: 'Saved it as a download instead.',
        });
      } catch (err) {
        renderErrorToast(err);
      } finally {
        setBusy(false);
      }
    },
    [busy, render, expressions],
  );

  const savePng = useCallback(
    async (title: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const blob = await render(title);
        downloadBlob(blob, shareImageFilename());
        toaster.create({ type: 'success', title: 'Download started' });
      } catch (err) {
        renderErrorToast(err);
      } finally {
        setBusy(false);
      }
    },
    [busy, render],
  );

  const shareSheet = useCallback(
    async (title: string) => {
      if (busy) return;
      setBusy(true);
      try {
        const blob = await render(title);
        const filename = shareImageFilename();
        const outcome = await shareImage(blob, filename, shareUrlFor(expressions));
        if (outcome === 'shared' || outcome === 'cancelled') return;
        downloadBlob(blob, filename);
        toaster.create({
          type: 'info',
          title: 'Sharing is not available here',
          description: 'Saved the image as a download instead.',
        });
      } catch (err) {
        renderErrorToast(err);
      } finally {
        setBusy(false);
      }
    },
    [busy, render, expressions],
  );

  return {
    busy,
    canShareSheet,
    cardState,
    copyImage,
    savePng,
    shareSheet,
  };
}
