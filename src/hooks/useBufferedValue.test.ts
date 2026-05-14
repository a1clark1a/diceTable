import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { useBufferedValue } from './useBufferedValue';

function parseInteger(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

interface RenderOpts<T> {
  committed: T;
  commit: (value: T) => void;
  parse: (raw: string) => T;
  format: (value: T) => string;
}

function renderBuffered<T>(initial: RenderOpts<T>) {
  const props = { ...initial };
  const { result, rerender } = renderHook(
    (p: RenderOpts<T>) => useBufferedValue<T>(p),
    { initialProps: props },
  );
  return {
    result,
    rerender: (next: Partial<RenderOpts<T>>) =>
      rerender({ ...props, ...next }),
  };
}

function keyEvent(key: string): KeyboardEvent<HTMLInputElement> {
  const target = { blur: vi.fn() };
  return {
    key,
    preventDefault: vi.fn(),
    currentTarget: target as unknown as HTMLInputElement,
  } as unknown as KeyboardEvent<HTMLInputElement>;
}

describe('useBufferedValue', () => {
  it('formats the initial committed value', () => {
    const { result } = renderBuffered<number>({
      committed: 7,
      commit: vi.fn(),
      parse: parseInteger,
      format: String,
    });
    expect(result.current.value).toBe('7');
  });

  it('does not commit while only setValue is called', () => {
    const commit = vi.fn();
    const { result } = renderBuffered<number>({
      committed: 3,
      commit,
      parse: parseInteger,
      format: String,
    });
    act(() => result.current.setValue('5'));
    act(() => result.current.setValue('50'));
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.value).toBe('50');
  });

  it('commits the parsed value on blur', () => {
    const commit = vi.fn();
    const { result } = renderBuffered<number>({
      committed: 3,
      commit,
      parse: parseInteger,
      format: String,
    });
    act(() => result.current.setValue('5'));
    act(() => result.current.onBlur());
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(5);
  });

  it('does not re-commit on blur when nothing has changed', () => {
    const commit = vi.fn();
    const { result } = renderBuffered<number>({
      committed: 3,
      commit,
      parse: parseInteger,
      format: String,
    });
    act(() => result.current.onBlur());
    act(() => result.current.onBlur());
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits on Enter and blurs the input', () => {
    const commit = vi.fn();
    const { result } = renderBuffered<number>({
      committed: 3,
      commit,
      parse: parseInteger,
      format: String,
    });
    act(() => result.current.setValue('9'));
    const enterEvent = keyEvent('Enter');
    act(() => result.current.onKeyDown(enterEvent));
    expect(commit).toHaveBeenCalledWith(9);
    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect((enterEvent.currentTarget as unknown as { blur: () => void }).blur)
      .toHaveBeenCalled();
  });

  it('reverts the buffer on Escape without calling commit', () => {
    const commit = vi.fn();
    const { result } = renderBuffered<number>({
      committed: 3,
      commit,
      parse: parseInteger,
      format: String,
    });
    act(() => result.current.setValue('99'));
    expect(result.current.value).toBe('99');
    const escapeEvent = keyEvent('Escape');
    act(() => result.current.onKeyDown(escapeEvent));
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.value).toBe('3');
  });

  it('ignores unrelated keys', () => {
    const commit = vi.fn();
    const { result } = renderBuffered<number>({
      committed: 3,
      commit,
      parse: parseInteger,
      format: String,
    });
    act(() => result.current.setValue('9'));
    act(() => result.current.onKeyDown(keyEvent('a')));
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.value).toBe('9');
  });

  it('reflects external committed changes when the buffer is clean', () => {
    const { result, rerender } = renderBuffered<number>({
      committed: 3,
      commit: vi.fn(),
      parse: parseInteger,
      format: String,
    });
    rerender({ committed: 8 });
    expect(result.current.value).toBe('8');
  });

  it('does not clobber the user-typed buffer when committed changes mid-edit', () => {
    const { result, rerender } = renderBuffered<number>({
      committed: 3,
      commit: vi.fn(),
      parse: parseInteger,
      format: String,
    });
    act(() => result.current.setValue('42'));
    rerender({ committed: 8 });
    expect(result.current.value).toBe('42');
  });

  it('re-syncs from committed after a successful commit', () => {
    const commit = vi.fn();
    const { result } = renderBuffered<number>({
      committed: 3,
      commit,
      parse: parseInteger,
      format: String,
    });
    act(() => result.current.setValue('15abc'));
    act(() => result.current.onBlur());
    expect(commit).toHaveBeenCalledWith(15);
    expect(result.current.value).toBe('15');
  });

  it('treats empty input as the parser-defined fallback (0 here)', () => {
    const commit = vi.fn();
    const { result } = renderBuffered<number>({
      committed: 3,
      commit,
      parse: parseInteger,
      format: String,
    });
    act(() => result.current.setValue(''));
    act(() => result.current.onBlur());
    expect(commit).toHaveBeenCalledWith(0);
  });
});
