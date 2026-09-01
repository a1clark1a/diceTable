import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from './download';

function pngBlob(): Blob {
  return new Blob(['not really a png'], { type: 'image/png' });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('downloadBlob', () => {
  it('clicks a link that saves the blob under the given name', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const blob = pngBlob();

    downloadBlob(blob, 'dicetable-2024-01-05.png');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]?.[0]).toBe(blob);
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = appendChild.mock.calls[0]?.[0] as HTMLAnchorElement | undefined;
    expect(anchor?.tagName).toBe('A');
    expect(anchor!.download).toBe('dicetable-2024-01-05.png');
    expect(anchor!.getAttribute('href')).toBe('blob:fake-url');
  });

  it('leaves no link behind in the document', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(pngBlob(), 'dicetable.png');

    expect(document.querySelectorAll('a')).toHaveLength(0);
  });

  it('releases the object url once the click has gone through', () => {
    vi.useFakeTimers();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(pngBlob(), 'dicetable.png');
    expect(revoke).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:fake-url');
  });
});
