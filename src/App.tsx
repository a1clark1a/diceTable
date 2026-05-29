import { lazy, Suspense } from 'react';
import { Box, Spinner } from '@chakra-ui/react';
import { Route, Routes } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Provider } from './components/ui/provider';
import { AppProvider } from './state/AppContext';
import { RollHistoryProvider } from './state/RollHistoryContext';
import TablePage from './pages/TablePage';
import NotFoundPage from './pages/NotFoundPage';
import PrivacyPage from './pages/PrivacyPage';

const DocsPage = lazy(() => import('./pages/DocsPage'));

function DocsFallback() {
  return (
    <Box py={8} display="flex" justifyContent="center">
      <Spinner />
    </Box>
  );
}

export default function App() {
  return (
    <Provider>
      <Analytics />
      <SpeedInsights />
      <ErrorBoundary storageKey="dicetable.v2">
        <AppProvider>
          <RollHistoryProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<TablePage />} />
                <Route
                  path="docs"
                  element={
                    <Suspense fallback={<DocsFallback />}>
                      <DocsPage />
                    </Suspense>
                  }
                />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </RollHistoryProvider>
        </AppProvider>
      </ErrorBoundary>
    </Provider>
  );
}
