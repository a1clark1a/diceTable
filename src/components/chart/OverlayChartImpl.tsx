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
  useYAxisInverseScale,
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
import { seriesXs } from './seriesXs';
import {
  fieldPen,
  LIT_CLASS,
  LIT_Z_INDEX,
  SPIKE_MARKER_DRAW_CAP,
} from './fieldPen';
import { partitionTooltipRows } from './tooltipRows';
import {
  formatMissPercent,
  missDescription,
  planZeroSpikes,
  type ZeroSpikePlan,
} from './zeroSpike';

interface RowSeries extends SeriesEval {
  id: string;
  name: string;
  /** Unfiltered row position. Both the stroke color and the dash come off it. */
  slot: number;
  color: string;
  canMiss: boolean;
}

interface ChartDatum {
  x: number;
  [seriesKey: string]: number;
}

interface PlottedSeries extends RowSeries {
  points: ChartDatum[];
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
  focusedId: string | null;
  slots: Map<string, number>;
  unit?: ChartUnit;
  /** Overridden when the same panel is rendered somewhere with more room. */
  height?: string;
}

function buildSeries(
  expressions: Expression[],
  dists: Map<string, Distribution>,
  slots: Map<string, number>,
): RowSeries[] {
  const out: RowSeries[] = [];
  expressions.forEach((expr, idx) => {
    const dist = dists.get(expr.id);
    if (!dist || dist.size === 0) return;
    const keys = sortedKeys(dist);
    const min = keys[0]!;
    const max = keys[keys.length - 1]!;
    // The caller keys slots by unfiltered row position, so a panel fed a
    // filtered list (sum-only or pool-only) still matches the table swatches
    // and a row with no distribution cannot shift the rows after it. The
    // fallback only fires if an id is missing.
    const slot = slots.get(expr.id) ?? idx;
    out.push({
      id: expr.id,
      name: expr.name,
      // Only a row that can land on "nothing happened" ever has a bar capped.
      canMiss: canMiss(expr),
      slot,
      color: rowColor(slot),
      ...buildSeriesEval(dist, min, max),
    });
  });
  return out;
}

// One array per series rather than one shared grid. The grid gave every series
// a point at every x in the union, so a single wide row multiplied the point
// count by the number of rows: twenty rows beside one 20d100 cost 39,620
// points and, on the cumulative views, a circle each. Each series now pays for
// its own support and nothing else.
//
// Each datum keys its value by the series id because the shared tooltip axis
// reads it back by dataKey.
function buildPlotted(series: RowSeries[], view: ChartView): PlottedSeries[] {
  if (series.length === 0) return [];
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const s of series) {
    if (s.min < globalMin) globalMin = s.min;
    if (s.max > globalMax) globalMax = s.max;
  }
  if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) return [];

  return series.map((s) => ({
    ...s,
    points: seriesXs(s, globalMin, globalMax).map((x) => ({
      x,
      [s.id]: evalSeriesAt(s, x, view),
    })),
  }));
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

// Twelve entries at 11px overflow the 260px chart a phone gets, and the box
// follows the cursor so it cannot be scrolled to reach the rest.
const TOOLTIP_ROW_CAP = 8;

// Dots read as a lattice on an ordinary table and as a smear once the points
// are a pixel apart, which is also where they stop being affordable.
const DOT_BUDGET = 1200;

// The lit overlay stays mounted with nothing to draw rather than unmounting,
// so Recharts registers its zIndex layer once and never switches portals.
const EMPTY_POINTS: never[] = [];
const LIT_ACTIVE_DOT = { r: 5, strokeWidth: 0 } as const;

interface ChartTooltipProps {
  active?: boolean | undefined;
  label?: string | number | undefined;
  coordinate?: { x?: number; y?: number } | undefined;
  series: RowSeries[];
  view: ChartView;
  /** Rows whose bar is capped on the PMF view; their real number lives here. */
  spikeIds: ReadonlySet<string>;
  /** The lit roll, pinned to the top so the row cap can never drop it. */
  focusedId?: string | null | undefined;
}

