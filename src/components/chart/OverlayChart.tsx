import { lazy, Suspense, useMemo, useState, type Ref } from 'react';
import { Box, HStack, Stack, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { ChartColumn } from 'lucide-react';
import { useApp } from '../../state/useApp';
import { useDistributions } from '../../state/useDistributions';
import type {
  ChartView,
  Distribution,
  Expression,
  TargetState,
} from '../../types';
import { rowColor } from './palette';
import { ChartFallback } from './ChartFallback';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import type { ChartUnit } from './OverlayChartImpl';

const OverlayChartImpl = lazy(() => import('./OverlayChartImpl'));

interface LegendEntry {
  id: string;
  name: string;
  color: string;
}

interface OverlayChartProps {
  ref?: Ref<HTMLDivElement>;
}

const CHART_ROW_LIMIT = 20;

interface PanelLegendProps {
  entries: LegendEntry[];
  focusedId: string | null;
  onHover: (id: string | null) => void;
}

function PanelLegend({ entries, focusedId, onHover }: PanelLegendProps) {
  return (
    <Wrap gap={3} justify="flex-end">
      {entries.map((s) => {
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
              borderRadius="2px"
              // Same pinned-blue ring as the pool chips: dimming the other
              // entries is not a visible focus indicator on the entry itself.
              _focusVisible={{
                outlineWidth: '2px',
                outlineStyle: 'solid',
                outlineColor: 'blue.solid',
                outlineOffset: '2px',
              }}
              aria-label={`Focus ${s.name} in chart`}
              onMouseEnter={() => onHover(s.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(s.id)}
              onBlur={() => onHover(null)}
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
  );
}

interface ChartPanelProps {
  title: string | null;
  titleTip: string;
  titleColor: string;
  entries: LegendEntry[];
  expressions: Expression[];
  dists: Map<string, Distribution>;
  colors: Map<string, string>;
  effectiveView: ChartView;
  target: TargetState;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  flex: number;
  unit: ChartUnit;
}

function ChartPanel({
  title,
  titleTip,
  titleColor,
  entries,
  expressions,
  dists,
  colors,
  effectiveView,
  target,
  hoveredId,
  onHover,
  flex,
  unit,
}: ChartPanelProps) {
  // Focus stays panel-local: hovering a pool row highlights it among pool
  // series without dimming the other panel's rows.
  const focusedId =
    hoveredId !== null && entries.some((e) => e.id === hoveredId)
      ? hoveredId
      : null;
  const legend = (
    <PanelLegend entries={entries} focusedId={focusedId} onHover={onHover} />
  );
  return (
    <Stack flex={flex} minW={0} gap={2}>
      {title !== null ? (
        <HStack justify="space-between" align="flex-start" gap={3}>
          <HelpTerm tip={titleTip}>
            <Text
              as="span"
              fontSize="xs"
              fontWeight="semibold"
              color={titleColor}
              textTransform="uppercase"
              letterSpacing="wider"
            >
              {title}
            </Text>
          </HelpTerm>
          <Box flex="1" minW={0}>
            {legend}
          </Box>
        </HStack>
      ) : (
        legend
      )}
      {/* mt="auto" pins the fixed-height chart to the bottom of the
          stretched panel row, so side-by-side x-axis baselines stay level
          when one panel's legend wraps to more lines than the other's. */}
      <Box mt="auto">
        <Suspense fallback={<ChartFallback variant="overlay" />}>
          <OverlayChartImpl
            expressions={expressions}
            dists={dists}
            colors={colors}
            effectiveView={effectiveView}
            target={target}
            hoveredId={hoveredId}
            unit={unit}
          />
        </Suspense>
      </Box>
    </Stack>
  );
}

export function OverlayChart({ ref }: OverlayChartProps) {
  const { expressions, chartView, target, poolTarget } = useApp();
  const { dists } = useDistributions();

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const overLimit = expressions.length > CHART_ROW_LIMIT;
  const hasTarget = target.values.length > 0;
  const effectiveView: ChartView =
    chartView === 'target' && !hasTarget ? 'pmf' : chartView;

  // Keyed by unfiltered row position so the sum/pool split below cannot shift
  // any series off its table swatch color.
  const colors = useMemo(() => {
    const map = new Map<string, string>();
    expressions.forEach((expr, idx) => map.set(expr.id, rowColor(idx)));
    return map;
  }, [expressions]);

  const sumExprs = useMemo(
    () => expressions.filter((e) => e.mode === 'sum'),
    [expressions],
  );
  const poolExprs = useMemo(
    () => expressions.filter((e) => e.mode === 'pool'),
    [expressions],
  );

  const legends = useMemo(() => {
    const sum: LegendEntry[] = [];
    const pool: LegendEntry[] = [];
    if (overLimit) return { sum, pool };
    expressions.forEach((expr, idx) => {
      const dist = dists.get(expr.id);
      if (!dist || dist.size === 0) return;
      const entry: LegendEntry = {
        id: expr.id,
        name: expr.name,
        color: rowColor(idx),
      };
      if (expr.mode === 'pool') pool.push(entry);
      else sum.push(entry);
    });
    return { sum, pool };
  }, [overLimit, expressions, dists]);

  // Pool rows answer to the shared pool target, not the numeric target list.
  const poolTargetState = useMemo<TargetState>(
    () => ({ values: [poolTarget], ruling: 'gte' }),
    [poolTarget],
  );

  const showSum = legends.sum.length > 0;
  const showPool = legends.pool.length > 0;
  const hasValidSeries = showSum || showPool;
  // Titles only earn their space once a Successes panel exists; an all-sum
  // table keeps today's unlabeled single-chart look.
  const showTitles = showPool;

  return (
    <Stack ref={ref} gap={2} scrollMarginTop={{ base: '64px', md: '72px' }}>
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
              (currently {expressions.length}). The view toggle still drives
              the Shape column in the table.
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
          <Stack
            direction={{ base: 'column', md: 'row' }}
            gap={{ base: 5, md: 4 }}
            align="stretch"
          >
            {showSum && (
              <ChartPanel
                title={showTitles ? 'Totals' : null}
                titleTip={tipForId('totalsChart')}
                titleColor="fg.muted"
                entries={legends.sum}
                expressions={sumExprs}
                dists={dists}
                colors={colors}
                effectiveView={effectiveView}
                target={target}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                flex={showPool ? 2 : 1}
                unit="totals"
              />
            )}
            {showPool && (
              <ChartPanel
                title={showTitles ? 'Successes' : null}
                titleTip={tipForId('successesChart')}
                titleColor="purple.fg"
                entries={legends.pool}
                expressions={poolExprs}
                dists={dists}
                colors={colors}
                effectiveView={effectiveView}
                target={poolTargetState}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                flex={1}
                unit="successes"
              />
            )}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
