import { lazy, Suspense, useMemo, useState } from 'react';
import {
  Box,
  Button,
  HStack,
  Stack,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { ChartColumn } from 'lucide-react';
import { useApp } from '../../state/useApp';
import { useDistributions } from '../../state/useDistributions';
import type { ChartView } from '../../types';
import { rowColor } from './palette';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';
import { ChartFallback } from './ChartFallback';

const OverlayChartImpl = lazy(() => import('./OverlayChartImpl'));

interface LegendEntry {
  id: string;
  name: string;
  color: string;
}

const VIEW_OPTIONS: { value: ChartView; label: string; tip: string }[] = [
  { value: 'pmf', label: 'PMF', tip: tipForId('pmf') },
  { value: 'cdf', label: 'CDF', tip: tipForId('cdf') },
  { value: 'ccdf', label: 'CCDF', tip: tipForId('ccdf') },
  { value: 'target', label: 'TARGET', tip: tipForId('targetView') },
];

const CHART_ROW_LIMIT = 20;

export function OverlayChart() {
  const { expressions, chartView, setChartView, target } = useApp();
  const { dists } = useDistributions();

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const overLimit = expressions.length > CHART_ROW_LIMIT;
  const hasTarget = target.values.length > 0;
  const effectiveView: ChartView =
    chartView === 'target' && !hasTarget ? 'pmf' : chartView;

  const visibleViews = useMemo(
    () => VIEW_OPTIONS.filter((v) => v.value !== 'target' || hasTarget),
    [hasTarget],
  );

  const legendEntries = useMemo<LegendEntry[]>(() => {
    if (overLimit) return [];
    const out: LegendEntry[] = [];
    expressions.forEach((expr, idx) => {
      const dist = dists.get(expr.id);
      if (!dist || dist.size === 0) return;
      out.push({ id: expr.id, name: expr.name, color: rowColor(idx) });
    });
    return out;
  }, [overLimit, expressions, dists]);

  const hasValidSeries = legendEntries.length > 0;
  const showLegend = hasValidSeries && effectiveView !== 'target';

  const focusedId =
    hoveredId !== null && legendEntries.some((e) => e.id === hoveredId)
      ? hoveredId
      : null;

  return (
    <Stack gap={2}>
      <Text
        fontSize="xs"
        fontWeight="semibold"
        color="fg.muted"
        textTransform="uppercase"
        letterSpacing="wider"
      >
        Comparison
      </Text>
      <Box
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="md"
        p={{ base: 3, md: 4 }}
      >
        <HStack
          justify="space-between"
          align="flex-start"
          mb={3}
          gap={3}
          flexWrap="wrap"
        >
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
                    size="xs"
                    variant={active ? 'solid' : 'ghost'}
                    colorPalette={active ? 'blue' : 'gray'}
                    onClick={() => setChartView(v.value)}
                    aria-pressed={active}
                    aria-label={v.label}
                  >
                    {v.label}
                  </Button>
                </Tooltip>
              );
            })}
          </HStack>

          {showLegend && (
            <Wrap gap={3} flex="1" justify="flex-end">
              {legendEntries.map((s) => {
                const dim = focusedId !== null && focusedId !== s.id;
                return (
                  <WrapItem key={s.id}>
                    <HStack
                      gap={2}
                      role="button"
                      tabIndex={0}
                      cursor="pointer"
                      opacity={dim ? 0.4 : 1}
                      transition="opacity 120ms ease-out"
                      aria-label={`Focus ${s.name} in chart`}
                      onMouseEnter={() => setHoveredId(s.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(s.id)}
                      onBlur={() => setHoveredId(null)}
                    >
                      <Box
                        w="10px"
                        h="10px"
                        borderRadius="2px"
                        bg={s.color}
                        flexShrink={0}
                      />
                      <Text fontSize="xs" color="fg.muted">
                        {s.name}
                      </Text>
                    </HStack>
                  </WrapItem>
                );
              })}
            </Wrap>
          )}
        </HStack>

        {overLimit ? (
          <Stack
            minH="240px"
            align="center"
            justify="center"
            gap={3}
            color="fg.muted"
            textAlign="center"
            px={4}
          >
            <ChartColumn size={28} strokeWidth={1.5} aria-hidden />
            <Text fontSize="sm" maxW="52ch">
              Comparison chart is disabled past {CHART_ROW_LIMIT} rolls
              (currently {expressions.length}). The view toggle above still
              drives the Shape column in the table.
            </Text>
          </Stack>
        ) : !hasValidSeries ? (
          <Stack
            minH="280px"
            align="center"
            justify="center"
            gap={3}
            color="fg.muted"
          >
            <ChartColumn size={28} strokeWidth={1.5} aria-hidden />
            <Text fontSize="sm">No valid rows yet. Add a roll above.</Text>
          </Stack>
        ) : (
          <Suspense fallback={<ChartFallback variant="overlay" />}>
            <OverlayChartImpl
              expressions={expressions}
              dists={dists}
              effectiveView={effectiveView}
              target={target}
              hoveredId={hoveredId}
            />
          </Suspense>
        )}
      </Box>
    </Stack>
  );
}