// Values are computed from the series rather than read out of Recharts'
// payload, because each series now carries its own data: a row whose support
// does not cover the hovered x has no payload entry at all. evalSeriesAt is the
// same function that drew the curve, so the tooltip cannot disagree with the
// line it is explaining.
//
// Each row carries its series-color swatch (matching the table and legend
// swatches by color), so identically named rows stay distinguishable.
//
// The panel ground rather than bg.inverted, which every other overlay in the app
// already uses. bg.inverted flips from near-black in light mode to near-white in
// dark, and a swatch set that had to clear 3:1 on both of those as well as on
// the row grounds had no luminance window left to separate eight hues in.
function ChartTooltip({
  active,
  label,
  coordinate,
  series,
  view,
  spikeIds,
  focusedId = null,
}: ChartTooltipProps) {
  const yInverse = useYAxisInverseScale();
  if (!active || series.length === 0) return null;
  const x = typeof label === 'number' ? label : Number(label);
  if (!Number.isFinite(x)) return null;

  const rows = series.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    value: evalSeriesAt(s, x, view),
  }));
  // Ranked by distance from the pointer, because at a given x most rows are
  // often saturated at the same value and the one still moving is the one worth
  // reading. Falls back to table order when the scale is unavailable, never to
  // value order: that actively buries the varying row under the flat ones.
  const at = coordinate?.y !== undefined && yInverse ? yInverse(coordinate.y) : null;
  // A capped bar's true value is promised to be on the tooltip, so a row that
  // owns one is never the row the cap drops.
  const ordered = [...rows].sort((a, b) => {
    const spiked = Number(spikeIds.has(b.id)) - Number(spikeIds.has(a.id));
    if (spiked !== 0) return spiked;
    if (typeof at !== 'number' || !Number.isFinite(at)) return 0;
    return Math.abs(a.value - at) - Math.abs(b.value - at);
  });
  // The lit row is a row above the cap rather than the first of the capped
  // ones: the spiked rows keep the places they were promised.
  const { pinned, shown, hidden } = partitionTooltipRows(
    ordered,
    focusedId,
    TOOLTIP_ROW_CAP,
  );

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
      maxW="min(280px, 70vw)"
      maxH="240px"
      overflow="hidden"
    >
      <Text fontWeight={600} mb={1}>
        Result: {x}
      </Text>
      <Stack gap={1}>
        {pinned !== null && (
          <HStack gap={4} justify="space-between" fontWeight={600} color="fg">
            <HStack gap={1.5} minW={0}>
              <Box
                w="8px"
                h="8px"
                borderRadius="2px"
                bg={pinned.color}
                flexShrink={0}
              />
              <Text truncate>{pinned.name}</Text>
            </HStack>
            <Text
              fontFamily="mono"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTooltipValue(pinned.value)}
            </Text>
          </HStack>
        )}
        {shown.map((row) => (
          <HStack key={row.id} gap={4} justify="space-between">
            <HStack gap={1.5} minW={0}>
              <Box
                w="8px"
                h="8px"
                borderRadius="2px"
                bg={row.color}
                flexShrink={0}
              />
              <Text truncate>{row.name}</Text>
            </HStack>
            <Text
              fontFamily="mono"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTooltipValue(row.value)}
            </Text>
          </HStack>
        ))}
        {hidden > 0 && <Text color="fg.muted">+{hidden} more</Text>}
      </Stack>
    </Box>
  );
}

