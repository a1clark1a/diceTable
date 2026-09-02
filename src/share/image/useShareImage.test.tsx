import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { ColorModeProvider } from '../../components/ui/color-mode';
import { useShareImage } from './useShareImage';
import { toaster } from '../../components/share/toaster-store';
import { SCHEMA_VERSION } from '../../state/persistedSchema';
import { decodeFromHashFragment } from '../decode';

const STORAGE_KEY = 'dicetable.v2';
const ENVELOPE_VERSION = 2;
const DATA_URL_PREFIX = 'data:image/svg+xml;charset=utf-8,';
// vitest's jsdom page lives at this address, and the share link is the page
// the user is already on plus the table in the hash.
const LINK_PREFIX = 'http://localhost:3000/#data=';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

const darkWrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <ColorModeProvider forcedTheme="dark">
      <AppProvider>{children}</AppProvider>
    </ColorModeProvider>
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

function poolRowSeed(id: string): unknown {
  return {
    id,
    name: 'Dice pool',
    parts: [{ id: `${id}-part`, count: 5, sides: 6 }],
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

// d20 + 5 against 15 succeeds on a natural 10 or better, 11 faces of 20, so
// the row lands on 0 (nothing on a failure) exactly 9/20 = 45% of the time.
function checkRowSeed(): unknown {
  return {
    id: 'seed-check',
    name: 'Longsword',
    parts: [{ id: 'seed-check-part', count: 1, sides: 20 }],
    flatModifier: 5,
    rollMode: 'normal',
    mode: 'check',
    check: {
      threshold: { direction: 'gte', value: 15 },
      effect: { parts: [{ id: 'seed-effect-part', count: 1, sides: 8 }], flatModifier: 3 },
      onSuccess: 'full',
      onFailure: 'none',
    },
  };
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
  description?: unknown;
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

interface CapturedItem {
  flavours: Record<string, Blob | Promise<Blob>>;
}

/** Stands in for the browser's ClipboardItem and records what it was handed. */
function stubClipboardItem(): CapturedItem[] {
  const captured: CapturedItem[] = [];
  class FakeClipboardItem {
    flavours: Record<string, Blob | Promise<Blob>>;
    constructor(flavours: Record<string, Blob | Promise<Blob>>) {
      this.flavours = flavours;
      captured.push(this);
    }
  }
  vi.stubGlobal('ClipboardItem', FakeClipboardItem);
  return captured;
}

async function textFlavourOf(item: CapturedItem): Promise<string> {
  const flavour = item.flavours['text/plain'];
  if (!(flavour instanceof Blob)) throw new Error('link flavour should be a Blob');
  return flavour.text();
}

function freezeDate(date: Date): void {
  // Only the clock is faked: the Image stub settles on a real microtask and
  // downloadBlob revokes its object URL on a real timer.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(date);
}

// next-themes asks the browser for its colour scheme in an effect, and jsdom
// has no matchMedia to ask.
function stubMatchMedia(): void {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
  }));
}

// jsdom never loads an image and has no 2d canvas, so the two browser pieces
// rasterize leans on are stood in for: an Image that settles on the next
// microtask and records the src it was handed, and a canvas whose toBlob hands
// back a png-typed blob. The real rasterize module still runs.
const seenSrcs: string[] = [];
let imageOutcome: 'load' | 'error' = 'load';
const downloads: string[] = [];
let toBlobSpy: ReturnType<typeof vi.spyOn>;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private srcValue = '';
  set src(value: string) {
    this.srcValue = value;
    seenSrcs.push(value);
    queueMicrotask(() => {
      if (imageOutcome === 'load') this.onload?.();
      else this.onerror?.();
    });
  }
  get src(): string {
    return this.srcValue;
  }
}

/** The svg the picture was drawn from, read back out of the Image's data url. */
function renderedSvg(): string {
  const src = seenSrcs[0];
  if (src === undefined) throw new Error('no image was loaded');
  expect(src.startsWith(DATA_URL_PREFIX)).toBe(true);
  return decodeURIComponent(src.slice(DATA_URL_PREFIX.length));
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

beforeEach(() => {
  seenSrcs.length = 0;
  downloads.length = 0;
  imageOutcome = 'load';
  vi.stubGlobal('Image', FakeImage);
  // rasterize only ever calls drawImage, so a one-method fake stands in for
  // the full 2d context interface.
  const fakeContext = { drawImage: () => {} } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext);
  toBlobSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((callback: BlobCallback) => {
      callback(new Blob(['png bytes'], { type: 'image/png' }));
    });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:share');
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
  vi.useRealTimers();
  localStorage.clear();
});

