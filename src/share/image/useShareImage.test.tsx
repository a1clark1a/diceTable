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
  it('draws a pool row in its own panel instead of leaving it out', async () => {
    seedTable([poolRowSeed('seed-pool'), sumRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).not.toContain('not in this picture');
    expect(countOf(svg, '<polyline')).toBe(2);
    expect(svg).toContain('>TOTALS</text>');
    expect(svg).toContain('>SUCCESSES</text>');
  });

  // The sum row sits second in the table, so its swatch is the second palette
  // colour; the picture has to use that one, not the first colour it would get
  // if rows were numbered per panel.
  it('keeps the colour of the table position across the two panels', async () => {
    seedTable([poolRowSeed('seed-pool'), sumRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).toContain('stroke="#bb6a26"');
    expect(svg).toContain('stroke="#4369b6"');
  });

  it('stacks several pool rows into the one successes panel', async () => {
    seedTable([poolRowSeed('seed-pool-a'), poolRowSeed('seed-pool-b'), sumRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).not.toContain('not in this picture');
    expect(countOf(svg, '<polyline')).toBe(3);
    expect(countOf(svg, '>SUCCESSES</text>')).toBe(1);
    expect(svg).toContain('stroke="#0a9564"');
  });

  it('draws a table of only pool rows as a successes panel', async () => {
    seedTable([poolRowSeed('seed-pool')]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(countOf(svg, '<polyline')).toBe(1);
    expect(svg).toContain('>SUCCESSES</text>');
    expect(svg).not.toContain('>TOTALS</text>');
    expect(svg).not.toContain('No rolls to compare yet.');
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
    expect(svg).toContain('stroke="#bb6a26"');
  });

  // A pool row beside a too-complex one leaves only the too-complex note: the
  // pool row is in the picture, so nothing claims otherwise.
  it('counts only the too-complex row in the footer beside a pool row', async () => {
    seedTable([poolRowSeed('seed-pool'), overloadedRowSeed(), sumRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).toContain('>1 roll left out (too complex)</text>');
    expect(svg).not.toContain('not in this picture');
    expect(countOf(svg, '<polyline')).toBe(2);
  });

  // The other bars peak at (11/20)(1/8) = 0.06875, so the axis rounds up to
  // 0.08 and the 45% miss bar is far taller than the card: it becomes a marker
  // at the first result on the top gridline (y = padding 28 + 18 = 46 with no
  // title). 0 to 11 is twelve results, so the plot insets half a tread,
  // 812 / 24 = 33.83, from the axis at padding 28 + gutter 52 = 80.
  it('marks a check row miss chance with its real percentage', async () => {
    seedTable([checkRowSeed()]);
    const { result } = renderHook(() => useShareImage(), { wrapper });

    await act(async () => {
      await result.current.savePng('');
    });

    const svg = renderedSvg();
    expect(svg).toContain('>45%</text>');
    expect(svg).toContain(
      '<circle cx="113.83" cy="46" r="4" fill="#4369b6" stroke="#f2f1ed" stroke-width="2"/>',
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
      '<rect x="0" y="0" width="920" height="484" fill="#f2f1ed"/>',
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
    expect(svg).toContain('<rect x="0" y="0" width="920" height="484" fill="#131519"/>');
    expect(svg).not.toContain('#f2f1ed');
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

// The chart card's row cap, restated: twenty rolls still draw, and the
// twenty-first is what tips the table view over.
const CHART_ROW_LIMIT = 20;

interface ViewUi {
  view: string;
  target?: { values: number[]; ruling: string };
  poolTargets?: number[];
  targetSubView?: string;
  targetFilter?: string;
  rollOffSort?: string;
}

/** seedTable's envelope with the workshop view and its saved controls set. */
function seedViewTable(expressions: unknown[], ui: ViewUi): void {
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
          poolTargets: [1],
          baselineId: null,
          targetSubView: 'grid',
          targetFilter: 'all',
          targetSort: null,
          rollOffSort: 'win',
          ...ui,
        },
      },
    }),
  );
}

// A d6 first and a 2d6 second, so table order and win order are the reverse of
// each other: the 2d6 wins the roll-off from the second table position.
function racerSeeds(): unknown[] {
  return [
    {
      id: 'seed-dagger',
      name: 'Dagger',
      parts: [{ id: 'seed-dagger-part', count: 1, sides: 6 }],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'sum',
    },
    {
      id: 'seed-greatsword',
      name: 'Greatsword',
      parts: [{ id: 'seed-greatsword-part', count: 2, sides: 6 }],
      flatModifier: 0,
      rollMode: 'normal',
      mode: 'sum',
    },
  ];
}

function manySumSeeds(count: number): unknown[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `seed-many-${i}`,
    name: `Roll ${i}`,
    parts: [{ id: `seed-many-${i}-part`, count: 1, sides: 6 }],
    flatModifier: 0,
    rollMode: 'normal',
    mode: 'sum',
  }));
}

/** Draws the seeded table's picture and hands back the svg behind it. */
async function drawnSvg(): Promise<string> {
  const { result } = renderHook(() => useShareImage(), { wrapper });
  await act(async () => {
    await result.current.savePng('');
  });
  return renderedSvg();
}

