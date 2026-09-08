import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { useApp } from '../../state/useApp';
import { useShareImage } from './useShareImage';
import { toaster } from '../../components/share/toaster-store';
import { SCHEMA_VERSION } from '../../state/persistedSchema';

const STORAGE_KEY = 'dicetable.v2';
const ENVELOPE_VERSION = 2;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

function seedTable(expressions: unknown[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: ENVELOPE_VERSION,
      value: {
        version: SCHEMA_VERSION,
        expressions,
        ui: {
          expandedId: null,
          chartView: 'pmf',
          target: { values: [], ruling: 'gte' },
          view: 'table',
          poolTarget: 1,
          baselineId: null,
        },
      },
    }),
  );
}

function sumRowSeed(): unknown {
  return {
    id: 'seed-sum',
    name: 'Shortsword',
    parts: [{ id: 'seed-sum-part', count: 2, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
}

function poolRowSeed(): unknown {
  return {
    id: 'seed-pool',
    name: 'Dice pool',
    parts: [{ id: 'seed-pool-part', count: 5, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'pool',
    successThreshold: { direction: 'gte', value: 4 },
  };
}

// Keep-highest over a hundred d100s blows past the complexity guard, so the
// row is valid to store yet yields an empty distribution.
function overloadedRowSeed(): unknown {
  return {
    id: 'seed-heavy',
    name: 'Too heavy',
    parts: [
      { id: 'seed-heavy-part', count: 100, sides: 100, keep: { type: 'highest', n: 1 } },
    ],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  };
}

function domError(name: string): Error {
  return Object.assign(new Error(name), { name });
}

// jsdom ships no clipboard or share, so tests put them on the navigator
// directly and take them off again afterwards.
const patchedNavigatorKeys: string[] = [];
function patchNavigator(key: string, value: unknown): void {
  Object.defineProperty(navigator, key, { configurable: true, writable: true, value });
  patchedNavigatorKeys.push(key);
}

interface PublishedToast {
  type?: string;
  title?: unknown;
  dismiss?: boolean;
}

const toastUnsubs: Array<() => void> = [];
/** Watches the real toaster store; dismiss events are not created toasts. */
function recordToasts(): PublishedToast[] {
  const seen: PublishedToast[] = [];
  toastUnsubs.push(
    toaster.subscribe((toast: PublishedToast) => {
      if (!toast.dismiss) seen.push(toast);
    }),
  );
  return seen;
}

// jsdom never loads an image and has no 2d canvas, so the two browser pieces
// rasterize leans on are stood in for: an Image that loads on the next
// microtask, and a canvas whose toBlob hands back a png-typed blob. The real
// rasterize module still runs.
let clickSpy: ReturnType<typeof vi.spyOn>;
let toBlobSpy: ReturnType<typeof vi.spyOn>;
let blobMade = false;

class InstantImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private srcValue = '';
  set src(value: string) {
    this.srcValue = value;
    queueMicrotask(() => this.onload?.());
  }
  get src(): string {
    return this.srcValue;
  }
}

beforeEach(() => {
  blobMade = false;
  vi.stubGlobal('Image', InstantImage);
  const fakeContext = { drawImage: () => {} } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext);
  toBlobSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((callback: BlobCallback) => {
      blobMade = true;
      callback(new Blob(['png bytes'], { type: 'image/png' }));
    });
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stress');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  for (const unsub of toastUnsubs.splice(0)) unsub();
  toaster.remove();
  for (const key of patchedNavigatorKeys.splice(0)) {
    Reflect.deleteProperty(navigator, key);
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useShareImage cardState honesty', () => {
  it('reports no shareable rows for a brand-new table', () => {
    const { result } = renderHook(() => useShareImage(), { wrapper });
    expect(result.current.cardState).toBe('noRows');
  });

  // A pool row draws its own Successes panel, so a pool-only table is as
  // shareable as any other.
  it('counts a pool row as shareable', () => {
    seedTable([poolRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });
    expect(result.current.cardState).toBe('ready');
  });

  it('does not count a row too complex to compute', () => {
    seedTable([overloadedRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });
    expect(result.current.cardState).toBe('noRows');
  });

  it('counts an ordinary sum row as shareable', () => {
    seedTable([sumRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });
    expect(result.current.cardState).toBe('ready');
  });

  it('flips true the moment a computable row joins a table of unshareable ones', () => {
    seedTable([overloadedRowSeed()]);
    const { result } = renderHook(() => ({ app: useApp(), share: useShareImage() }), {
      wrapper,
    });
    expect(result.current.share.cardState).toBe('noRows');

    act(() => {
      result.current.app.addExpression();
    });
    expect(result.current.share.cardState).toBe('ready');
  });
});

describe('useShareImage share sheet outcomes', () => {
  it('treats a dismissed share sheet as a choice: no download, no toast', async () => {
    seedTable([sumRowSeed()]);
    patchNavigator('share', vi.fn().mockRejectedValue(domError('AbortError')));
    const toasts = recordToasts();
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.shareSheet('Stress');
    });

    expect(clickSpy).not.toHaveBeenCalled();
    expect(toasts).toHaveLength(0);
    expect(result.current.busy).toBe(false);
  });

  it('falls back to exactly one download when the share is refused', async () => {
    seedTable([sumRowSeed()]);
    const share = vi.fn().mockRejectedValue(domError('NotAllowedError'));
    patchNavigator('share', share);
    const toasts = recordToasts();
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.shareSheet('Stress');
    });

    expect(share).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.type).toBe('info');
    expect(toasts[0]?.title).toBe('Sharing is not available here');
  });

  it('ignores a second press while the first share sheet is still open', async () => {
    seedTable([sumRowSeed()]);
    let resolveShare: (() => void) | null = null;
    const share = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveShare = resolve;
        }),
    );
    patchNavigator('share', share);
    const toasts = recordToasts();
    const { result } = renderHook(() => useShareImage(), { wrapper });

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.shareSheet('Stress');
    });
    await waitFor(() => expect(result.current.busy).toBe(true));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.shareSheet('Stress');
    });
    expect(share).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveShare?.();
      await first;
    });
    expect(result.current.busy).toBe(false);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(toasts).toHaveLength(0);
  });

  it('shares a title pushed past its budget by emoji without failing', async () => {
    seedTable([sumRowSeed()]);
    const share = vi.fn().mockResolvedValue(undefined);
    patchNavigator('share', share);
    const toasts = recordToasts();
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.shareSheet('🎲'.repeat(90));
    });

    expect(share).toHaveBeenCalledTimes(1);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(toasts).toHaveLength(0);
  });
});

