import { useRef } from 'react';
import { Stack } from '@chakra-ui/react';
import { RollsTable } from '../components/RollsTable';
import { RollsCards } from '../components/RollsCards';
import { OverlayChart } from '../components/chart/OverlayChart';
import { ViewBar } from '../components/ViewBar';
import { useIsDesktop } from '../hooks/useBreakpoint';

export default function TablePage() {
  const isDesktop = useIsDesktop();
  const chartRef = useRef<HTMLDivElement>(null);
  return (
    <Stack gap={{ base: 4, md: 6 }}>
      <ViewBar chartRef={chartRef} />
      {isDesktop ? <RollsTable /> : <RollsCards />}
      <OverlayChart ref={chartRef} />
    </Stack>
  );
}