describe('useShareImage savePng', () => {
  it('downloads exactly one png named after today', async () => {
    seedTable([sumRowSeed()]);
    freezeDate(new Date(2024, 2, 7, 13, 45));
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    expect(downloads).toEqual(['dicetable-2024-03-07.png']);
  });

  it('tells the user the download started', async () => {
    seedTable([sumRowSeed()]);
    const toasts = recordToasts();
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.type).toBe('success');
    expect(toasts[0]?.title).toBe('Download started');
    expect(result.current.busy).toBe(false);
  });
});

describe('useShareImage copyImage', () => {
  it('puts the link to the current table on the clipboard as text', async () => {
    seedTable([sumRowSeed()]);
    const captured = stubClipboardItem();
    patchNavigator('clipboard', { write: vi.fn().mockResolvedValue(undefined) });
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.copyImage('');
    });

    expect(captured).toHaveLength(1);
    const text = await textFlavourOf(captured[0]!);
    expect(text.startsWith(LINK_PREFIX)).toBe(true);
    expect(decodeFromHashFragment(new URL(text).hash)).toEqual({
      ok: true,
      rolls: [
        {
          id: 'seed-sum',
          name: 'Shortsword',
          parts: [{ id: 'seed-sum-part', count: 2, sides: 6 }],
          flatModifier: 0,
          rollMode: 'normal',
          mode: 'sum',
        },
      ],
    });
  });

  // A real clipboard write waits for the pending picture before it settles,
  // so a picture that fails to draw fails the write too. The user must then
  // hear why the picture failed, not that it was copied.
  it('shows the drawing error when the picture fails after the write started', async () => {
    seedTable([sumRowSeed()]);
    stubClipboardItem();
    const write = vi.fn(async (items: CapturedItem[]) => {
      await Promise.all(Object.values(items[0]!.flavours));
    });
    patchNavigator('clipboard', { write });
    toBlobSpy.mockImplementation((callback: BlobCallback) => {
      callback(null);
    });
    const toasts = recordToasts();
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.copyImage('');
    });

    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.type).toBe('error');
    expect(toasts[0]?.title).toBe("Couldn't make the image");
    expect(toasts[0]?.description).toBe('The image could not be saved.');
    expect(downloads).toHaveLength(0);
    expect(result.current.busy).toBe(false);
  });
});

describe('useShareImage shareSheet', () => {
  it('hands the sheet the dated png and the link to the current table', async () => {
    seedTable([sumRowSeed()]);
    freezeDate(new Date(2024, 2, 7));
    const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined);
    patchNavigator('share', share);
    const toasts = recordToasts();
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.shareSheet('');
    });

    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0]?.[0];
    expect(data?.files).toHaveLength(1);
    expect(data?.files?.[0]?.name).toBe('dicetable-2024-03-07.png');
    expect(data?.files?.[0]?.type).toBe('image/png');
    expect(data?.text?.startsWith(LINK_PREFIX)).toBe(true);
    const decoded = decodeFromHashFragment(new URL(data?.text ?? '').hash);
    if (!decoded.ok) throw new Error(`link did not decode: ${decoded.error}`);
    expect(decoded.rolls[0]?.id).toBe('seed-sum');
    expect(toasts).toHaveLength(0);
    expect(downloads).toHaveLength(0);
  });
});

