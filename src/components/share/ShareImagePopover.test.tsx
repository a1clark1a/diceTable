import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { SCHEMA_VERSION } from '../../state/persistedSchema';
import { ShareImagePopover } from './ShareImagePopover';

// The popover positioner watches its anchor for size changes, and jsdom has
// no ResizeObserver to watch with.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

const STORAGE_KEY = 'dicetable.v2';
const ENVELOPE_VERSION = 2;
const DATA_URL_PREFIX = 'data:image/svg+xml;charset=utf-8,';
const TRIGGER_NAME = 'Share the comparison as an image';

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

function renderPopover(): void {
  render(
    <ChakraProvider value={defaultSystem}>
      <AppProvider>
        <ShareImagePopover />
      </AppProvider>
    </ChakraProvider>,
  );
}

function trigger(): HTMLElement {
  return screen.getByRole('button', { name: TRIGGER_NAME });
}

// The popover reports its open state on a microtask after the click, so the
// body is awaited rather than read straight after the event.
async function openPopover(): Promise<void> {
  fireEvent.click(trigger());
  await screen.findByRole('textbox', { name: 'Image title' });
}

// jsdom ships no share, so tests put it on the navigator directly and take it
// off again afterwards.
const patchedNavigatorKeys: string[] = [];
function patchNavigator(key: string, value: unknown): void {
  Object.defineProperty(navigator, key, { configurable: true, writable: true, value });
  patchedNavigatorKeys.push(key);
}

// jsdom never loads an image and has no 2d canvas, so the two browser pieces
// rasterize leans on are stood in for: an Image that loads on the next
// microtask and records the src it was handed, and a canvas whose toBlob
// records its size and hands back a png-typed blob. The real rasterize module
// still runs.
const seenSrcs: string[] = [];
let canvasSize: { width: number; height: number } | null = null;
let clickSpy: ReturnType<typeof vi.spyOn>;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private srcValue = '';
  set src(value: string) {
    this.srcValue = value;
    seenSrcs.push(value);
    queueMicrotask(() => this.onload?.());
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

beforeEach(() => {
  seenSrcs.length = 0;
  canvasSize = null;
  vi.stubGlobal('Image', FakeImage);
  // rasterize only ever calls drawImage, so a one-method fake stands in for
  // the full 2d context interface.
  const fakeContext = { drawImage: () => {} } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    canvasSize = { width: this.width, height: this.height };
    callback(new Blob(['png bytes'], { type: 'image/png' }));
  });
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:popover');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  for (const key of patchedNavigatorKeys.splice(0)) {
    Reflect.deleteProperty(navigator, key);
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('ShareImagePopover trigger', () => {
  it('is disabled on an empty table', () => {
    renderPopover();
    expect(trigger()).toBeDisabled();
  });

  it('is enabled once the table has a row it can draw', () => {
    seedTable([sumRowSeed()]);
    renderPopover();
    expect(trigger()).not.toBeDisabled();
  });
});

describe('ShareImagePopover body', () => {
  it('offers a title field capped at the picture heading budget', async () => {
    seedTable([sumRowSeed()]);
    renderPopover();

    await openPopover();

    const field = screen.getByRole('textbox', { name: 'Image title' });
    expect(field).toHaveAttribute('placeholder', 'Optional');
    expect(field).toHaveAttribute('maxlength', '70');
  });

  // Desktop browsers mostly cannot share files; a Share button there would be
  // a dead click followed by a download nobody asked for.
  it('offers copy and save but no share button when the browser has no share sheet', async () => {
    seedTable([sumRowSeed()]);
    renderPopover();

    await openPopover();

    expect(screen.getByRole('button', { name: 'Copy image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save PNG' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    expect(
      screen.getByText('Copying puts the link on the clipboard too, so either one pastes.'),
    ).toBeInTheDocument();
  });

  it('adds a share button when the browser can share files', async () => {
    seedTable([sumRowSeed()]);
    patchNavigator('share', vi.fn());
    patchNavigator('canShare', vi.fn().mockReturnValue(true));
    renderPopover();

    await openPopover();

    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save PNG' })).toBeInTheDocument();
  });
});

describe('ShareImagePopover copy', () => {
  // Copy and Save sit next to each other in the same list, so the copy button
  // has to reach the clipboard without also starting a download.
  it('writes to the clipboard, downloads nothing, and closes the popover', async () => {
    seedTable([sumRowSeed()]);
    // What the item holds is checked in the hook and clipboard tests; here the
    // browser only has to accept one being built.
    vi.stubGlobal('ClipboardItem', class {});
    const write = vi.fn<(items: readonly unknown[]) => Promise<void>>().mockResolvedValue(
      undefined,
    );
    patchNavigator('clipboard', { write });
    renderPopover();
    await openPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Copy image' }));

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'));
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe('ShareImagePopover save', () => {
  it('downloads once and closes the popover', async () => {
    seedTable([sumRowSeed()]);
    renderPopover();
    await openPopover();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Save PNG' }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'));
  });

  // The card is 920 wide and, with a title band over one row, 438 + 42 + 46 =
  // 526 tall; the png is drawn at double scale, so 1840 by 1052.
  it('puts the typed title in the picture at double scale', async () => {
    seedTable([sumRowSeed()]);
    renderPopover();
    await openPopover();
    fireEvent.change(screen.getByRole('textbox', { name: 'Image title' }), {
      target: { value: 'Weapon pass' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save PNG' }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(renderedSvg()).toContain('>Weapon pass</text>');
    expect(canvasSize).toEqual({ width: 1840, height: 1052 });
  });
});