describe('useShareImage view dispatch', () => {
  it('draws the chart card on the table view', async () => {
    seedViewTable([sumRowSeed()], { view: 'table' });

    const svg = await drawnSvg();

    expect(svg).toContain('<polyline');
    expect(svg).toContain('>Chance of each result</text>');
  });

  it('draws the target hit card instead of the chart on the target view', async () => {
    seedViewTable([sumRowSeed()], {
      view: 'target',
      target: { values: [10], ruling: 'gte' },
    });

    const svg = await drawnSvg();

    expect(svg).toContain('>CHANCE OF HITTING EACH TARGET</text>');
    expect(svg).not.toContain('>Chance of each result</text>');
  });

  it('draws the roll-off card on the rolloff view', async () => {
    seedViewTable(racerSeeds(), { view: 'rolloff' });

    const svg = await drawnSvg();

    expect(svg).toContain('>CHANCE TO WIN THE ROLL-OFF</text>');
    expect(svg).not.toContain('>Chance of each result</text>');
  });

  it('draws the head-to-head card on the matrix view', async () => {
    seedViewTable(racerSeeds(), { view: 'matrix' });

    const svg = await drawnSvg();

    expect(svg).toContain('>HEAD-TO-HEAD. ROW BEATS COLUMN</text>');
    expect(svg).not.toContain('>Chance of each result</text>');
  });
});

describe('useShareImage target sub-view', () => {
  it('draws grouped bars when the saved sub-view is bars', async () => {
    seedViewTable([sumRowSeed()], {
      view: 'target',
      target: { values: [10], ruling: 'gte' },
      targetSubView: 'bars',
    });

    const svg = await drawnSvg();

    expect(svg).toContain('>TARGET: 10 OR MORE</text>');
    expect(svg).not.toContain('>SUM ROLLS, MEASURED ON THE TOTAL</text>');
  });

  it('draws one curve a roll when the saved sub-view is curves', async () => {
    seedViewTable(racerSeeds(), {
      view: 'target',
      target: { values: [10], ruling: 'gte' },
      targetSubView: 'curves',
    });

    const svg = await drawnSvg();

    expect(countOf(svg, '<polyline')).toBe(2);
    expect(svg).not.toContain('>SUM ROLLS, MEASURED ON THE TOTAL</text>');
  });

  it('leaves the pool board out when the saved filter is sum', async () => {
    seedViewTable([sumRowSeed(), poolRowSeed('seed-pool')], {
      view: 'target',
      target: { values: [10], ruling: 'gte' },
      poolTargets: [2],
      targetFilter: 'sum',
    });

    const svg = await drawnSvg();

    expect(svg).toContain('>SUM ROLLS, MEASURED ON THE TOTAL</text>');
    expect(svg).not.toContain('>POOL ROLLS, MEASURED IN SUCCESSES</text>');
  });
});

describe('useShareImage roll-off order', () => {
  it('draws the tracks in table order when that sort is saved', async () => {
    seedViewTable(racerSeeds(), { view: 'rolloff', rollOffSort: 'table' });

    const svg = await drawnSvg();

    expect(svg).toContain('>1d6</text>');
    expect(svg).toContain('>2d6</text>');
    expect(svg.indexOf('>1d6</text>')).toBeLessThan(svg.indexOf('>2d6</text>'));
  });

  it('draws the tracks in win order when that sort is saved', async () => {
    seedViewTable(racerSeeds(), { view: 'rolloff', rollOffSort: 'win' });

    const svg = await drawnSvg();

    expect(svg).toContain('>1d6</text>');
    expect(svg).toContain('>2d6</text>');
    expect(svg.indexOf('>2d6</text>')).toBeLessThan(svg.indexOf('>1d6</text>'));
  });
});

describe('useShareImage cardState', () => {
  it('is noRows when the only roll is too complex to compute', () => {
    seedViewTable([overloadedRowSeed()], { view: 'table' });

    const { result } = renderHook(() => useShareImage(), { wrapper });

    expect(result.current.cardState).toBe('noRows');
  });

  it('is needsTwo on the roll-off with a single valid roll', () => {
    seedViewTable([sumRowSeed()], { view: 'rolloff' });

    const { result } = renderHook(() => useShareImage(), { wrapper });

    expect(result.current.cardState).toBe('needsTwo');
  });

  it('is needsTwo on the matrix with a single valid roll', () => {
    seedViewTable([sumRowSeed()], { view: 'matrix' });

    const { result } = renderHook(() => useShareImage(), { wrapper });

    expect(result.current.cardState).toBe('needsTwo');
  });

  it('is ready on the matrix once a second valid roll joins', () => {
    seedViewTable(racerSeeds(), { view: 'matrix' });

    const { result } = renderHook(() => useShareImage(), { wrapper });

    expect(result.current.cardState).toBe('ready');
  });

  it('is ready on a table with a roll to draw', () => {
    seedViewTable([sumRowSeed()], { view: 'table' });

    const { result } = renderHook(() => useShareImage(), { wrapper });

    expect(result.current.cardState).toBe('ready');
  });

  it('is ready at the chart row cap on the table view', () => {
    seedViewTable(manySumSeeds(CHART_ROW_LIMIT), { view: 'table' });

    const { result } = renderHook(() => useShareImage(), { wrapper });

    expect(result.current.cardState).toBe('ready');
  });

  it('is overLimit one roll past the chart row cap on the table view', () => {
    seedViewTable(manySumSeeds(CHART_ROW_LIMIT + 1), { view: 'table' });

    const { result } = renderHook(() => useShareImage(), { wrapper });

    expect(result.current.cardState).toBe('overLimit');
  });

  it('stays ready past the chart row cap on the target view', () => {
    seedViewTable(manySumSeeds(CHART_ROW_LIMIT + 1), {
      view: 'target',
      target: { values: [10], ruling: 'gte' },
    });

    const { result } = renderHook(() => useShareImage(), { wrapper });

    expect(result.current.cardState).toBe('ready');
  });
});
