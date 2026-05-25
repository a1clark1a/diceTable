import { useMemo } from 'react';
import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartView, Distribution, TargetState } from '../../types';
import { ShapeCardLabel } from '../chart/Sparkline';
import { effectiveChartView } from '../chart/effectiveView';
import { sortedKeys } from '../../engine/distribution';
import { formatPercent } from '../chart/format';
import { useApp } from '../../state/useApp';

interface InspectChartBodyProps {
  dist: Distribution;
  color: string;
}

interface ChartDatum {
  x: number;
  value: number;
  valueMatch?: number | null;
}

function targetMatches(x: number, target: TargetState): boolean {
  if (target.values.length === 0) return true;
  switch (target.ruling) {
    case 'gte': {
      let lo = Infinity;
      for (const v of target.values) if (v < lo) lo = v;
      return x >= lo;
    }
    case 'gt': {
      let lo = Infinity;
      for (const v of target.values) if (v < lo) lo = v;
      return x > lo;
    }
    case 'lte': {
      let hi = -Infinity;
      for (const v of target.values) if (v > hi) hi = v;
      return x <= hi;
    }
    case 'lt': {
      let hi = -Infinity;
      for (const v of target.values) if (v > hi) hi = v;
      return x < hi;
    }
    case 'eq':
      return target.values.includes(x);
  }
}

function buildChartData(
  dist: Distribution,
  view: ChartView,
  target: TargetState | undefined,
): ChartDatum[] {
  if (dist.size === 0) return [];
  const keys = sortedKeys(dist);
  const min = keys[0]!;
  const max = keys[keys.length - 1]!;
  const span = max - min + 1;

  const data = new Array<ChartDatum>(span);

  if (view === 'pmf') {
    for (let i = 0; i < span; i++) {
      const x = min + i;
      data[i] = { x, value: dist.get(x) ?? 0 };
    }
    return data;
  }

  if (view === 'target') {
    for (let i = 0; i < span; i++) {
      const x = min + i;
      const p = dist.get(x) ?? 0;
      const matches = target ? targetMatches(x, target) : true;
      data[i] = { x, value: p, valueMatch: matches ? p : null };
    }
    return data;
  }

  if (view === 'cdf') {
    let cum = 0;
    for (let i = 0; i < span; i++) {
      const x = min + i;
      cum += dist.get(x) ?? 0;
      data[i] = { x, value: cum };
    }
    return data;
  }

  let cum = 1;
  for (let i = 0; i < span; i++) {
    const x = min + i;
    data[i] = { x, value: cum };
    cum -= dist.get(x) ?? 0;
  }
  return data;
}

