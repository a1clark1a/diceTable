import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canShareImage,
  copyImageWithLink,
  shareImage,
  shareImageFilename,
} from './clipboard';

const LINK = 'https://dice-table.app/#r=abc';

function pngBlob(): Blob {
  return new Blob(['not really a png'], { type: 'image/png' });
}

// jsdom ships no clipboard, no share and no ClipboardItem, so every test that
// needs one puts it on the global itself and takes it off again afterwards.
const patchedNavigatorKeys: string[] = [];

function patchNavigator(key: string, value: unknown): void {
  Object.defineProperty(navigator, key, { configurable: true, writable: true, value });
  patchedNavigatorKeys.push(key);
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

afterEach(() => {
  for (const key of patchedNavigatorKeys.splice(0)) {
    Reflect.deleteProperty(navigator, key);
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('shareImageFilename', () => {
  it('names the file after the date it was made', () => {
    expect(shareImageFilename(new Date(2024, 0, 5))).toBe('dicetable-2024-01-05.png');
  });

  it('pads a single digit month and day to two digits', () => {
    expect(shareImageFilename(new Date(2024, 8, 9))).toBe('dicetable-2024-09-09.png');
  });

  it('keeps the last day of December in its own year', () => {
    expect(shareImageFilename(new Date(2023, 11, 31))).toBe('dicetable-2023-12-31.png');
  });

  it('pads a year shorter than four digits', () => {
    expect(shareImageFilename(new Date(999, 0, 1))).toBe('dicetable-0999-01-01.png');
  });

  // Both ends of one midnight. Whichever way this runner's clock sits against
  // UTC, one of the two lands on the wrong calendar day if the name is ever
  // built from a UTC date instead of the one the user is looking at.
  it('uses the calendar date the user sees, not the UTC one', () => {
    expect(shareImageFilename(new Date(2023, 11, 31, 23, 30))).toBe('dicetable-2023-12-31.png');
    expect(shareImageFilename(new Date(2024, 0, 1, 0, 30))).toBe('dicetable-2024-01-01.png');
  });

  it('falls back to today when no date is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 2, 7, 13, 45));
    expect(shareImageFilename()).toBe('dicetable-2024-03-07.png');
  });
});

describe('copyImageWithLink', () => {
  it('reports failure when the browser has no ClipboardItem', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    patchNavigator('clipboard', { write });
    expect(await copyImageWithLink(pngBlob(), LINK)).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it('reports failure when the browser has no clipboard at all', async () => {
    stubClipboardItem();
    expect(await copyImageWithLink(pngBlob(), LINK)).toBe(false);
  });

  it('reports failure when the clipboard cannot be written to', async () => {
    stubClipboardItem();
    patchNavigator('clipboard', { readText: () => Promise.resolve('') });
    expect(await copyImageWithLink(pngBlob(), LINK)).toBe(false);
  });

  it('reports failure when the browser refuses the write', async () => {
    stubClipboardItem();
    const write = vi.fn().mockRejectedValue(new Error('not allowed'));
    patchNavigator('clipboard', { write });
    expect(await copyImageWithLink(pngBlob(), LINK)).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('reports success once the browser takes the write', async () => {
    stubClipboardItem();
    const write = vi.fn().mockResolvedValue(undefined);
    patchNavigator('clipboard', { write });
    expect(await copyImageWithLink(pngBlob(), LINK)).toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('puts the picture and the link in one clipboard item', async () => {
    const captured = stubClipboardItem();
    const write = vi.fn().mockResolvedValue(undefined);
    patchNavigator('clipboard', { write });
    const blob = pngBlob();

    await copyImageWithLink(blob, LINK);

    expect(captured).toHaveLength(1);
    const flavours = captured[0]!.flavours;
    expect(Object.keys(flavours)).toEqual(['image/png', 'text/plain']);
    expect(flavours['image/png']).toBe(blob);
    const textFlavour = flavours['text/plain'];
    if (!(textFlavour instanceof Blob)) throw new Error('link flavour should be a Blob');
    expect(textFlavour.type).toBe('text/plain');
    expect(await textFlavour.text()).toBe(LINK);
  });

  // Safari revokes clipboard access once the click's user activation expires,
  // so the write has to be on its way before the picture exists.
  it('starts the write immediately when handed a picture still rendering', async () => {
    const captured = stubClipboardItem();
    const write = vi.fn().mockResolvedValue(undefined);
    patchNavigator('clipboard', { write });
    let resolveBlob: (blob: Blob) => void = () => {};
    const pending = new Promise<Blob>((resolve) => {
      resolveBlob = resolve;
    });

    const result = copyImageWithLink(pending, LINK);

    expect(write).toHaveBeenCalledTimes(1);
    expect(captured[0]!.flavours['image/png']).toBe(pending);

    resolveBlob(pngBlob());
    expect(await result).toBe(true);
  });

  it('writes exactly one item to the clipboard', async () => {
    const captured = stubClipboardItem();
    const write = vi.fn().mockResolvedValue(undefined);
    patchNavigator('clipboard', { write });

    await copyImageWithLink(pngBlob(), LINK);

    expect(write).toHaveBeenCalledTimes(1);
    const items = write.mock.calls[0]?.[0] as unknown[];
    expect(items).toHaveLength(1);
    expect(items[0]).toBe(captured[0]);
  });
});

describe('canShareImage', () => {
  it('reports false when the browser cannot share', () => {
    expect(canShareImage(pngBlob(), 'dicetable.png')).toBe(false);
  });

  it('reports false when the browser cannot be asked about files', () => {
    patchNavigator('share', vi.fn());
    expect(canShareImage(pngBlob(), 'dicetable.png')).toBe(false);
  });

  it('reports true when the browser accepts the file', () => {
    patchNavigator('share', vi.fn());
    patchNavigator('canShare', vi.fn().mockReturnValue(true));
    expect(canShareImage(pngBlob(), 'dicetable.png')).toBe(true);
  });

  it('reports false when the browser turns the file down', () => {
    patchNavigator('share', vi.fn());
    patchNavigator('canShare', vi.fn().mockReturnValue(false));
    expect(canShareImage(pngBlob(), 'dicetable.png')).toBe(false);
  });

  it('reports false when asking throws', () => {
    patchNavigator('share', vi.fn());
    patchNavigator(
      'canShare',
      vi.fn(() => {
        throw new Error('nope');
      }),
    );
    expect(canShareImage(pngBlob(), 'dicetable.png')).toBe(false);
  });

  it('asks about a png file under the given name', async () => {
    const canShare = vi.fn().mockReturnValue(true);
    patchNavigator('share', vi.fn());
    patchNavigator('canShare', canShare);
    const blob = pngBlob();

    canShareImage(blob, 'dicetable-2024-01-05.png');

    const data = canShare.mock.calls[0]?.[0] as { files: File[] };
    expect(data.files).toHaveLength(1);
    expect(data.files[0]!.name).toBe('dicetable-2024-01-05.png');
    expect(data.files[0]!.type).toBe('image/png');
    expect(await data.files[0]!.text()).toBe(await blob.text());
  });
});

describe('shareImage', () => {
  it('reports failed when the browser cannot share', async () => {
    expect(await shareImage(pngBlob(), 'dicetable.png', LINK)).toBe('failed');
  });

  it('hands the share sheet the file and the link together', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    patchNavigator('share', share);

    const blob = pngBlob();

    expect(await shareImage(blob, 'dicetable.png', LINK)).toBe('shared');
    const data = share.mock.calls[0]?.[0] as { files: File[]; text: string };
    expect(data.files).toHaveLength(1);
    expect(data.files[0]!.name).toBe('dicetable.png');
    expect(data.files[0]!.type).toBe('image/png');
    expect(await data.files[0]!.text()).toBe(await blob.text());
    expect(data.text).toBe(LINK);
  });

  it('reports cancelled when the share sheet is dismissed', async () => {
    const abort = Object.assign(new Error('Share canceled'), { name: 'AbortError' });
    patchNavigator('share', vi.fn().mockRejectedValue(abort));
    expect(await shareImage(pngBlob(), 'dicetable.png', LINK)).toBe('cancelled');
  });

  it('reports failed when sharing breaks for any other reason', async () => {
    patchNavigator('share', vi.fn().mockRejectedValue(new Error('boom')));
    expect(await shareImage(pngBlob(), 'dicetable.png', LINK)).toBe('failed');
  });
});