export default function OverlayChartImpl({
  expressions,
  dists,
  effectiveView,
  target,
  focusedId: incomingFocus,
  slots,
  unit = 'totals',
  height,
}: OverlayChartImplProps) {
  const series = useMemo(
    () => buildSeries(expressions, dists, slots),
    [expressions, dists, slots],
  );
  const plotted = useMemo(
    () => buildPlotted(series, effectiveView),
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
  const spikeIds = useMemo(
    () => new Set(spikes.markers.map((m) => m.id)),
    [spikes],
  );
  // Past the threshold the curves are a field rather than a set of pens, and
  // the pen it hands back is a module constant, so a focus change touches no
  // series prop at all: the opacity moves in CSS instead.
  const pen = fieldPen(plotted.length, effectiveView);
  const field = pen !== null;

  const showDots = useMemo(() => {
    if (pen !== null) return false;
    let points = 0;
    for (const p of plotted) points += p.points.length;
    return points <= DOT_BUDGET;
  }, [plotted, pen]);

  const focusedId =
    incomingFocus !== null && series.some((s) => s.id === incomingFocus)
      ? incomingFocus
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

  const lit =
    focusedId === null ? null : plotted.find((p) => p.id === focusedId) ?? null;
  // A hundred capped-bar markers pile into one column and stop being labels.
  // Only the drawing is capped: missDescription below still names every row
  // that misses, so the number is never lost, just not stacked on itself.
  const drawnMarkers = field
    ? spikes.markers.slice(0, SPIKE_MARKER_DRAW_CAP)
    : spikes.markers;

  return (
    <>
      <Box
        w="100%"
        h={height ?? { base: '260px', md: '320px' }}
        {...(pen !== null ? { css: pen.css } : {})}
        {...(field && focusedId !== null ? { 'data-lit': '' } : {})}
      >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 1, height: 1 }}
      >
        <ComposedChart
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
            content={
              <ChartTooltip
                series={series}
                view={effectiveView}
                spikeIds={spikeIds}
                focusedId={field ? focusedId : null}
              />
            }
          />
          {/* Two pens, and the field one is a separate branch rather than a
              tuning of the other. The sparse branch below is what a rail and a
              phone draw, it has no measured problem, and its dots composite
              against a per-series opacity the field does not have.
              No dash on either field curve or lit curve. Dash is an identity
              channel, and a field is the surface that has given up on per-curve
              identity by construction: eight patterns across a hundred rolls
              name nothing, and at this weight and opacity they only fray the
              mass the field exists to show. The lit curve has no one to be told
              apart from. */}
          {field && pen !== null
            ? plotted.map((s) => (
                <Line
                  key={s.id}
                  data={s.points}
                  dataKey={s.id}
                  name={s.name}
                  type={effectiveView === 'pmf' ? 'step' : 'monotone'}
                  stroke={s.color}
                  strokeWidth={pen.width}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ))
            : effectiveView === 'pmf'
            ? plotted.map((s) => {
                const focused = focusedId === s.id;
                const opacity =
                  focusedId === null ? 0.9 : focused ? 1 : 0.2;
                return (
                  <Line
                    key={s.id}
                    data={s.points}
                    dataKey={s.id}
                    name={s.name}
                    type="step"
                    stroke={s.color}
                    strokeWidth={focused ? 2.25 : 1.75}
                    strokeOpacity={opacity}
                    strokeDasharray={seriesDash(s.slot)}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                );
              })
            : plotted.map((s) => {
                const focused = focusedId === s.id;
                const opacity =
                  focusedId === null ? 0.9 : focused ? 1 : 0.2;
                return (
                  <Line
                    key={s.id}
                    data={s.points}
                    dataKey={s.id}
                    name={s.name}
                    type="monotone"
                    stroke={s.color}
                    strokeWidth={focused ? 3 : 2.5}
                    strokeOpacity={opacity}
                    strokeDasharray={seriesDash(s.slot)}
                    dot={
                      showDots
                        ? {
                            r: 3,
                            fill: s.color,
                            stroke: 'var(--chakra-colors-bg-panel)',
                            strokeWidth: 1.5,
                            opacity,
                          }
                        : false
                    }
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                );
              })}
          {/* The lit roll, painted in its own layer one step above the field.
              Every field curve is in the layer Recharts portals Line into, so
              being last in this array would not put a stroke on top of them;
              a different zIndex is a different portal, which does. It stays
              mounted with nothing to draw so that layer is registered once. */}
          {field && pen !== null && (
            <Line
              key="dt-lit-overlay"
              className={LIT_CLASS}
              zIndex={LIT_Z_INDEX}
              data={lit?.points ?? EMPTY_POINTS}
              dataKey={lit?.id ?? 'dt-lit'}
              name={lit?.name ?? ''}
              type={effectiveView === 'pmf' ? 'step' : 'monotone'}
              stroke={lit?.color ?? 'none'}
              strokeWidth={pen.litWidth}
              strokeOpacity={1}
              dot={false}
              activeDot={LIT_ACTIVE_DOT}
              isAnimationActive={false}
            />
          )}
          {/* The capped bars keep their true value everywhere it can be read:
              the label here, the tooltip at 0, and the description below. */}
          {drawnMarkers.map((marker) => (
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
