import { useEffect } from 'react';
import { consumeShareLinkFromHash } from '../../share/autoload';
import { useApp } from '../../state/useApp';
import { toaster } from './toaster-store';

export function useShareLinkAutoload(): void {
  const { replaceExpressions } = useApp();

  useEffect(() => {
    const result = consumeShareLinkFromHash();
    if (result === null) return;
    if (result.ok) {
      const n = result.rolls.length;
      replaceExpressions(result.rolls);
      toaster.create({
        type: 'success',
        title: `Loaded ${n === 1 ? '1 roll' : `${n} rolls`} from link`,
      });
    } else {
      toaster.create({
        type: 'error',
        title: "Couldn't read the shared link",
      });
    }
  }, [replaceExpressions]);
}
