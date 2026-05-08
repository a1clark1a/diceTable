import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

interface UseBufferedValueOptions<T> {
  committed: T;
  commit: (value: T) => void;
  parse: (raw: string) => T;
  format: (value: T) => string;
}

interface UseBufferedValueReturn {
  value: string;
  setValue: (raw: string) => void;
  onBlur: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function useBufferedValue<T>({
  committed,
  commit,
  parse,
  format,
}: UseBufferedValueOptions<T>): UseBufferedValueReturn {
  const [buffer, setBuffer] = useState<string>(() => format(committed));
  const dirtyRef = useRef(false);
  const lastCommittedRef = useRef<T>(committed);

  useEffect(() => {
    if (Object.is(lastCommittedRef.current, committed)) return;
    lastCommittedRef.current = committed;
    if (!dirtyRef.current) {
      setBuffer(format(committed));
    }
  }, [committed, format]);

  const setValue = useCallback((raw: string) => {
    dirtyRef.current = true;
    setBuffer(raw);
  }, []);

  const commitNow = useCallback(() => {
    if (!dirtyRef.current) return;
    const parsed = parse(buffer);
    dirtyRef.current = false;
    setBuffer(format(parsed));
    commit(parsed);
  }, [buffer, commit, parse, format]);

  const revert = useCallback(() => {
    dirtyRef.current = false;
    setBuffer(format(committed));
  }, [committed, format]);

  const onBlur = useCallback(() => {
    commitNow();
  }, [commitNow]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitNow();
        e.currentTarget.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        revert();
        e.currentTarget.blur();
      }
    },
    [commitNow, revert],
  );

  return { value: buffer, setValue, onBlur, onKeyDown };
}
