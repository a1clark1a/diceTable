import { describe, expect, it } from 'vitest';
import { getUaFamily } from './uaFamily';

describe('getUaFamily', () => {
  it('maps modern Chrome UA to Chrome <major>', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(getUaFamily(ua)).toBe('Chrome 120');
  });

  it('maps Edge to Edge <major>, not Chrome, even when the UA also contains Chrome/', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.61';
    expect(getUaFamily(ua)).toBe('Edge 120');
  });

  it('maps Firefox to Firefox <major>', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; rv:121.0) Gecko/20100101 Firefox/121.0';
    expect(getUaFamily(ua)).toBe('Firefox 121');
  });

  it('maps desktop Safari to Safari <major>, not Chrome', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
      '(KHTML, like Gecko) Version/17.2 Safari/605.1.15';
    expect(getUaFamily(ua)).toBe('Safari 17');
  });

  it('returns "Other" for UAs that match none of the known families', () => {
    expect(getUaFamily('curl/8.4.0')).toBe('Other');
    expect(getUaFamily('')).toBe('Other');
  });
});
