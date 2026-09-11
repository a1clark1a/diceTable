import { useRef, type ReactNode } from 'react';
import { Box, Flex, Grid, Heading, Stack, Text } from '@chakra-ui/react';
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
import { RowActions } from '../components/RowActions';
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
          <Grid
            flex="1"
            minH={0}
            gap={{ base: 4, xl: 6 }}
            alignItems="stretch"
            templateColumns={{
              base: '1fr',
              xl: 'minmax(0, 1fr) minmax(300px, 340px)',
              '2xl': 'minmax(0, 1fr) 400px',
            }}
          >
            <Stack gap={3} minW={0} minH={0} overflowY={{ xl: 'auto' }}>
              <TargetToolbar />
              <Flex
                gap={3}
                rowGap={2}
                align="center"
                justify="space-between"
                wrap="wrap"
                minH="48px"
              >
                <BaselineCaption />
                <RowActions />
              </Flex>
              {isDesktop ? <RollsTable /> : <RollsCards />}
            </Stack>
            <Box minW={0} minH={0} overflowY={{ xl: 'auto' }}>
              <OverlayChart ref={chartRef} />
            </Box>
          </Grid>
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
          <Stack gap={3} align="flex-start">
            <RowActions />
            <RollOffView />
          </Stack>
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
          <Stack gap={3} align="flex-start">
            <RowActions />
            <HeadToHeadView />
          </Stack>
        </>
      ),
    },
  ];

  const active = registry.find((v) => v.id === view) ?? registry[0]!;

  return (
    <Stack gap={{ base: 4, md: 6 }} flex="1" minH={0}>
      <RouteHead
        title="DiceTable — Dice probability comparison for tabletop gaming"
        description="Compare named dice rolls side by side. Build a table of expressions, set a target, and read the math behind every distribution."
        path="/"
      />
      {/* srOnly rather than a conditional: the h1 stays mounted whatever the
          table holds, so / never loses its only heading. */}
      <Stack gap={1} srOnly={expressions.length > 0}>
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
