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
import { WorkshopToolbar } from '../components/WorkshopToolbar';
import { WorkshopViewSwitcher } from '../components/WorkshopViewSwitcher';
import { StartExamplesPanel } from '../components/presets/StartExamplesPanel';
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
  const { expressions, view, setView } = useApp();

  const registry: WorkshopViewEntry[] = [
    {
      id: 'table',
      label: 'Table & chart',
      mobileLabel: 'Rolls',
      // The target row keeps its old slot inside a gap-3 stack so the table
      // view renders exactly as it did when RollsTable/RollsCards owned it.
      render: () => (
        <>
          <WorkshopToolbar chartRef={chartRef} />
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
      mobileLabel: 'Target',
      render: () => (
        <>
          <WorkshopToolbar />
          <Stack gap={3}>
            <TargetToolbar />
            <TargetHitView />
          </Stack>
        </>
      ),
    },
    {
      id: 'rolloff',
      label: 'Roll-off',
      render: () => (
        <>
          <WorkshopToolbar />
          <RollOffView />
        </>
      ),
    },
    {
      id: 'matrix',
      label: 'Head-to-head',
      mobileLabel: 'Versus',
      render: () => (
        <>
          <WorkshopToolbar />
          <HeadToHeadView />
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
        <Heading as="h1" size={{ base: 'md', md: 'xl' }} letterSpacing="tight">
          Compare dice rolls side by side
        </Heading>
        <Text
          fontSize={{ base: 'xs', md: 'sm' }}
          color="fg.muted"
          maxW="620px"
          // Two lines is the whole pitch on a phone; the rest is chrome
          // standing between the reader and the first roll.
          lineClamp={{ base: 2, md: 'none' }}
          css={{ textWrap: 'pretty' }}
        >
          Build a table of named rolls, set a target number, and see the exact
          probability for every result on one chart.
        </Text>
      </Stack>
      <WorkshopViewSwitcher
        views={registry}
        active={active.id}
        onSelect={setView}
      />
      {expressions.length === 0 ? <StartExamplesPanel /> : active.render()}
    </Stack>
  );
}
