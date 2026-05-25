import { useCallback, useEffect, useRef, useState } from 'react';

type Migrator<T> = (raw: unknown) => T | null;
type Validator<T> = (raw: unknown) => T | null;

interface Options<T> {
  version: number;
  migrate?: Migrator<T>;
  validate?: Validator<T>;
  onWriteError?: (err: unknown) => void;
}

interface Envelope<T> {
  version: number;
  value: T;
}

const DEBOUNCE_MS = 200;

function isEnvelope(raw: unknown): raw is Envelope<unknown> {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'version' in raw &&
    'value' in raw &&
    typeof (raw as { version: unknown }).version === 'number'
  );
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: Options<T>,
): [T, (value: T | ((prev: T) => T)) => void] {
  const { version, migrate, validate, onWriteError } = options;

  const read = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initialValue;
      const parsed: unknown = JSON.parse(raw);

      if (isEnvelope(parsed) && parsed.version === version) {
        if (validate) {
          const validated = validate(parsed.value);
          return validated ?? initialValue;
        }
        return parsed.value as T;
      }

      if (migrate) {
        const migrated = migrate(parsed);
        if (migrated !== null) return migrated;
      }

      return initialValue;
    } catch {
      return initialValue;
    }
  }, [key, version, migrate, validate, initialValue]);

  const [value, setValue] = useState<T>(read);

  const latestValueRef = useRef(value);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    latestValueRef.current = value;

    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    const id = setTimeout(() => {
      pendingTimerRef.current = null;
      try {
        const envelope: Envelope<T> = { version, value: latestValueRef.current };
        window.localStorage.setItem(key, JSON.stringify(envelope));
      } catch (err) {
        onWriteError?.(err);
      }
    }, DEBOUNCE_MS);
    pendingTimerRef.current = id;

    return () => {
      clearTimeout(id);
      if (pendingTimerRef.current === id) {
        pendingTimerRef.current = null;
      }
    };
  }, [key, version, value, onWriteError]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const flush = () => {
      const id = pendingTimerRef.current;
      if (id === null) return;
      clearTimeout(id);
      pendingTimerRef.current = null;
      try {
        const envelope: Envelope<T> = { version, value: latestValueRef.current };
        window.localStorage.setItem(key, JSON.stringify(envelope));
      } catch (err) {
        onWriteError?.(err);
      }
    };

    // beforeunload is best-effort on mobile Safari and on a hard browser kill;
    // worst case the user loses an edit made within the last 200 ms of closing.
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
    };
  }, [key, version, onWriteError]);

  return [value, setValue];
}
