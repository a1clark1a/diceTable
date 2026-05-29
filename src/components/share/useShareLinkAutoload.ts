import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { consumeShareLinkFromHash } from '../../share/autoload';
import { useApp } from '../../state/useApp';
import { toaster } from './toaster-store';

export function useShareLinkAutoload(): void {
  const { replaceExpressions } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

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
      if (location.pathname !== '/') {
        navigate('/', { replace: true });
      }
    } else {
      toaster.create({
        type: 'error',
        title: "Couldn't read the shared link",
      });
    }
  }, [replaceExpressions, navigate, location.pathname]);
}