describe('useShareImage canShareSheet', () => {
  it('is false in a browser with no share sheet', () => {
    const { result } = renderHook(() => useShareImage(), { wrapper });
    expect(result.current.canShareSheet).toBe(false);
  });

  // canShare only inspects name and type, so the probe has to ask about a file
  // named the way the real share will be, or the answer means nothing.
  it('asks the browser about an empty png named like the real download', () => {
    freezeDate(new Date(2024, 2, 7));
    const canShare = vi.fn<(data: ShareData) => boolean>().mockReturnValue(true);
    patchNavigator('share', vi.fn());
    patchNavigator('canShare', canShare);

    const { result } = renderHook(() => useShareImage(), { wrapper });

    expect(result.current.canShareSheet).toBe(true);
    expect(canShare).toHaveBeenCalledTimes(1);
    const data = canShare.mock.calls[0]?.[0];
    expect(data?.files).toHaveLength(1);
    expect(data?.files?.[0]?.name).toBe('dicetable-2024-03-07.png');
    expect(data?.files?.[0]?.type).toBe('image/png');
    expect(data?.files?.[0]?.size).toBe(0);
  });
});

describe('useShareImage picture contents', () => {
  it('leaves a pool row out and says so in the footer', async () => {
    seedTable([poolRowSeed('seed-pool'), sumRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).toContain('>1 pool roll is not in this picture</text>');
    expect(countOf(svg, '<polyline')).toBe(1);
  });

  // The sum row sits second in the table, so its swatch is the second palette
  // colour; the picture has to use that one, not the first colour it would get
  // if rows were numbered after the pool row was dropped.
  it('keeps the colour of the table position for a row drawn after a pool row', async () => {
    seedTable([poolRowSeed('seed-pool'), sumRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).toContain('stroke="#ea580c"');
    expect(svg).not.toContain('stroke="#2563eb"');
  });

  it('pluralises the footer for several pool rows', async () => {
    seedTable([poolRowSeed('seed-pool-a'), poolRowSeed('seed-pool-b'), sumRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).toContain('>2 pool rolls are not in this picture</text>');
    expect(countOf(svg, '<polyline')).toBe(1);
    expect(svg).toContain('stroke="#16a34a"');
  });

  it('leaves out a row too complex to compute and says so in the footer', async () => {
    seedTable([overloadedRowSeed(), sumRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).toContain('>1 roll left out (too complex)</text>');
    expect(svg).not.toContain('pool roll');
    expect(countOf(svg, '<polyline')).toBe(1);
    expect(svg).toContain('stroke="#ea580c"');
  });

  it('says both notes whole when a pool row and a too-complex row are left out', async () => {
    seedTable([poolRowSeed('seed-pool'), overloadedRowSeed(), sumRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).toContain(
      '>1 pool roll is not in this picture. 1 roll left out (too complex)</text>',
    );
    expect(svg).not.toContain('…');
    expect(countOf(svg, '<polyline')).toBe(1);
  });

  // The other bars peak at (11/20)(1/8) = 0.06875, so the axis rounds up to
  // 0.08 and the 45% miss bar is far taller than the card: it becomes a marker
  // at the first result (x = padding 28 + gutter 52 + inset 14 = 94) on the top
  // gridline (y = padding 28 + 18 = 46 with no title).
  it('marks a check row miss chance with its real percentage', async () => {
    seedTable([checkRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).toContain('>45%</text>');
    expect(svg).toContain(
      '<circle cx="94" cy="46" r="4" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>',
    );
  });
});

describe('useShareImage theme', () => {
  // One untitled row: the base card of 438 plus one 46 pixel list line.
  it('draws on the light card without a colour mode provider', async () => {
    seedTable([sumRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    expect(renderedSvg()).toContain(
      '<rect x="0" y="0" width="920" height="484" fill="#ffffff"/>',
    );
  });

  it('draws on the dark card in dark mode', async () => {
    seedTable([sumRowSeed()]);
    stubMatchMedia();
    const { result } = renderHook(() => useShareImage(), { wrapper: darkWrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).toContain('<rect x="0" y="0" width="920" height="484" fill="#0b1220"/>');
    expect(svg).not.toContain('#ffffff');
  });
});

describe('useShareImage render failures', () => {
  it('tells the user which step failed when the image cannot be decoded', async () => {
    seedTable([sumRowSeed()]);
    imageOutcome = 'error';
    const toasts = recordToasts();
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.type).toBe('error');
    expect(toasts[0]?.title).toBe("Couldn't make the image");
    expect(toasts[0]?.description).toBe('The comparison could not be drawn.');
    expect(downloads).toHaveLength(0);
    expect(result.current.busy).toBe(false);
  });
});
