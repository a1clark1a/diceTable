import { useMemo } from 'react';
import { Box, HStack, Stack, Text, VisuallyHidden } from '@chakra-ui/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import { sortedKeys } from '../../engine/distribution';
import { canMiss } from '../../engine/expression';
import { hitProbability } from '../../engine/stats';
import type {
  ChartView,
  Distribution,
  Expression,
  TargetState,
} from '../../types';
import { rowColor, seriesDash } from './palette';
import { RulingSymbol } from '../targetRuling';
import { RULING_SYMBOL } from '../targetRulingMeta';
import { formatPercentCompact, targetLabelFits } from './format';
import { buildSeriesEval, evalSeriesAt, type SeriesEval } from './seriesEval';
import {
  formatMissPercent,
  missDescription,
  planZeroSpikes,
  type ZeroSpikePlan,
} from './zeroSpike';

interface RowSeries extends SeriesEval {
  id: string;
  name: string;
  color: string;
  canMiss: boolean;
}

interface ChartDatum {
  x: number;
  [seriesKey: string]: number;
}

interface HitRow {
  id: string;
  name: string;
  color: string;
  hits: number[];
}

// Which quantity the x-axis / bars describe. The Successes panel reads its
// hits against the shared pool target, so its target-view header and
// accessible name must say "successes", not "targets".
export type ChartUnit = 'totals' | 'successes';

interface OverlayChartImplProps {
  expressions: Expression[];
  dists: Map<string, Distribution>;
  effectiveView: ChartView;
  target: TargetState;
  hoveredId: string | null;
  colors: Map<string, string>;
  unit?: ChartUnit;
  /** Overridden when the same panel is rendered somewhere with more room. */
  height?: string;
}

function buildSeries(
  expressions: Expression[],
  dists: Map<string, Distribution>,
  colors: Map<string, string>,
): RowSeries[] {
  const out: RowSeries[] = [];
  expressions.forEach((expr, idx) => {
    const dist = dists.get(expr.id);
    if (!dist || dist.size === 0) return;
    const keys = sortedKeys(dist);
    const min = keys[0]!;
    const max = keys[keys.length - 1]!;
    out.push({
      id: expr.id,
      name: expr.name,
      // Only a row that can land on "nothing happened" ever has a bar capped.
      canMiss: canMiss(expr),
      // The caller keys colors by unfiltered row position so a panel fed a
      // filtered list (sum-only or pool-only) still matches the table
      // swatches; the index fallback only fires if an id is missing.
      color: colors.get(expr.id) ?? rowColor(idx),
      ...buildSeriesEval(dist, min, max),
    });
  });
  return out;
}

function buildChartData(series: RowSeries[], view: ChartView): ChartDatum[] {
  if (series.length === 0) return [];
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const s of series) {
    if (s.min < globalMin) globalMin = s.min;
    if (s.max > globalMax) globalMax = s.max;
  }
  if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) return [];

  const data: ChartDatum[] = [];
  for (let x = globalMin; x <= globalMax; x++) {
    const datum: ChartDatum = { x };
    for (const s of series) {
      datum[s.id] = evalSeriesAt(s, x, view);
    }
    data.push(datum);
  }
  return data;
}

function buildHitRows(series: RowSeries[], target: TargetState): HitRow[] {
  if (target.values.length === 0) return [];
  return series.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    hits: target.values.map((v) => hitProbability(s.dist, v, target.ruling)),
  }));
}

