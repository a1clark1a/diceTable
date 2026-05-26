import { useCallback, useMemo, type RefObject } from 'react';
import { Box, Button, HStack, IconButton, Text } from '@chakra-ui/react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useApp } from '../state/useApp';
import { effectiveChartView } from './chart/effectiveView';
import type { ChartView } from '../types';
import { Tooltip } from './ui/tooltip';
import { tipForId } from '../docs/glossary';

interface ViewBarProps {
  chartRef: RefObject<HTMLDivElement | null>;
}

const VIEW_OPTIONS: { value: ChartView; label: string; tip: string }[] = [
  { value: 'pmf', label: 'PMF', tip: tipForId('pmf') },
  { value: 'cdf', label: 'CDF', tip: tipForId('cdf') },
  { value: 'ccdf', label: 'CCDF', tip: tipForId('ccdf') },
  { value: 'target', label: 'TARGET', tip: tipForId('targetView') },
];

export function ViewBar({ chartRef }: ViewBarProps) {
  const { chartView, setChartView, target } = useApp();
  const hasTarget = target.values.length > 0;
  const effectiveView = effectiveChartView(chartView, target);

  const visibleViews = useMemo(
    () => VIEW_OPTIONS.filter((v) => v.value !== 'target' || hasTarget),
    [hasTarget],
  );

  const scrollToTop = useCallback(() => {
    document
      .querySelector('main')
      ?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToChart = useCallback(() => {
    chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [chartRef]);

  return (
    <Box
      position="sticky"
      top={0}
      zIndex={2}
      bg="bg"
      py={2}
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <HStack gap={2} justify="space-between" align="center">
        <HStack gap={2} align="center">
          <Text
            display={{ base: 'none', md: 'inline' }}
            fontSize="xs"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            View
          </Text>
          <HStack
            gap={0}
            bg="bg.subtle"
            borderRadius="md"
            p={1}
            display="inline-flex"
          >
            {visibleViews.map((v) => {
              const active = effectiveView === v.value;
              return (
                <Tooltip key={v.value} content={v.tip}>
                  <Button
                    size="sm"
                    variant={active ? 'solid' : 'ghost'}
                    colorPalette={active ? 'blue' : 'gray'}
                    onClick={() => setChartView(v.value)}
                    aria-pressed={active}
                    aria-label={v.label}
                    minH="40px"
                  >
                    {v.label}
                  </Button>
                </Tooltip>
              );
            })}
          </HStack>
        </HStack>
        <HStack gap={1}>
          <Tooltip content="Scroll to top">
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Scroll to top"
              onClick={scrollToTop}
              minW="40px"
              minH="40px"
            >
              <ArrowUp size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip content="Jump to chart">
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Jump to chart"
              onClick={scrollToChart}
              minW="40px"
              minH="40px"
            >
              <ArrowDown size={16} />
            </IconButton>
          </Tooltip>
        </HStack>
      </HStack>
    </Box>
  );
}
