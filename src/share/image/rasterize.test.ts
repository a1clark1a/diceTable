import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rasterize } from './rasterize';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

// jsdom never decodes an image and has no 2d canvas, so the two browser pieces
// rasterize leans on are stood in for. The Image stub settles on the next
// microtask the way a real decode settles later, and records the src it was
// handed. The real rasterize module runs unchanged.
const seenSrcs: string[] = [];
let imageOutcome: 'load' | 'error' = 'load';

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

interface DrawCall {
  x: number;
  y: number;
  w: number;
  h: number;
}

function stubContext(drawCalls: DrawCall[] = []): void {
  const fake = {
    drawImage: (_img: CanvasImageSource, x: number, y: number, w: number, h: number) => {
      drawCalls.push({ x, y, w, h });
    },
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    // rasterize only ever calls drawImage, so a one-method fake stands in for
    // the full 2d context interface.
    fake as unknown as CanvasRenderingContext2D,
  );
}

/** Echoes whatever mime type the canvas was asked for, so the blob's type proves the request. */
function stubToBlob(): ReturnType<typeof vi.spyOn> {
  return vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((callback: BlobCallback, type?: string) => {
      callback(new Blob(['png'], type === undefined ? {} : { type }));
    });
}

beforeEach(() => {
  seenSrcs.length = 0;
  imageOutcome = 'load';
  vi.stubGlobal('Image', FakeImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('rasterize', () => {
  it('asks the canvas for a png and resolves the blob it hands back', async () => {
    stubContext();
    stubToBlob();

    const blob = await rasterize({ svg: SVG, width: 300, height: 120 });

    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(3);
  });

  // The deployed CSP allows img-src 'self' data: and nothing else, so a blob:
  // URL would be refused before the image ever decoded.
  it('loads the svg through a data url rather than an object url', async () => {
    stubContext();
    stubToBlob();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');

    await rasterize({ svg: SVG, width: 300, height: 120 });

    // encodeURIComponent: < %3C, space %20, = %3D, " %22, : %3A, / %2F, > %3E;
    // letters, digits and the dot pass through untouched.
    expect(seenSrcs).toEqual([
      'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E',
    ]);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects with the drawing message when the image cannot be decoded', async () => {
    imageOutcome = 'error';
    stubContext();
    const toBlob = stubToBlob();

    await expect(rasterize({ svg: SVG, width: 300, height: 120 })).rejects.toThrow(
      'The comparison could not be drawn.',
    );
    expect(toBlob).not.toHaveBeenCalled();
  });

  it('rejects with the drawing-surface message when there is no 2d context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const toBlob = stubToBlob();

    await expect(rasterize({ svg: SVG, width: 300, height: 120 })).rejects.toThrow(
      'This browser would not give us a drawing surface.',
    );
    expect(toBlob).not.toHaveBeenCalled();
  });

  it('rejects with the save message when the canvas produces no blob', async () => {
    stubContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback: BlobCallback) => {
        callback(null);
      },
    );

    await expect(rasterize({ svg: SVG, width: 300, height: 120 })).rejects.toThrow(
      'The image could not be saved.',
    );
  });

  // An unsized canvas is 300 by 150 in every browser, so a forgotten width or
  // height would crop or letterbox the png without any other test noticing.
  it('sizes the canvas to the image and draws the svg across all of it', async () => {
    const drawCalls: DrawCall[] = [];
    stubContext(drawCalls);
    let canvasSize: { width: number; height: number } | null = null;
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      canvasSize = { width: this.width, height: this.height };
      callback(new Blob(['png'], { type: 'image/png' }));
    });

    await rasterize({ svg: SVG, width: 300, height: 120 });

    expect(canvasSize).toEqual({ width: 300, height: 120 });
    expect(drawCalls).toEqual([{ x: 0, y: 0, w: 300, h: 120 }]);
  });
});
