import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSeriesFocus } from './useSeriesFocus';

describe('useSeriesFocus', () => {
  it('starts with nothing singled out', () => {
    const { result } = renderHook(() => useSeriesFocus());
    expect(result.current.focusedId).toBeNull();
    expect(result.current.pickedId).toBeNull();
  });

  it('follows a preview while nothing is picked', () => {
    const { result } = renderHook(() => useSeriesFocus());
    act(() => result.current.preview('a'));
    expect(result.current.focusedId).toBe('a');
    // A preview is not a pick, so nothing reads as pressed.
    expect(result.current.pickedId).toBeNull();
  });

  it('drops the preview when the pointer leaves', () => {
    const { result } = renderHook(() => useSeriesFocus());
    act(() => result.current.preview('a'));
    act(() => result.current.preview(null));
    expect(result.current.focusedId).toBeNull();
  });

  it('keeps a pick when the pointer moves away', () => {
    // The whole reason a pick exists: on touch there is no hover to hold, and
    // on a pointer you should be able to look at the chart without losing it.
    const { result } = renderHook(() => useSeriesFocus());
    act(() => result.current.toggle('a'));
    act(() => result.current.preview(null));
    expect(result.current.focusedId).toBe('a');
    expect(result.current.pickedId).toBe('a');
  });

  it('lets a pick win over a preview of something else', () => {
    const { result } = renderHook(() => useSeriesFocus());
    act(() => result.current.toggle('a'));
    act(() => result.current.preview('b'));
    expect(result.current.focusedId).toBe('a');
  });

  it('unpicks the same roll on a second activation', () => {
    const { result } = renderHook(() => useSeriesFocus());
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('a'));
    expect(result.current.focusedId).toBeNull();
  });

  it('moves the pick to another roll', () => {
    const { result } = renderHook(() => useSeriesFocus());
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('b'));
    expect(result.current.pickedId).toBe('b');
  });

  it('clears both, so Escape is a way out of an isolated view', () => {
    const { result } = renderHook(() => useSeriesFocus());
    act(() => result.current.toggle('a'));
    act(() => result.current.preview('b'));
    act(() => result.current.clear());
    expect(result.current.focusedId).toBeNull();
    expect(result.current.pickedId).toBeNull();
  });
});