describe('useShareImage copy outcomes', () => {
  class FakeClipboardItem {
    flavours: Record<string, Blob | Promise<Blob>>;
    constructor(flavours: Record<string, Blob | Promise<Blob>>) {
      this.flavours = flavours;
    }
  }

  it('falls back to exactly one download when the clipboard write is refused', async () => {
    seedTable([sumRowSeed()]);
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    const write = vi.fn().mockRejectedValue(domError('NotAllowedError'));
    patchNavigator('clipboard', { write });
    const toasts = recordToasts();
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.copyImage('Stress');
    });

    expect(write).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.type).toBe('info');
    expect(toasts[0]?.title).toBe("Couldn't copy the image");
  });

  it('copies without downloading when the clipboard takes the write', async () => {
    seedTable([sumRowSeed()]);
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    const write = vi.fn().mockResolvedValue(undefined);
    patchNavigator('clipboard', { write });
    const toasts = recordToasts();
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.copyImage('Stress');
    });

    expect(clickSpy).not.toHaveBeenCalled();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.type).toBe('success');
  });

  // Safari only honours a clipboard write started inside the click's user
  // activation, so the write must be on its way before the png exists.
  it('starts the clipboard write before the image has finished rendering', async () => {
    seedTable([sumRowSeed()]);
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    let blobExistedWhenWriteStarted: boolean | null = null;
    const write = vi.fn().mockImplementation(() => {
      blobExistedWhenWriteStarted = blobMade;
      return Promise.resolve();
    });
    patchNavigator('clipboard', { write });
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.copyImage('Stress');
    });

    expect(write).toHaveBeenCalledTimes(1);
    expect(blobExistedWhenWriteStarted).toBe(false);
  });
});

describe('useShareImage render failures', () => {
  it('reports a drawing failure with one error toast and no download', async () => {
    seedTable([sumRowSeed()]);
    toBlobSpy.mockImplementation((callback: BlobCallback) => {
      callback(null);
    });
    const toasts = recordToasts();
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('Stress');
    });

    expect(clickSpy).not.toHaveBeenCalled();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.type).toBe('error');
    expect(toasts[0]?.title).toBe("Couldn't make the image");
    expect(result.current.busy).toBe(false);
  });
});
