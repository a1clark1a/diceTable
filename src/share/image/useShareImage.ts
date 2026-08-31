import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../state/useApp';
import { getRowData } from '../../state/useDistributions';
import { rowColor } from '../../components/chart/palette';
import { useColorMode } from '../../components/ui/color-mode';
import { toaster } from '../../components/share/toaster-store';
import { effectiveChartView } from '../../components/chart/effectiveView';
import { canMiss, isTotalsMode } from '../../engine/expression';
import { expressionNotation } from '../notation';
import { shareUrlFor } from '../encode';
import { downloadBlob } from '../download';
import { buildShareSvg, type ShareImageRow } from './buildShareSvg';
import { rasterize } from './rasterize';
import {
  canShareImage,
  copyImageWithLink,
  shareImage,
  shareImageFilename,
} from './clipboard';

const IMAGE_SCALE = 2;

export interface ShareImageActions {
  busy: boolean;
  canShareSheet: boolean;
  hasRows: boolean;
  copyImage: (title: string) => Promise<void>;
  savePng: (title: string) => Promise<void>;
  shareSheet: (title: string) => Promise<void>;
}

function poolNote(count: number): string {
  return count === 1
    ? '1 pool roll is not in this picture'
    : `${count} pool rolls are not in this picture`;
}

function omittedNote(count: number): string {
  return count === 1
    ? '1 roll left out (too complex)'
    : `${count} rolls left out (too complex)`;
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
  const { expressions, chartView, target } = useApp();
  const { colorMode } = useColorMode();
  const [busy, setBusy] = useState(false);

  // The Share popover mounts this hook permanently, so only the cheap flags
  // stay reactive; the full row build (notation strings and all) waits until a
  // share action is actually clicked.
  const hasRows = useMemo(
    () =>
      expressions.some(
        (expr) => isTotalsMode(expr) && getRowData(expr).dist.size > 0,
      ),
    [expressions],
  );

  // Probed with an empty stand-in file: the real image does not exist until a
  // share is clicked, and canShare only inspects the file's name and type.
  const canShareSheet = useMemo(
    () => canShareImage(new Blob([], { type: 'image/png' }), shareImageFilename()),
    [],
  );

  const render = useCallback(
    (title: string): Promise<Blob> => {
      // Pool rows count successes, so they cannot share an axis with totals. The
      // picture draws the totals rows and says out loud that the rest are missing
      // rather than quietly dropping them. Colours stay keyed to the unfiltered
      // row position so the image matches the table's swatches.
      const rows: ShareImageRow[] = [];
      expressions.forEach((expr, idx) => {
        if (!isTotalsMode(expr)) return;
        const { dist, stats } = getRowData(expr);
        rows.push({
          id: expr.id,
          name: expr.name,
          notation: expressionNotation(expr),
          color: rowColor(idx),
          dist,
          canMiss: canMiss(expr),
          mean: stats.mean,
          stddev: stats.stddev,
          min: stats.min,
          max: stats.max,
        });
      });
      const poolCount = expressions.length - rows.length;
      const omittedCount = rows.filter((row) => row.dist.size === 0).length;
      const notes: string[] = [];
      if (poolCount > 0) notes.push(poolNote(poolCount));
      if (omittedCount > 0) notes.push(omittedNote(omittedCount));

      return rasterize(
        buildShareSvg({
          rows,
          view: effectiveChartView(chartView, target),
          theme: colorMode === 'dark' ? 'dark' : 'light',
          title,
          scale: IMAGE_SCALE,
          note: notes.join('. '),
        }),
      );
    },
    [expressions, chartView, target, colorMode],
  );

  const copyImage = useCallback(
    async (title: string) => {
      if (busy) return;
      setBusy(true);
      // The clipboard write has to start inside the click's user activation
      // (see copyImageWithLink), so the pending blob promise goes onto the
      // clipboard before anything here is awaited.
      const blobPromise = render(title);
      const copied = copyImageWithLink(blobPromise, shareUrlFor(expressions));
      try {
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
    hasRows,
    copyImage,
    savePng,
    shareSheet,
  };
}
