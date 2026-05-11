import { useMemo } from 'react';
import { Text } from '@chakra-ui/react';
import type { ChartView, Distribution, TargetState } from '../../types';
import { sortedKeys } from '../../engine/distribution';
import { useApp } from '../../state/useApp';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import { buildStepAreaPath, buildStepPath, type Point } from './stepPath';
import { buildMonotonePath } from './monotonePath';

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

interface HitZone {
  x: number;
  w: number;
  tip: string;
}

interface SparklineGeometry {
  topPoints: Point[];
  hitZones: HitZone[];
  modeIndex: number;
  matchMask: boolean[];
  stepWidth: number;
  baselineY: number;
  effectiveView: ChartView;
  empty: boolean;
}

const EMPTY_GEOM: SparklineGeometry = {
  topPoints: [],
  hitZones: [],
  modeIndex: -1,
  matchMask: [],
  stepWidth: 0,
  baselineY: 0,
  effectiveView: 'pmf',
  empty: true,
};

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
  if (dist.size === 0) return EMPTY_GEOM;
  const keys = sortedKeys(dist);
  const min = keys[0]!;
  const max = keys[keys.length - 1]!;
  const span = max - min + 1;

  const effectiveView: ChartView =
    view === 'target' && (!target || target.values.length === 0) ? 'pmf' : view;

  const baselineY = height - 0.5;
  const usableHeight = baselineY;
  const stepWidth = width / span;

  const heightAt = new Array<number>(span);
  const tipAt = new Array<string>(span);

  if (effectiveView === 'pmf' || effectiveView === 'target') {
    let maxP = 0;
    for (const p of dist.values()) {
      if (p > maxP) maxP = p;
    }
    if (maxP === 0) return EMPTY_GEOM;
    for (let i = 0; i < span; i++) {
      const xValue = min + i;
      const p = dist.get(xValue) ?? 0;
      heightAt[i] = (p / maxP) * usableHeight;
      tipAt[i] = `${xValue}: ${formatPct(p)}`;
    }
  } else if (effectiveView === 'cdf') {
    let cum = 0;
    for (let i = 0; i < span; i++) {
      const xValue = min + i;
      cum += dist.get(xValue) ?? 0;
      heightAt[i] = cum * usableHeight;
      tipAt[i] = `≤ ${xValue}: ${formatPct(cum)}`;
    }
  } else {
    let cum = 1;
    for (let i = 0; i < span; i++) {
      const xValue = min + i;
      heightAt[i] = cum * usableHeight;
      tipAt[i] = `≥ ${xValue}: ${formatPct(cum)}`;
      cum -= dist.get(xValue) ?? 0;
    }
  }

  const topPoints: Point[] = new Array(span);
  const hitZones: HitZone[] = new Array(span);
  for (let i = 0; i < span; i++) {
    const x = i * stepWidth;
    const y = baselineY - heightAt[i]!;
    topPoints[i] = { x, y };
    hitZones[i] = { x, w: stepWidth, tip: tipAt[i]! };
  }

  let modeIndex = -1;
  if (effectiveView === 'pmf' || effectiveView === 'target') {
    let maxP = 0;
    let modeCount = 0;
    let modeAt = -1;
    for (let i = 0; i < span; i++) {
      const xValue = min + i;
      const p = dist.get(xValue) ?? 0;
      if (p > maxP) {
        maxP = p;
        modeCount = 1;
        modeAt = i;
      } else if (p === maxP) {
        modeCount++;
      }
    }
    if (modeCount === 1) modeIndex = modeAt;
  }

  const matchMask = new Array<boolean>(span).fill(false);
  if (effectiveView === 'target' && target && target.values.length > 0) {
    for (let i = 0; i < span; i++) {
      matchMask[i] = targetMatches(min + i, target);
    }
  }

  return {
    topPoints,
    hitZones,
    modeIndex,
    matchMask,
    stepWidth,
    baselineY,
    effectiveView,
    empty: false,
  };
}

function buildMatchAreaPath(
  topPoints: Point[],
  matchMask: boolean[],
  baselineY: number,
  stepWidth: number,
): string {
  let d = '';
  for (let i = 0; i < topPoints.length; i++) {
    if (!matchMask[i]) continue;
    const p = topPoints[i]!;
    if (d.length > 0) d += ' ';
    d += `M ${p.x} ${baselineY} L ${p.x} ${p.y} L ${p.x + stepWidth} ${p.y} L ${p.x + stepWidth} ${baselineY} Z`;
  }
  return d;
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
  const geom = useMemo(
    () => buildGeometry(dist, view, target, width, height),
    [dist, view, target, width, height],
  );

  if (geom.empty) return null;

  const {
    topPoints,
    hitZones,
    modeIndex,
    matchMask,
    stepWidth,
    baselineY,
    effectiveView,
  } = geom;
  const stepOpts = { stepWidth };
  const isFilledView = effectiveView === 'pmf' || effectiveView === 'target';
  const isLineView = effectiveView === 'cdf' || effectiveView === 'ccdf';
  const hasMatchOverlay =
    effectiveView === 'target' && matchMask.some((m) => m);

  const areaD = isFilledView ? buildStepAreaPath(topPoints, baselineY, stepOpts) : '';
  const pmfStrokeD = effectiveView === 'pmf' ? buildStepPath(topPoints, stepOpts) : '';
  const curveD = isLineView
    ? buildMonotonePath(
        topPoints.length > 1
          ? topPoints.map((p, i) => ({
              x: (i / (topPoints.length - 1)) * width,
              y: p.y,
            }))
          : topPoints,
      )
    : '';
  const matchD = hasMatchOverlay
    ? buildMatchAreaPath(topPoints, matchMask, baselineY, stepWidth)
    : '';

  const showModeTick = isFilledView && modeIndex >= 0;
  const modePoint = showModeTick ? topPoints[modeIndex] : undefined;
  const modeCx = modePoint ? modePoint.x + stepWidth / 2 : 0;
  const modeTopY = modePoint ? modePoint.y : 0;

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
      <line
        x1={0}
        x2={width}
        y1={baselineY}
        y2={baselineY}
        stroke="var(--chakra-colors-border-subtle)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {isFilledView && (
        <path
          d={areaD}
          fill={color}
          fillOpacity={effectiveView === 'target' ? 0.18 : 0.22}
        />
      )}
      {hasMatchOverlay && (
        <path d={matchD} fill={color} fillOpacity={0.55} />
      )}
      {effectiveView === 'pmf' && (
        <path
          d={pmfStrokeD}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {isLineView && (
        <path
          d={curveD}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {modePoint && (
        <line
          x1={modeCx}
          x2={modeCx}
          y1={baselineY}
          y2={modeTopY}
          stroke={color}
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {hitZones.map((b, i) => (
        <rect
          key={`hit-${i}`}
          x={b.x}
          y={0}
          width={b.w}
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
