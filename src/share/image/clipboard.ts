export function shareImageFilename(now: Date = new Date()): string {
  const yyyy = String(now.getFullYear()).padStart(4, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `dicetable-${yyyy}-${mm}-${dd}.png`;
}

/**
 * Copies the picture and the link together in one clipboard write, so pasting
 * into a chat gives the image and pasting into a text field gives the URL. The
 * link is not drawn into the image, where nobody could click it.
 *
 * The picture may arrive as a pending promise, and the caller must invoke this
 * synchronously from the click handler: Safari only honours clipboard.write
 * while the click's user activation is live, so the write has to start before
 * the image finishes rendering, with the ClipboardItem resolving the blob later.
 */
export async function copyImageWithLink(
  blob: Blob | Promise<Blob>,
  url: string,
): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined') return false;
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  if (typeof navigator.clipboard.write !== 'function') return false;

  try {
    const item = new ClipboardItem({
      'image/png': blob,
      'text/plain': new Blob([url], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
}

export function canShareImage(blob: Blob, filename: string): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([blob], filename, { type: 'image/png' })] });
  } catch {
    return false;
  }
}

export type ShareImageOutcome = 'shared' | 'cancelled' | 'failed';

export async function shareImage(
  blob: Blob,
  filename: string,
  url: string,
): Promise<ShareImageOutcome> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'failed';
  }
  try {
    await navigator.share({
      files: [new File([blob], filename, { type: 'image/png' })],
      text: url,
    });
    return 'shared';
  } catch (err) {
    // Dismissing the sheet raises AbortError. Declining to share is a choice,
    // not a failure, and must not trigger any fallback.
    return err instanceof Error && err.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