function formatPctTick(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatTooltipValue(value: number | string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(2)}%`;
}

function tooltipLabel(view: ChartView, x: number | string): string {
  switch (view) {
    case 'cdf':
      return `≤ ${x}`;
    case 'ccdf':
      return `≥ ${x}`;
    default:
      return `Result: ${x}`;
  }
}

export default function InspectChartBody({ dist, color }: InspectChartBodyProps) {
  const { chartView, target } = useApp();
  const effectiveView = effectiveChartView(chartView, target);

  const data = useMemo(
    () => buildChartData(dist, effectiveView, target),
    [dist, effectiveView, target],
  );

  const topResults = useMemo(
    () =>
      Array.from(dist.entries())
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, 10),
    [dist],
  );

  const stats = useMemo(() => {
    if (dist.size === 0) return { mean: 0, modes: [] as number[] };
    let mean = 0;
    let maxP = -Infinity;
    for (const [v, p] of dist.entries()) {
      mean += v * p;
      if (p > maxP) maxP = p;
    }
    const modes: number[] = [];
    for (const [v, p] of dist.entries()) {
      if (p === maxP) modes.push(v);
    }
    return { mean, modes };
  }, [dist]);

  const yDomain: [number, number | 'auto'] =
    effectiveView === 'pmf' || effectiveView === 'target'
      ? [0, 'auto']
      : [0, 1];

  const isAreaView = effectiveView === 'pmf' || effectiveView === 'target';
  const soleMode =
    effectiveView === 'pmf' && stats.modes.length === 1 && dist.size > 0
      ? stats.modes[0]
      : undefined;
  const showMeanTick = effectiveView === 'pmf' && dist.size > 0;

  return (
    <Stack gap={3}>
      <Box bg="bg.subtle" borderRadius="md" px={3} py={3}>
      <ShapeCardLabel view={effectiveView} />
      <Box w="100%" h={{ base: '280px', md: '360px' }} mt={2}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 1, height: 1 }}
        >
          <ComposedChart
            data={data}
            margin={{ top: 16, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--chakra-colors-border-subtle)"
              vertical={false}
            />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              padding={{ left: 8, right: 8 }}
              tickLine={false}
              axisLine={false}
              tick={{
                fontSize: 11,
                fill: 'var(--chakra-colors-fg-muted)',
                fontFamily: 'ui-monospace, monospace',
              }}
              allowDecimals={false}
            />
            <YAxis
              tickFormatter={formatPctTick}
              tickLine={false}
              axisLine={false}
              tick={{
                fontSize: 11,
                fill: 'var(--chakra-colors-fg-muted)',
                fontFamily: 'ui-monospace, monospace',
              }}
              domain={yDomain}
              {...(!isAreaView && { ticks: [0, 0.25, 0.5, 0.75, 1] })}
              width={48}
            />
            <RechartsTooltip
              cursor={{ fill: 'var(--chakra-colors-bg-emphasized)' }}
              formatter={(value) => [formatTooltipValue(value as number), '']}
              labelFormatter={(label) => tooltipLabel(effectiveView, label)}
              contentStyle={{
                backgroundColor: 'var(--chakra-colors-bg-inverted)',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--chakra-colors-fg-inverted)',
                padding: '6px 10px',
              }}
              itemStyle={{ color: 'var(--chakra-colors-fg-inverted)' }}
              labelStyle={{
                color: 'var(--chakra-colors-fg-inverted)',
                fontWeight: 600,
              }}
            />
            {effectiveView === 'pmf' && (
              <Area
                dataKey="value"
                type="step"
                stroke={color}
                strokeWidth={1.75}
                fill={color}
                fillOpacity={0.22}
                isAnimationActive={false}
              />
            )}
            {effectiveView === 'target' && (
              <>
                <Area
                  dataKey="value"
                  type="step"
                  stroke="none"
                  fill={color}
                  fillOpacity={0.18}
                  isAnimationActive={false}
                  tooltipType="none"
                />
                <Area
                  dataKey="valueMatch"
                  type="step"
                  stroke={color}
                  strokeWidth={1.75}
                  fill={color}
                  fillOpacity={0.55}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </>
            )}
            {!isAreaView && (
              <Line
                dataKey="value"
                type="monotone"
                stroke={color}
                strokeWidth={2}
                dot={{
                  r: 3,
                  fill: color,
                  stroke: 'var(--chakra-colors-bg-panel)',
                  strokeWidth: 1.5,
                }}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            )}
            {showMeanTick && (
              <ReferenceLine
                x={stats.mean}
                stroke="var(--chakra-colors-fg-muted)"
                strokeDasharray="2 3"
                strokeOpacity={0.55}
                label={{
                  value: `μ ${stats.mean.toFixed(1)}`,
                  position: 'top',
                  fill: 'var(--chakra-colors-fg-muted)',
                  fontSize: 10,
                  fontFamily: 'ui-monospace, monospace',
                }}
              />
            )}
            {soleMode !== undefined && (
              <ReferenceLine
                x={soleMode}
                stroke={color}
                strokeWidth={1.25}
                strokeOpacity={0.85}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Box>
      </Box>
      <Box bg="bg.subtle" borderRadius="md" px={3} py={3}>
        <Text
          fontSize="2xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
          mb={2}
        >
          Most likely results
        </Text>
        <Stack gap={1}>
          {topResults.map(([value, p]) => (
            <HStack key={value} justify="space-between">
              <Text
                fontFamily="mono"
                fontSize="sm"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {value}
              </Text>
              <Text
                fontFamily="mono"
                fontSize="sm"
                color="fg.muted"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatPercent(p)}
              </Text>
            </HStack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
