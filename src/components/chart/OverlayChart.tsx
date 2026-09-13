import { memo, useMemo, type Ref } from 'react';
import { Box, Stack, Text } from '@chakra-ui/react';
import { ChartColumn } from 'lucide-react';
import { capPanels, chartRowCap } from './rowCap';
import { ChartPanel } from './ChartPanel';
import { ChartEnlargeDialog } from './ChartEnlargeDialog';
import { useChartPanels } from './useChartPanels';
import { useSeriesFocus } from './useSeriesFocus';

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

/**
 * Memoised because dragging the rail splitter sets state on TablePage at
 * pointer-event rate, and every one of those renders would otherwise rebuild
 * both Recharts surfaces for a change that only moves a grid track. The ref is
 * the sole prop and it is stable, so the rows still arrive through context.
 */
export const OverlayChart = memo(function OverlayChart({
  ref,
}: OverlayChartProps) {
  const { panels, dists, slots } = useChartPanels();
  // The rail takes the rail budget at every width; only the enlarged copy
  // has the canvas to earn a bigger one.
  const shown = useMemo(
    () => capPanels(panels, chartRowCap('rail', false)),
    [panels],
  );
  const focus = useSeriesFocus();

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
      {shown.length === 0 ? (
        <EmptyChartCard>
          <Text fontSize="sm">No valid rows yet. Add a roll above.</Text>
        </EmptyChartCard>
      ) : (
        // Stacked, not side by side: the rail is too narrow to split, and a
        // panel only exists when it has series, so an all-pool table shows one
        // card rather than an empty Totals beside it.
        <Stack gap={3}>
          {shown.map((panel) => (
            <Box key={panel.key}>
              <ChartPanel
                panel={panel}
                dists={dists}
                slots={slots}
                focusedId={focus.focusedId}
                pickedId={focus.pickedId}
                onPreview={focus.preview}
                onPick={focus.toggle}
                onClear={focus.clear}
                unit={panel.key === 'successes' ? 'successes' : 'totals'}
                enlarge={
                  <ChartEnlargeDialog
                    panel={panel}
                    panels={panels}
                    dists={dists}
                    slots={slots}
                  />
                }
              />
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
});
