import { useMemo } from 'react';
import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import { sortedKeys } from '../../engine/distribution';
import { hitProbability } from '../../engine/stats';
import type {
  ChartView,
  Distribution,
  Expression,
  TargetState,
} from '../../types';
import { rowColor } from './palette';
import { RulingSymbol } from '../targetRuling';
import { RULING_SYMBOL } from '../targetRulingMeta';
import { formatPercent } from './format';

interface RowSeries {
  id: string;
  name: string;
  color: string;
  dist: Distribution;
  min: number;
  max: number;
  cdf: Float64Array;
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

interface OverlayChartImplProps {
  expressions: Expression[];
  dists: Map<string, Distribution>;
  effectiveView: ChartView;
  target: TargetState;
  hoveredId: string | null;
}

function buildSeries(
  expressions: Expression[],
  dists: Map<string, Distribution>,
): RowSeries[] {
  const out: RowSeries[] = [];
  expressions.forEach((expr, idx) => {
    const dist = dists.get(expr.id);
    if (!dist || dist.size === 0) return;
    const keys = sortedKeys(dist);
    const min = keys[0]!;
    const max = keys[keys.length - 1]!;
    const span = max - min + 1;
    const cdf = new Float64Array(span);
    let cum = 0;
    for (let i = 0; i < span; i++) {
      cum += dist.get(min + i) ?? 0;
      cdf[i] = cum;
    }
    out.push({
      id: expr.id,
      name: expr.name,
      color: rowColor(idx),
      dist,
      min,
      max,
      cdf,
    });
  });
  return out;
}

function valueAt(s: RowSeries, x: number, view: ChartView): number {
  switch (view) {
    case 'pmf':
    case 'target':
      return s.dist.get(x) ?? 0;
    case 'cdf': {
      if (x < s.min) return 0;
      if (x >= s.max) return 1;
      return s.cdf[x - s.min] ?? 0;
    }
    case 'ccdf': {
      if (x <= s.min) return 1;
      if (x > s.max) return 0;
      return 1 - (s.cdf[x - 1 - s.min] ?? 0);
    }
  }
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
      datum[s.id] = valueAt(s, x, view);
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

// Series get a stroke dash by index so overlapping lines stay distinguishable
// without relying on hue alone (color-blind users) — and two coincident series
// no longer fully occlude each other. Index 0 (the primary row) stays solid.
const SERIES_DASH: string[] = [
  '0', // solid — the primary row
  '7 4',
  '2 4',
  '9 4 2 4',
  '5 5',
  '1 4',
  '12 5',
  '4 4',
];

function seriesDash(index: number): string {
  const safe = ((index % SERIES_DASH.length) + SERIES_DASH.length) % SERIES_DASH.length;
  return SERIES_DASH[safe] ?? '0';
}

const NICE_STEPS = [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.15, 0.2, 0.25];

interface PmfYAxis {
  domainMax: number;
  ticks: number[];
}

// PMF probabilities have no fixed ceiling, so let the axis end on a round
// fraction with evenly spaced ticks instead of recharts' auto values
// (which produced awkward 0 / 5 / 9 / 14 / 18 %).
function buildPmfYAxis(data: ChartDatum[]): PmfYAxis {
  let max = 0;
  for (const d of data) {
    for (const key in d) {
      if (key === 'x') continue;
      const v = d[key];
      if (typeof v === 'number' && v > max) max = v;
    }
  }
  if (max <= 0) return { domainMax: 0.1, ticks: [0, 0.05, 0.1] };
  const rawStep = max / 4;
  const step = NICE_STEPS.find((s) => s >= rawStep) ?? 0.25;
  const domainMax = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= domainMax + 1e-9; t += step) {
    ticks.push(Number(t.toFixed(4)));
  }
  return { domainMax, ticks };
}

// Custom tooltip: each row carries its series-color swatch (matching the table
// and legend swatches by color), so identically named rows stay distinguishable.
function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <Box
      bg="bg.inverted"
      color="fg.inverted"
      borderRadius="sm"
      px="10px"
      py="6px"
      fontSize="11px"
      boxShadow="sm"
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
}: OverlayChartImplProps) {
  const series = useMemo(
    () => buildSeries(expressions, dists),
    [expressions, dists],
  );
  const data = useMemo(
    () => buildChartData(series, effectiveView),
    [series, effectiveView],
  );
  const hitRows = useMemo(
    () => (effectiveView === 'target' ? buildHitRows(series, target) : []),
    [series, target, effectiveView],
  );
  const pmfYAxis = useMemo(
    () => (effectiveView === 'pmf' ? buildPmfYAxis(data) : null),
    [data, effectiveView],
  );

  const focusedId =
    hoveredId !== null && series.some((s) => s.id === hoveredId)
      ? hoveredId
      : null;

  if (effectiveView === 'target' && target.values.length > 0) {
    return (
      <TargetHitView rows={hitRows} target={target} focusedId={focusedId} />
    );
  }

  const yDomain: [number, number] =
    effectiveView === 'pmf' ? [0, pmfYAxis?.domainMax ?? 0.1] : [0, 1];
  const yTicks =
    effectiveView === 'pmf'
      ? (pmfYAxis?.ticks ?? [0, 0.05, 0.1])
      : [0, 0.25, 0.5, 0.75, 1];

  return (
    <Box w="100%" h={{ base: '260px', md: '320px' }}>
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 1, height: 1 }}
      >
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--chakra-colors-border-muted)"
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
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  );
}

interface TargetHitViewProps {
  rows: HitRow[];
  target: TargetState;
  focusedId: string | null;
}

interface TargetChartDatum {
  id: string;
  name: string;
  color: string;
  [hitKey: string]: number | string;
}

function formatPctLabel(
  value: string | number | boolean | null | undefined,
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return formatPercent(value);
}

function targetOpacity(targetIndex: number, totalTargets: number): number {
  if (totalTargets <= 1) return 0.85;
  const min = 0.35;
  const max = 0.9;
  const step = (max - min) / (totalTargets - 1);
  return max - step * targetIndex;
}

function TargetHitView({ rows, target, focusedId }: TargetHitViewProps) {
  if (target.values.length === 0) return null;
  const symbol = RULING_SYMBOL[target.ruling];
  const targetCount = target.values.length;

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
  const showLabels = rows.length * targetCount <= 24;

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
          <Text as="span">Hit rate · Target</Text>
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
        h={{ base: '260px', md: '320px' }}
        maxW={`${rows.length * (targetCount * 28 + 40) + 96}px`}
        mx="auto"
        role="img"
        aria-label={`Hit rate per roll for targets ${symbol} ${targetsLabel}`}
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
            <CartesianGrid
              strokeDasharray="3 3"
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
                backgroundColor: 'var(--chakra-colors-bg-inverted)',
                border: 'none',
                borderRadius: 4,
                fontSize: 11,
                color: 'var(--chakra-colors-fg-inverted)',
                padding: '6px 10px',
              }}
              itemStyle={{ color: 'var(--chakra-colors-fg-inverted)' }}
              labelStyle={{
                color: 'var(--chakra-colors-fg-inverted)',
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
                {showLabels && (
                  <LabelList
                    dataKey={`hit_${ti}`}
                    position="top"
                    formatter={formatPctLabel}
                    style={{
                      fill: 'var(--chakra-colors-fg)',
                      fontSize: 10,
                      fontFamily: 'ui-monospace, monospace',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Stack>
  );
}
