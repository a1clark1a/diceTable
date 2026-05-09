import { useMemo } from 'react';
import { Text } from '@chakra-ui/react';
import type { ChartView, Distribution, TargetState } from '../../types';
import { sortedKeys } from '../../engine/distribution';
import { useApp } from '../../state/useApp';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';

const VIEW_LABELS: Record<ChartView, { text: string; tip: string }> = {
  pmf: { text: 'PMF', tip: tipForId('pmf') },
  cdf: { text: 'CDF', tip: tipForId('cdf') },
  ccdf: { text: 'CCDF', tip: tipForId('ccdf') },
  target: { text: 'Target', tip: tipForId('targetView') },
};

function useEffectiveChartView(): ChartView {
  const { chartView, target } = useApp();
  return chartView === 'target' && target.values.length === 0 ? 'pmf' : chartView;
}

export function ShapeHeaderLabel() {
  const view = useEffectiveChartView();
  const { text, tip } = VIEW_LABELS[view];
  return <HelpTerm tip={tip}>{text}</HelpTerm>;
}

export function ShapeCardLabel() {
  const view = useEffectiveChartView();
  return (
    <Text
      as="span"
      fontSize="2xs"
      fontWeight="semibold"
      color="fg.muted"
      textTransform="uppercase"
      letterSpacing="wider"
      flexShrink={0}
      minW="40px"
    >
      {VIEW_LABELS[view].text}
    </Text>
  );
}

interface SparklineProps {
  dist: Distribution;
  color: string;
  view?: ChartView;
  target?: TargetState | undefined;
  width?: number;
  height?: number;
  fill?: boolean;
  ariaLabel?: string;
}

interface SparklineBar {
  x: number;
  y: number;
  w: number;
  h: number;
  hitX: number;
  hitW: number;
  tip: string;
  faded: boolean;
}

interface SparklineGeometry {
  bars: SparklineBar[];
  empty: boolean;
}

function formatPct(p: number): string {
  if (p <= 1e-9) return '0%';
  if (p >= 1 - 1e-9) return '100%';
  if (p < 0.001) return '<0.1%';
  return `${(p * 100).toFixed(1)}%`;
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

function buildGeometry(
  dist: Distribution,
  view: ChartView,
  target: TargetState | undefined,
  width: number,
  height: number,
): SparklineGeometry {
  if (dist.size === 0) return { bars: [], empty: true };
  const keys = sortedKeys(dist);
  const min = keys[0]!;
  const max = keys[keys.length - 1]!;
  const span = max - min + 1;

  const effectiveView: ChartView =
    view === 'target' && (!target || target.values.length === 0) ? 'pmf' : view;

  const heightAt = new Array<number>(span);
  const tipAt = new Array<string>(span);

  if (effectiveView === 'pmf' || effectiveView === 'target') {
    let maxP = 0;
    for (const p of dist.values()) {
      if (p > maxP) maxP = p;
    }
    if (maxP === 0) return { bars: [], empty: true };
    for (let i = 0; i < span; i++) {
      const xValue = min + i;
      const p = dist.get(xValue) ?? 0;
      heightAt[i] = (p / maxP) * height;
      tipAt[i] = `${xValue}: ${formatPct(p)}`;
    }
  } else if (effectiveView === 'cdf') {
    let cum = 0;
    for (let i = 0; i < span; i++) {
      const xValue = min + i;
      cum += dist.get(xValue) ?? 0;
      heightAt[i] = cum * height;
      tipAt[i] = `≤ ${xValue}: ${formatPct(cum)}`;
    }
  } else {
    let cum = 1;
    for (let i = 0; i < span; i++) {
      const xValue = min + i;
      heightAt[i] = cum * height;
      tipAt[i] = `≥ ${xValue}: ${formatPct(cum)}`;
      cum -= dist.get(xValue) ?? 0;
    }
  }

  const barWidth = width / span;
  const innerWidth = Math.max(barWidth - 0.75, 1);
  const bars = new Array<SparklineBar>(span);
  for (let i = 0; i < span; i++) {
    const xValue = min + i;
    const h = heightAt[i]!;
    const faded =
      effectiveView === 'target' && target ? !targetMatches(xValue, target) : false;
    bars[i] = {
      x: i * barWidth,
      y: height - h,
      w: innerWidth,
      h,
      hitX: i * barWidth,
      hitW: barWidth,
      tip: tipAt[i]!,
      faded,
    };
  }
  return { bars, empty: false };
}

export function Sparkline({
  dist,
  color,
  view = 'pmf',
  target,
  width = 80,
  height = 24,
  fill = false,
  ariaLabel,
}: SparklineProps) {
  const { bars, empty } = useMemo(
    () => buildGeometry(dist, view, target, width, height),
    [dist, view, target, width, height],
  );

  if (empty) return null;

  return (
    <svg
      width={fill ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fill ? 'none' : 'xMidYMid meet'}
      role="img"
      aria-label={ariaLabel ?? 'Distribution shape'}
      style={{ display: 'block' }}
    >
      {bars.map((b, i) => (
        <rect
          key={`bar-${i}`}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          fill={color}
          fillOpacity={b.faded ? 0.18 : 0.75}
          rx={0.5}
        />
      ))}
      {bars.map((b, i) => (
        <rect
          key={`hit-${i}`}
          x={b.hitX}
          y={0}
          width={b.hitW}
          height={height}
          fill="transparent"
          style={{ pointerEvents: 'all' }}
        >
          <title>{b.tip}</title>
        </rect>
      ))}
    </svg>
  );
}

interface RowSparklineProps {
  dist: Distribution;
  color: string;
  exprName: string;
  height?: number;
  fill?: boolean;
}

export function RowSparkline({
  dist,
  color,
  exprName,
  height,
  fill,
}: RowSparklineProps) {
  const { chartView, target } = useApp();
  return (
    <Sparkline
      dist={dist}
      color={color}
      view={chartView}
      target={target}
      {...(height !== undefined && { height })}
      {...(fill !== undefined && { fill })}
      ariaLabel={`Distribution shape for ${exprName}`}
    />
  );
}
