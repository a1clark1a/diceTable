import { Stack } from '@chakra-ui/react';
import { RollsTable } from '../components/RollsTable';
import { RollsCards } from '../components/RollsCards';
import { OverlayChart } from '../components/chart/OverlayChart';
import { useIsDesktop } from '../hooks/useBreakpoint';

export default function TablePage() {
  const isDesktop = useIsDesktop();
  return (
    <Stack gap={{ base: 4, md: 6 }}>
      {isDesktop ? <RollsTable /> : <RollsCards />}
      <OverlayChart />
    </Stack>
  );
}
