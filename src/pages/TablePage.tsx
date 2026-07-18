import { useRef } from 'react';
import { Heading, Stack, Text } from '@chakra-ui/react';
import { RollsTable } from '../components/RollsTable';
import { RollsCards } from '../components/RollsCards';
import { OverlayChart } from '../components/chart/OverlayChart';
import { ViewBar } from '../components/ViewBar';
import { RouteHead } from '../components/seo/RouteHead';
import { useIsDesktop } from '../hooks/useBreakpoint';

export default function TablePage() {
  const isDesktop = useIsDesktop();
  const chartRef = useRef<HTMLDivElement>(null);
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
      <ViewBar chartRef={chartRef} />
      {isDesktop ? <RollsTable /> : <RollsCards />}
      <OverlayChart ref={chartRef} />
    </Stack>
  );
}
