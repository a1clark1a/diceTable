import { useRef, type ReactNode } from 'react';
import { Heading, Stack, Text } from '@chakra-ui/react';
import { RollsTable } from '../components/RollsTable';
import { RollsCards } from '../components/RollsCards';
import { BaselineCaption } from '../components/baseline/BaselineCaption';
import { OverlayChart } from '../components/chart/OverlayChart';
import { TargetToolbar } from '../components/TargetToolbar';
import { TargetHitView } from '../components/target/TargetHitView';
import { RollOffView } from '../components/compare/RollOffView';
import { HeadToHeadView } from '../components/compare/HeadToHeadView';
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
      // The toolbar keeps its old slot inside a gap-3 stack so the table view
      // renders exactly as it did when RollsTable/RollsCards owned it.
      render: () => (
        <>
          <ViewBar chartRef={chartRef} />
          <Stack gap={3}>
            <TargetToolbar />
            <BaselineCaption />
            {isDesktop ? <RollsTable /> : <RollsCards />}
          </Stack>
          <OverlayChart ref={chartRef} />
        </>
      ),
    },
    {
      id: 'target',
      label: 'Target hit',
      render: () => (
        <Stack gap={3}>
          <TargetToolbar />
          <TargetHitView />
        </Stack>
      ),
    },
    {
      id: 'rolloff',
      label: 'Roll-off',
      render: () => <RollOffView />,
    },
    {
      id: 'matrix',
      label: 'Head-to-head',
      render: () => <HeadToHeadView />,
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
