import { useRef, useState, type ReactNode } from 'react';
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
import { RollModeControl } from '../components/RollModeControl';
import { RailSplitter, RAIL_MIN, TABLE_WIDTH } from '../components/layout/RailSplitter';
import { ScrollButtons } from '../components/ScrollButtons';
import { ChartViewChips } from '../components/chart/ChartViewChips';
import {
  effectiveChartView,
  targetViewAvailable,
} from '../components/chart/effectiveView';
import type { WorkshopViewChip } from '../components/WorkshopViewSwitcher';
import { RouteHead } from '../components/seo/RouteHead';
import { useTableFits } from '../hooks/useBreakpoint';
import { useApp } from '../state/useApp';

interface WorkshopViewEntry extends WorkshopViewChip {
  render: () => ReactNode;
}

/**
 * Roll mode feeds expressionDistribution, so it moves every number Roll-off and
 * Head-to-head draw. The toolbar that used to carry it on desktop is mobile-only
 * now, which left it changing these two views while being uneditable from them.
 * Scroll-to-top left with the same toolbar, and both of these views can run long.
 */
function CompareActions() {
  return (
    <Flex
      gap={4}
      rowGap={2}
      align="center"
      wrap="wrap"
      w="100%"
      minH="48px"
      // These two views have no inner scroller at any width, so main is the
      // only thing that moves and this row has to be pinned to survive a long
      // one. No 2xl step for that reason: unlike the table's caption row,
      // nothing here ever stops travelling. Static below md, where the mobile
      // toolbar already holds top:0 and this row's controls are hidden anyway.
      position={{ base: 'static', md: 'sticky' }}
      top={0}
      zIndex={2}
      bg="bg"
    >
      <RowActions />
      {/* Below md the sticky toolbar's overflow menu already holds it, so a
          second copy here would spend a line of a phone screen on a duplicate. */}
      <Box display={{ base: 'none', md: 'contents' }}>
        <RollModeControl />
      </Box>
      <Box flex="1" minW={0} />
      <ScrollButtons display={{ base: 'none', md: 'inline-flex' }} />
    </Flex>
  );
}

export default function TablePage() {
  const tableFits = useTableFits();
  const chartRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tableColRef = useRef<HTMLDivElement>(null);
  // Session-only: a remembered pixel width is wrong the moment the viewport
  // changes, so this resets with the tab rather than persisting.
  const [tableWidth, setTableWidth] = useState(TABLE_WIDTH);
  const { expressions, view, setView, chartViews, target } = useApp();
  // The shape column is the surface this line's chips drive, and it can offer
  // the target view whenever any row has something to measure against.
  const shapeHasTarget = targetViewAvailable(target, expressions);

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
            ref={gridRef}
            flex="1"
            minH={0}
            gap={{ base: 4, '2xl': 0 }}
            alignItems="stretch"
            // Capping the table rather than letting it fill a 1fr track is what
            // hands the surplus to the chart. Past its own content width the
            // table only pads its columns, so the width is worth more here.
            // The dragged width rides a custom property rather than being
            // interpolated into the template. Interpolating makes emotion mint
            // and inject a new rule for every pixel of a drag, so the
            // stylesheet grows for the length of the gesture; the property is
            // data, and the rule stays one rule.
            style={{ ['--dt-table-w' as string]: `${tableWidth}px` }}
            templateColumns={{
              base: '1fr',
              '2xl': `minmax(0, var(--dt-table-w)) auto minmax(${RAIL_MIN}px, 1fr)`,
            }}
            // Stacked, the two implicit rows would share the page's leftover
            // height equally and strand half of it under the chart card, where
            // it reads as a very tall footer. Naming the tracks gives all of it
            // to the rolls instead; the chart keeps its own height.
            templateRows={{ base: '1fr auto', '2xl': 'none' }}
          >
            {/* The column itself no longer scrolls: the table box inside it
                does, so the parameters row and the row actions stay in place
                while the rolls move under them. */}
            <Stack ref={tableColRef} gap={3} minW={0} minH={0}>
              <TargetToolbar />
              <Flex
                gap={3}
                rowGap={2}
                align="center"
                justify="space-between"
                wrap="wrap"
                minH="48px"
                // Below md the sticky toolbar already holds top:0 and this band
                // carries nothing but the caption; at 2xl the rolls scroll
                // inside the table box so it never moves. In between, the page
                // itself scrolls and this is the row you need to keep.
                position={{ base: 'static', md: 'sticky', '2xl': 'static' }}
                top={0}
                zIndex={2}
                bg="bg"
              >
                <BaselineCaption />
                <Flex gap={2} align="center" ms="auto">
                  {/* Below md the sticky toolbar carries these instead. While
                      the cards are showing they always apply, since every card
                      draws the shape. Once the table takes over, the shape
                      column itself waits for xl, and a control whose column is
                      not on screen is worse than no control. */}
                  <Box
                    display={
                      tableFits
                        ? { base: 'none', xl: 'flex' }
                        : { base: 'none', md: 'flex' }
                    }
                  >
                    <ChartViewChips
                      surface="shape"
                      active={effectiveChartView(chartViews.shape, shapeHasTarget)}
                      hasTarget={shapeHasTarget}
                      groupLabel="Shape column view"
                      density="24px"
                    />
                  </Box>
                  <RowActions />
                  <ScrollButtons chartRef={chartRef} />
                </Flex>
              </Flex>
              {tableFits ? <RollsTable /> : <RollsCards />}
            </Stack>
            <RailSplitter
              width={tableWidth}
              onWidth={setTableWidth}
              gridRef={gridRef}
              trackRef={tableColRef}
            />
            <Box
              minW={0}
              minH={0}
              overflowY={{ '2xl': 'auto' }}
              ps={{ base: 0, '2xl': 6 }}
            >
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
            <Flex
              gap={3}
              rowGap={2}
              align="center"
              wrap="wrap"
              minH="48px"
              position={{ base: 'static', md: 'sticky' }}
              top={0}
              zIndex={2}
              bg="bg"
            >
              <TargetToolbar />
              <Box flex="1" minW={0} />
              <ScrollButtons display={{ base: 'none', md: 'inline-flex' }} />
            </Flex>
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
            <CompareActions />
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
            <CompareActions />
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