function formatPctTick(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatTooltipValue(value: number | string | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(2)}%`;
}

// Custom tooltip: each row carries its series-color swatch (matching the table
// and legend swatches by color), so identically named rows stay distinguishable.
//
// The panel ground rather than bg.inverted, which every other overlay in the app
// already uses. bg.inverted flips from near-black in light mode to near-white in
// dark, and a swatch set that had to clear 3:1 on both of those as well as on
// the row grounds had no luminance window left to separate eight hues in.
function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <Box
      bg="bg.panel"
      color="fg"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="sm"
      px="10px"
      py="6px"
      fontSize="11px"
      boxShadow="md"
    >
      <Text fontWeight={600} mb={1}>
        Result: {label}
      </Text>
      <Stack gap={1}>
        {payload.map((entry, i) => {
          const value =
            typeof entry.value === 'number' ? entry.value : undefined;
          return (
            <HStack
              key={`${String(entry.dataKey)}-${i}`}
              gap={4}
              justify="space-between"
            >
              <HStack gap={1.5} minW={0}>
                <Box
                  w="8px"
                  h="8px"
                  borderRadius="2px"
                  bg={entry.color}
                  flexShrink={0}
                />
                <Text truncate>{entry.name}</Text>
              </HStack>
              <Text
                fontFamily="mono"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatTooltipValue(value)}
              </Text>
            </HStack>
          );
        })}
      </Stack>
    </Box>
  );
}

export default function OverlayChartImpl({
  expressions,
  dists,
  effectiveView,
  target,
  hoveredId,
  colors,
  unit = 'totals',
  height,
}: OverlayChartImplProps) {
  const series = useMemo(
    () => buildSeries(expressions, dists, colors),
    [expressions, dists, colors],
  );
  const data = useMemo(
    () => buildChartData(series, effectiveView),
    [series, effectiveView],
  );
  const hitRows = useMemo(
    () => (effectiveView === 'target' ? buildHitRows(series, target) : []),
    [series, target, effectiveView],
  );
  const spikes = useMemo<ZeroSpikePlan>(
    () => planZeroSpikes(effectiveView === 'pmf' ? series : []),
    [series, effectiveView],
  );

  const focusedId =
    hoveredId !== null && series.some((s) => s.id === hoveredId)
      ? hoveredId
      : null;

  if (effectiveView === 'target' && target.values.length > 0) {
    return (
      <TargetHitView
        rows={hitRows}
        target={target}
        focusedId={focusedId}
        unit={unit}
        height={height}
      />
    );
  }

  const yDomain: [number, number] =
    effectiveView === 'pmf' ? [0, spikes.axis.domainMax] : [0, 1];
  const yTicks =
    effectiveView === 'pmf' ? spikes.axis.ticks : [0, 0.25, 0.5, 0.75, 1];

  const domainMax = yDomain[1];

  return (
    <>
      <Box w="100%" h={height ?? { base: '260px', md: '320px' }}>
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 1, height: 1 }}
      >
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
          {/* Solid hairline, not dashed: dash patterns are spent on series
              identity here (seriesDash), so a dashed grid competes with the
              one cue that survives colour blindness. */}
          <CartesianGrid
            stroke="var(--chakra-colors-border-subtle)"
            vertical={false}
          />
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            padding={{ left: 8, right: 8 }}
            tickLine={false}
            axisLine={{
              stroke: 'var(--chakra-colors-border-emphasized)',
            }}
            tick={{
              fontSize: 11,
              fill: 'var(--chakra-colors-fg)',
              fontFamily: 'ui-monospace, monospace',
            }}
            allowDecimals={false}
          />
          <YAxis
            tickFormatter={formatPctTick}
            tickLine={false}
            axisLine={{
              stroke: 'var(--chakra-colors-border-emphasized)',
            }}
            tick={{
              fontSize: 11,
              fill: 'var(--chakra-colors-fg)',
              fontFamily: 'ui-monospace, monospace',
            }}
            domain={yDomain}
            ticks={yTicks}
            width={48}
            allowDataOverflow
          />
          <RechartsTooltip
            cursor={{ fill: 'var(--chakra-colors-bg-emphasized)' }}
            content={ChartTooltip}
          />
          {effectiveView === 'pmf'
            ? series.map((s, i) => {
                const focused = focusedId === s.id;
                const opacity =
                  focusedId === null ? 0.9 : focused ? 1 : 0.2;
                return (
                  <Line
                    key={s.id}
                    dataKey={s.id}
                    name={s.name}
                    type="step"
                    stroke={s.color}
                    strokeWidth={focused ? 2.25 : 1.75}
                    strokeOpacity={opacity}
                    strokeDasharray={seriesDash(i)}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                );
              })
            : series.map((s, i) => {
                const focused = focusedId === s.id;
                const opacity =
                  focusedId === null ? 0.9 : focused ? 1 : 0.2;
                return (
                  <Line
                    key={s.id}
                    dataKey={s.id}
                    name={s.name}
                    type="monotone"
                    stroke={s.color}
                    strokeWidth={focused ? 3 : 2.5}
                    strokeOpacity={opacity}
                    strokeDasharray={seriesDash(i)}
                    dot={{
                      r: 3,
                      fill: s.color,
                      stroke: 'var(--chakra-colors-bg-panel)',
                      strokeWidth: 1.5,
                      opacity,
                    }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                );
              })}
          {/* The capped bars keep their true value everywhere it can be read:
              the label here, the tooltip at 0, and the description below. */}
          {spikes.markers.map((marker) => (
            <ReferenceDot
              key={marker.id}
              x={0}
              y={domainMax}
              r={4}
              fill={marker.color}
              stroke="var(--chakra-colors-bg-panel)"
              strokeWidth={2}
              ifOverflow="visible"
              label={{
                value: formatMissPercent(marker.probability),
                position: 'right',
                fill: marker.color,
                fontSize: 11,
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      </Box>
      {spikes.markers.length > 0 && (
        <VisuallyHidden>{missDescription(spikes.markers)}</VisuallyHidden>
      )}
    </>
  );
}

interface TargetHitViewProps {
  rows: HitRow[];
  target: TargetState;
  focusedId: string | null;
  unit: ChartUnit;
  height?: string | undefined;
}

interface TargetChartDatum {
  id: string;
  name: string;
  color: string;
  [hitKey: string]: number | string;
}

interface TargetBarLabelProps {
  x?: number | string | undefined;
  y?: number | string | undefined;
  width?: number | string | undefined;
  value?: number | string | boolean | null | undefined;
}

function TargetBarLabel({
  x,
  y,
  width,
  value,
  fitChars,
}: TargetBarLabelProps & { fitChars: number }) {
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return null;
  }
  if (!targetLabelFits(fitChars, width)) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      textAnchor="middle"
      fill="var(--chakra-colors-fg)"
      style={{
        fontSize: 10,
        fontFamily: 'ui-monospace, monospace',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {formatPercentCompact(value)}
    </text>
  );
}

function targetOpacity(targetIndex: number, totalTargets: number): number {
  if (totalTargets <= 1) return 0.85;
  const min = 0.35;
  const max = 0.9;
  const step = (max - min) / (totalTargets - 1);
  return max - step * targetIndex;
}

function TargetHitView({
  rows,
  target,
  focusedId,
  unit,
  height,
}: TargetHitViewProps) {
  if (target.values.length === 0) return null;
  const symbol = RULING_SYMBOL[target.ruling];
  const targetCount = target.values.length;
  const isSuccesses = unit === 'successes';

  const data: TargetChartDatum[] = rows.map((r) => {
    const datum: TargetChartDatum = {
      id: r.id,
      name: r.name,
      color: r.color,
    };
    r.hits.forEach((h, ti) => {
      datum[`hit_${ti}`] = h;
    });
    return datum;
  });

  const targetsLabel = target.values.join(', ');
  const maxLabelChars = rows.reduce(
    (max, r) =>
      r.hits.reduce((m, h) => Math.max(m, formatPercentCompact(h).length), max),
    0,
  );

  return (
    <Stack gap={3}>
      <HStack gap={3} flexWrap="wrap">
        <HStack
          as="span"
          gap={1}
          fontSize="xs"
          color="fg.muted"
          fontFamily="mono"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <Text as="span">
            {isSuccesses ? 'Hit rate · Successes' : 'Hit rate · Target'}
          </Text>
          <RulingSymbol ruling={target.ruling} />
          <Text as="span">{targetsLabel}</Text>
        </HStack>
        {targetCount > 1 && (
          <HStack gap={2} fontSize="xs" color="fg.muted">
            <Text as="span" fontFamily="mono">
              Bars (left → right):
            </Text>
            {target.values.map((v, ti) => (
              <HStack key={v} gap={1}>
                <Box
                  w="10px"
                  h="10px"
                  borderRadius="2px"
                  bg="fg.muted"
                  opacity={targetOpacity(ti, targetCount)}
                />
                <HStack
                  as="span"
                  gap={0}
                  fontFamily="mono"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  <RulingSymbol ruling={target.ruling} />
                  <Text as="span">{v}</Text>
                </HStack>
              </HStack>
            ))}
          </HStack>
        )}
      </HStack>
      <Box
        w="100%"
        h={height ?? { base: '260px', md: '320px' }}
        maxW={`${rows.length * (targetCount * 40 + 40) + 96}px`}
        mx="auto"
        role="img"
        aria-label={
          isSuccesses
            ? `Hit rate per roll for ${targetsLabel} or more successes`
            : `Hit rate per roll for targets ${symbol} ${targetsLabel}`
        }
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 1, height: 1 }}
        >
          <BarChart
            data={data}
            margin={{ top: 24, right: 16, bottom: 8, left: 0 }}
            barCategoryGap="14%"
          >
            {/* Solid hairline, not dashed: dash patterns are spent on series
                identity here (seriesDash), so a dashed grid competes with the
                one cue that survives colour blindness. */}
            <CartesianGrid
              stroke="var(--chakra-colors-border-subtle)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              type="category"
              interval={0}
              padding={{ left: 8, right: 8 }}
              tickLine={false}
              axisLine={{
                stroke: 'var(--chakra-colors-border-emphasized)',
              }}
              tick={false}
              height={4}
            />
            <YAxis
              tickFormatter={formatPctTick}
              tickLine={false}
              axisLine={{
                stroke: 'var(--chakra-colors-border-emphasized)',
              }}
              tick={{
                fontSize: 11,
                fill: 'var(--chakra-colors-fg-muted)',
                fontFamily: 'ui-monospace, monospace',
              }}
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              width={48}
            />
            <RechartsTooltip
              cursor={{ fill: 'var(--chakra-colors-bg-emphasized)' }}
              formatter={(value, name) => [
                formatTooltipValue(value as number),
                name,
              ]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                backgroundColor: 'var(--chakra-colors-bg-panel)',
                border: '1px solid var(--chakra-colors-border-emphasized)',
                borderRadius: 4,
                fontSize: 11,
                color: 'var(--chakra-colors-fg)',
                padding: '6px 10px',
              }}
              itemStyle={{ color: 'var(--chakra-colors-fg)' }}
              labelStyle={{
                color: 'var(--chakra-colors-fg)',
                fontWeight: 600,
              }}
            />
            {target.values.map((v, ti) => (
              <Bar
                key={v}
                dataKey={`hit_${ti}`}
                name={`${symbol}${v}`}
                fillOpacity={targetOpacity(ti, targetCount)}
                radius={[2, 2, 0, 0]}
                maxBarSize={56}
                isAnimationActive={false}
              >
                {data.map((d) => {
                  const dim = focusedId !== null && focusedId !== d.id;
                  return (
                    <Cell
                      key={d.id}
                      fill={d.color}
                      fillOpacity={dim ? 0.25 : 1}
                    />
                  );
                })}
                <LabelList
                  dataKey={`hit_${ti}`}
                  position="top"
                  content={(labelProps: TargetBarLabelProps) => (
                    <TargetBarLabel {...labelProps} fitChars={maxLabelChars} />
                  )}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Stack>
  );
}
