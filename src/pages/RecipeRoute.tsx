import { useCallback } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { toaster } from '../components/share/toaster-store';
import { findRecipePage } from '../presets/recipePages';
import { hasShareLinkHash } from '../share/autoload';
import { SeededAppProvider } from '../state/AppContext';
import { RollHistoryProvider } from '../state/RollHistoryContext';
import { useApp } from '../state/useApp';
import { MAX_EXPRESSIONS, type Expression } from '../types';
import NotFoundPage from './NotFoundPage';
import TablePage from './TablePage';

/**
 * A recipe page is the real table holding the recipe's rows, but those rows
 * live in a table of their own: the visitor's saved one is neither read into
 * the page nor written by it until they ask. The shell sits inside that table
 * too, so Share, Import and the image export all act on what is on screen.
 */
export default function RecipeRoute() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const own = useApp();
  const ownCount = own.expressions.length;
  const { addExpressions } = own;
  const page = findRecipePage(slug);

  const openInTable = useCallback(
    (rows: Expression[]) => {
      // addExpressions reports a full or partly full table itself; only the
      // case it stays quiet about needs saying here.
      if (rows.length > 0 && rows.length <= MAX_EXPRESSIONS - ownCount) {
        toaster.create({
          type: 'success',
          title: rows.length === 1 ? 'Added 1 roll to your table' : `Added ${rows.length} rolls to your table`,
          ...(ownCount > 0 ? { description: 'They are at the bottom, after your own rolls.' } : {}),
        });
      }
      addExpressions(rows);
      navigate('/');
    },
    [addExpressions, ownCount, navigate],
  );

  // A share link carries a whole table, and it belongs in the visitor's own.
  // Loaded here, it would land in the recipe's table and vanish on the way out.
  if (hasShareLinkHash(location.hash)) {
    return <Navigate to={{ pathname: '/', hash: location.hash }} replace />;
  }

  if (page === undefined) {
    return (
      <AppShell>
        <NotFoundPage />
      </AppShell>
    );
  }

  return (
    // Keyed by slug so moving between recipes starts each from its own rows.
    <SeededAppProvider
      key={page.slug}
      seed={{
        rows: page.recipe.rows,
        ...(page.target ? { target: page.target } : {}),
        ...(page.poolTargets ? { poolTargets: page.poolTargets } : {}),
      }}
    >
      <RollHistoryProvider>
        <AppShell ownTableHasRows={ownCount > 0}>
          <TablePage recipe={{ page, onOpen: openInTable }} />
        </AppShell>
      </RollHistoryProvider>
    </SeededAppProvider>
  );
}
