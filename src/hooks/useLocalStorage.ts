import { useCallback, useEffect, useRef, useState } from 'react';

type Migrator<T> = (raw: unknown) => T | null;
type Validator<T> = (raw: unknown) => T | null;

interface Options<T> {
  version: number;
  migrate?: Migrator<T>;
  validate?: Validator<T>;
}

interface Envelope<T> {
  version: number;
  value: T;
}

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
  const { version, migrate, validate } = options;

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

  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    try {
      const envelope: Envelope<T> = { version, value };
      window.localStorage.setItem(key, JSON.stringify(envelope));
    } catch {
      /* quota or serialization errors are intentionally swallowed */
    }
  }, [key, version, value]);

  return [value, setValue];
}
