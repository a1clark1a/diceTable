import { useMemo } from "react";
import {
  Box,
  Button,
  HStack,
  Stack,
  Text,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { ChartColumn } from "lucide-react";
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
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "../../state/useApp";
import { useDistributions } from "../../state/useDistributions";
import { sortedKeys } from "../../engine/distribution";
import { hitProbability } from "../../engine/stats";
import type {
  ChartView,
  Distribution,
  Expression,
  TargetRuling,
  TargetState,
} from "../../types";
import { rowColor } from "./palette";
import { Tooltip } from "../ui/tooltip";
import { TIPS } from "../ui/tips";
import { formatPercent } from "./format";

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

interface HitBar {
  id: string;
  name: string;
  color: string;
  hit: number;
}

const VIEW_OPTIONS: { value: ChartView; label: string; tip: string }[] = [
  { value: "pmf", label: "PMF", tip: TIPS.pmf },
  { value: "cdf", label: "CDF", tip: TIPS.cdf },
  { value: "ccdf", label: "CCDF", tip: TIPS.ccdf },
  { value: "target", label: "TARGET", tip: TIPS.targetView },
];

const CHART_ROW_LIMIT = 20;

const RULING_SYMBOL: Record<TargetRuling, string> = {
  gte: "≥",
  gt: ">",
  lte: "≤",
  lt: "<",
  eq: "=",
};

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
    case "pmf":
    case "target":
      return s.dist.get(x) ?? 0;
    case "cdf": {
      if (x < s.min) return 0;
      if (x >= s.max) return 1;
      return s.cdf[x - s.min] ?? 0;
    }
    case "ccdf": {
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

function buildHitBars(series: RowSeries[], target: TargetState): HitBar[] {
  if (target.value === null) return [];
  const value = target.value;
  return series.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    hit: hitProbability(s.dist, value, target.ruling),
  }));
}

function formatPctTick(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatTooltipValue(value: number | string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export function OverlayChart() {
  const { expressions, chartView, setChartView, target } = useApp();
  const { dists } = useDistributions();

  const overLimit = expressions.length > CHART_ROW_LIMIT;
  const hasTarget = target.value !== null;
  const effectiveView: ChartView =
    chartView === "target" && !hasTarget ? "pmf" : chartView;

  const visibleViews = useMemo(
    () => VIEW_OPTIONS.filter((v) => v.value !== "target" || hasTarget),
    [hasTarget],
  );

  const series = useMemo(
    () => (overLimit ? [] : buildSeries(expressions, dists)),
    [overLimit, expressions, dists],
  );
  const data = useMemo(
    () => buildChartData(series, effectiveView),
    [series, effectiveView],
  );
  const hitBars = useMemo(
    () => (effectiveView === "target" ? buildHitBars(series, target) : []),
    [series, target, effectiveView],
  );

  const yDomain: [number, number | "auto"] =
    effectiveView === "pmf" ? [0, "auto"] : [0, 1];
  const showLegend = !overLimit && series.length > 0 && effectiveView !== "target";

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
        {overLimit ? (
          <Stack
            minH="280px"
            align="center"
            justify="center"
            gap={3}
            color="fg.muted"
            textAlign="center"
            px={4}
          >
            <ChartColumn size={28} strokeWidth={1.5} aria-hidden />
            <Text fontSize="sm" maxW="48ch">
              Comparison chart is disabled past {CHART_ROW_LIMIT} rolls
              (currently {expressions.length}). Remove rows to re-enable —
              per-row stats remain in the table above.
            </Text>
          </Stack>
        ) : (
          <>
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
                    variant={active ? "solid" : "ghost"}
                    colorPalette={active ? "blue" : "gray"}
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
              {series.map((s) => (
                <WrapItem key={s.id}>
                  <HStack gap={2}>
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
              ))}
            </Wrap>
          )}
        </HStack>

        {series.length === 0 ? (
          <Stack
            minH="280px"
            align="center"
            justify="center"
            gap={3}
            color="fg.muted"
          >
            <ChartColumn size={28} strokeWidth={1.5} aria-hidden />
            <Text fontSize="sm">No valid rows yet — add a roll above.</Text>
          </Stack>
        ) : effectiveView === "target" && target.value !== null ? (
          <TargetHitView bars={hitBars} target={target} />
        ) : (
          <Box w="100%" h={{ base: "260px", md: "320px" }}>
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 1, height: 1 }}
            >
              <ComposedChart
                data={data}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                barGap={0}
                barCategoryGap="10%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--chakra-colors-border-subtle)"
                  vertical={false}
                />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  padding={{ left: 8, right: 8 }}
                  tickLine={false}
                  axisLine={{
                    stroke: "var(--chakra-colors-border-emphasized)",
                  }}
                  tick={{
                    fontSize: 11,
                    fill: "var(--chakra-colors-fg-muted)",
                    fontFamily: "ui-monospace, monospace",
                  }}
                  allowDecimals={false}
                />
                <YAxis
                  tickFormatter={formatPctTick}
                  tickLine={false}
                  axisLine={{
                    stroke: "var(--chakra-colors-border-emphasized)",
                  }}
                  tick={{
                    fontSize: 11,
                    fill: "var(--chakra-colors-fg-muted)",
                    fontFamily: "ui-monospace, monospace",
                  }}
                  domain={yDomain}
                  {...(effectiveView !== "pmf" && {
                    ticks: [0, 0.25, 0.5, 0.75, 1],
                  })}
                  width={48}
                />
                <RechartsTooltip
                  cursor={{ fill: "var(--chakra-colors-bg-emphasized)" }}
                  formatter={(value, name) => [
                    formatTooltipValue(value as number),
                    name,
                  ]}
                  labelFormatter={(label) => `Result: ${label}`}
                  contentStyle={{
                    backgroundColor: "var(--chakra-colors-bg-inverted)",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 11,
                    color: "var(--chakra-colors-fg-inverted)",
                    padding: "6px 10px",
                  }}
                  itemStyle={{ color: "var(--chakra-colors-fg-inverted)" }}
                  labelStyle={{
                    color: "var(--chakra-colors-fg-inverted)",
                    fontWeight: 600,
                  }}
                />
                {effectiveView === "pmf"
                  ? series.map((s) => (
                      <Bar
                        key={s.id}
                        dataKey={s.id}
                        name={s.name}
                        fill={s.color}
                        fillOpacity={0.7}
                        radius={[2, 2, 0, 0]}
                        isAnimationActive={false}
                      />
                    ))
                  : series.map((s) => (
                      <Line
                        key={s.id}
                        dataKey={s.id}
                        name={s.name}
                        type="monotone"
                        stroke={s.color}
                        strokeWidth={2.5}
                        dot={{
                          r: 3,
                          fill: s.color,
                          stroke: "var(--chakra-colors-bg-panel)",
                          strokeWidth: 1.5,
                        }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        isAnimationActive={false}
                      />
                    ))}
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        )}
          </>
        )}
      </Box>
    </Stack>
  );
}

