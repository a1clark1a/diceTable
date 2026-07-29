import { useRef, type ReactNode } from 'react';
import { Heading, Stack, Text } from '@chakra-ui/react';
import { RollsTable } from '../components/RollsTable';
import { RollsCards } from '../components/RollsCards';
import { OverlayChart } from '../components/chart/OverlayChart';
import { ViewBar } from '../components/ViewBar';
import { WorkshopHeader } from '../components/WorkshopHeader';
import type { WorkshopViewChip } from '../components/WorkshopViewSwitcher';
import { RouteHead } from '../components/seo/RouteHead';
import { useIsDesktop } from '../hooks/useBreakpoint';
import { useApp } from '../state/useApp';

interface WorkshopViewEntry extends WorkshopViewChip {
  render: () => ReactNode;
}

export default function TablePage() {
  const isDesktop = useIsDesktop();
  const chartRef = useRef<HTMLDivElement>(null);
  const { view, setView } = useApp();

  const registry: WorkshopViewEntry[] = [
    {
      id: 'table',
      label: 'Table & chart',
      mobileLabel: 'Rolls',
      render: () => (
        <>
          <ViewBar chartRef={chartRef} />
          {isDesktop ? <RollsTable /> : <RollsCards />}
          <OverlayChart ref={chartRef} />
        </>
      ),
    },
  ];

  const active = registry.find((v) => v.id === view) ?? registry[0]!;

  return (
    <Stack gap={{ base: 4, md: 6 }}>
      <RouteHead
        title="DiceTable — Dice probability comparison for tabletop gaming"
        description="Compare named dice rolls side by side. Build a table of expressions, set a target, and read the math behind every distribution."
        path="/"
      />
      <Stack gap={1}>
        <Heading as="h1" size={{ base: 'lg', md: 'xl' }} letterSpacing="tight">
          Compare dice rolls side by side
        </Heading>
        <Text color="fg.muted">
          Build a table of named rolls, set a target number, and see the exact
          probability for every result on one chart.
        </Text>
      </Stack>
      <WorkshopHeader
        views={registry}
        activeView={active.id}
        onSelectView={setView}
      />
      {active.render()}
    </Stack>
  );
}
