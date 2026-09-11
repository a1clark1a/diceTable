import { useState, type Ref } from 'react';
import { Box, Stack, Text } from '@chakra-ui/react';
import { ChartColumn } from 'lucide-react';
import { CHART_ROW_LIMIT } from '../../types';
import { ChartPanel } from './ChartPanel';
import { useChartPanels } from './useChartPanels';

interface OverlayChartProps {
  ref?: Ref<HTMLDivElement>;
}

function EmptyChartCard({ children }: { children: React.ReactNode }) {
  return (
    <Stack
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="8px"
      p={3}
      minH="240px"
      align="center"
      justify="center"
      gap={3}
      color="fg.muted"
      textAlign="center"
    >
      <ChartColumn size={28} strokeWidth={1.5} aria-hidden />
      {children}
    </Stack>
  );
}

export function OverlayChart({ ref }: OverlayChartProps) {
  const { panels, dists, colors, overLimit, rowCount } = useChartPanels();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <Stack ref={ref} gap={2} scrollMarginTop={{ base: '64px', md: '72px' }}>
      <Text
        fontSize="10px"
        fontWeight="600"
        fontFamily="mono"
        color="fg.subtle"
        textTransform="uppercase"
        letterSpacing="0.07em"
      >
        Comparison
      </Text>
      {overLimit ? (
        <EmptyChartCard>
          <Text fontSize="sm" maxW="52ch">
            Comparison chart is disabled past {CHART_ROW_LIMIT} rolls (currently{' '}
            {rowCount}). Each row still draws its own curve in the Shape column.
          </Text>
        </EmptyChartCard>
      ) : panels.length === 0 ? (
        <EmptyChartCard>
          <Text fontSize="sm">No valid rows yet. Add a roll above.</Text>
        </EmptyChartCard>
      ) : (
        // Stacked, not side by side: the rail is too narrow to split, and a
        // panel only exists when it has series, so an all-pool table shows one
        // card rather than an empty Totals beside it.
        <Stack gap={3}>
          {panels.map((panel) => (
            <Box key={panel.key}>
              <ChartPanel
                panel={panel}
                dists={dists}
                colors={colors}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                unit={panel.key === 'successes' ? 'successes' : 'totals'}
              />
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
