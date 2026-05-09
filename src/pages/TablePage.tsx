import { Box, Stack } from '@chakra-ui/react';
import { RollsTable } from '../components/RollsTable';
import { RollsCards } from '../components/RollsCards';
import { OverlayChart } from '../components/chart/OverlayChart';

export default function TablePage() {
  return (
    <Stack gap={{ base: 4, md: 6 }}>
      <Box display={{ base: 'none', md: 'block' }}>
        <RollsTable />
      </Box>
      <Box display={{ base: 'block', md: 'none' }}>
        <RollsCards />
      </Box>
      <OverlayChart />
    </Stack>
  );
}