interface TargetHitViewProps {
  bars: HitBar[];
  target: TargetState;
}

function formatPctLabel(
  value: string | number | boolean | null | undefined,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return formatPercent(value);
}

function TargetHitView({ bars, target }: TargetHitViewProps) {
  if (target.value === null) return null;
  return (
    <Stack gap={3}>
      <Text
        fontSize="xs"
        color="fg.muted"
        fontFamily="mono"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        Hit rate · Target {RULING_SYMBOL[target.ruling]} {target.value}
      </Text>
      <Box
        w="100%"
        h={{ base: "260px", md: "320px" }}
        maxW={`${bars.length * 100 + 96}px`}
        mx="auto"
        role="img"
        aria-label={`Hit rate per roll for target ${RULING_SYMBOL[target.ruling]} ${target.value}`}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 1, height: 1 }}
        >
          <BarChart
            data={bars}
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
                stroke: "var(--chakra-colors-border-emphasized)",
              }}
              tick={{
                fontSize: 11,
                fill: "var(--chakra-colors-fg-muted)",
              }}
            />
            <YAxis
              tickFormatter={formatPctTick}
              tickLine={false}
              axisLine={{
                stroke: "var(--chakra-colors-border-emphasized)",
              }}
              tick={{
                fontSize: 11,
                fill: "var(--chakra-colors-fg-muted)",
                fontFamily: "ui-monospace, monospace",
              }}
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              width={48}
            />
            <RechartsTooltip
              cursor={{ fill: "var(--chakra-colors-bg-emphasized)" }}
              formatter={(value) => [
                formatTooltipValue(value as number),
                "Hit",
              ]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                backgroundColor: "var(--chakra-colors-bg-inverted)",
                border: "none",
                borderRadius: 4,
                fontSize: 11,
                color: "var(--chakra-colors-fg-inverted)",
                padding: "6px 10px",
              }}
              itemStyle={{ color: "var(--chakra-colors-fg-inverted)" }}
              labelStyle={{
                color: "var(--chakra-colors-fg-inverted)",
                fontWeight: 600,
              }}
            />
            <Bar
              dataKey="hit"
              name="Hit"
              fillOpacity={0.85}
              radius={[2, 2, 0, 0]}
              maxBarSize={72}
              isAnimationActive={false}
            >
              {bars.map((b) => (
                <Cell key={b.id} fill={b.color} />
              ))}
              <LabelList
                dataKey="hit"
                position="top"
                formatter={formatPctLabel}
                style={{
                  fill: "var(--chakra-colors-fg)",
                  fontSize: 11,
                  fontFamily: "ui-monospace, monospace",
                  fontVariantNumeric: "tabular-nums",
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Stack>
  );
}
