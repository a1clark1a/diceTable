import { Box, Stack } from '@chakra-ui/react';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RollsTable } from './components/RollsTable';
import { RollsCards } from './components/RollsCards';
import { OverlayChart } from './components/chart/OverlayChart';
import { Provider } from './components/ui/provider';
import { AppProvider } from './state/AppContext';
import { RollHistoryProvider } from './state/RollHistoryContext';

export default function App() {
  return (
    <Provider>
      <ErrorBoundary storageKey="dicetable.v2">
        <AppProvider>
          <RollHistoryProvider>
            <AppShell>
              <Stack gap={{ base: 4, md: 6 }}>
                <Box display={{ base: 'none', md: 'block' }}>
                  <RollsTable />
                </Box>
                <Box display={{ base: 'block', md: 'none' }}>
                  <RollsCards />
                </Box>
                <OverlayChart />
              </Stack>
            </AppShell>
          </RollHistoryProvider>
        </AppProvider>
      </ErrorBoundary>
    </Provider>
  );
}
