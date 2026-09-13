import { memo, useMemo } from 'react';
import { Text } from '@chakra-ui/react';
import type {
  ChartView,
  Distribution,
  ExpressionMode,
  TargetState,
} from '../../types';
import { sortedKeys } from '../../engine/distribution';
import { canMiss, isTotalsMode } from '../../engine/expression';
import { useApp } from '../../state/useApp';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import { buildStepAreaPath, buildStepPath, type Point } from './stepPath';
import { buildMonotonePath } from './monotonePath';
import { shapeHeaderView } from './effectiveView';
import { missProbability, rowPeak } from './zeroSpike';

const VIEW_LABELS: Record<ChartView, { text: string; tip: string }> = {
  pmf: { text: 'PMF', tip: tipForId('pmf') },
  cdf: { text: 'CDF', tip: tipForId('cdf') },
  ccdf: { text: 'CCDF', tip: tipForId('ccdf') },
  target: { text: 'Target', tip: tipForId('targetView') },
};

export function ShapeHeaderLabel() {
  const { chartViews, target, poolTargets, expressions } = useApp();
  const view = shapeHeaderView(chartViews.shape, target, poolTargets, expressions);
  if (view === null) {
    return <HelpTerm tip={tipForId('shapeMixed')}>Shape</HelpTerm>;
  }
  const { text, tip } = VIEW_LABELS[view];
  return <HelpTerm tip={tip}>{text}</HelpTerm>;
}

interface ShapeCardLabelProps {
  view: ChartView;
}

export function ShapeCardLabel({ view }: ShapeCardLabelProps) {
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
  mode?: ExpressionMode;
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
  cappedIndex: number;
  modeIndex: number;
  matchMask: boolean[];
  stepWidth: number;
  baselineY: number;
  effectiveView: ChartView;
  empty: boolean;
}

// Tallest PMF bar reaches this fraction of the box height; the rest is headroom
// so a uniform distribution reads as a low line with light fill, not a slab.
const PMF_FILL_SCALE = 0.84;

const EMPTY_GEOM: SparklineGeometry = {
  topPoints: [],
  hitZones: [],
  cappedIndex: -1,
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

// The box is 80 units wide, so a 1,981-value row gives each result 0.04 of a
// unit: unreadable, untappable, and one DOM node pair each in a column that
// draws one of these per row with no virtualization. Forty buckets is two units
// apiece, which is a fingertip. A row with fewer results than this keeps one
// bucket per result and is drawn exactly as it was.
const SPARK_BUCKETS = 40;

function buildGeometry(
  dist: Distribution,
  view: ChartView,
  target: TargetState | undefined,
  width: number,
  height: number,
  canMiss: boolean,
): SparklineGeometry {
  if (dist.size === 0) return EMPTY_GEOM;
  const keys = sortedKeys(dist);
  const min = keys[0]!;
  const max = keys[keys.length - 1]!;
  const span = max - min + 1;

  const resolvedView: ChartView =
    view === 'target' && (!target || target.values.length === 0) ? 'pmf' : view;

  const baselineY = height - 0.5;
  const usableHeight = baselineY;

  const heightAt = new Array<number>(span);
  const tipAt = new Array<string>(span);
  // Only the pmf-shaped views aggregate by adding; the cumulative ones read an
  // edge instead, because summing running totals prints a number no roll makes.
  const massAt = new Array<number>(span).fill(0);

  let cappedIndex = -1;

  if (resolvedView === 'pmf' || resolvedView === 'target') {
    // A check row's miss bar is left out of the scale for the same reason the
    // big chart leaves it out: it would squash the row's own shape flat. The
    // bar is drawn cut off instead, and the hover tip keeps the true number.
    const rawPeak = rowPeak(dist, canMiss);
    const miss = missProbability(dist, canMiss);
    // With only its own row to scale against, a row that only ever misses
    // keeps the miss bar as the scale instead of rendering nothing.
    const maxP = rawPeak > 0 ? rawPeak : miss;
    if (maxP === 0) return EMPTY_GEOM;
    // PMF heights are normalized to the row's own max, so a flat (uniform)
    // distribution would otherwise fill the whole box. Leaving headroom keeps
    // the top stroke off the ceiling so it reads as a low line, not a slab.
    const filledHeight = usableHeight * PMF_FILL_SCALE;
    for (let i = 0; i < span; i++) {
      const xValue = min + i;
      const p = dist.get(xValue) ?? 0;
      heightAt[i] = Math.min(p / maxP, 1) * filledHeight;
      massAt[i] = p;
      tipAt[i] = `${xValue}: ${formatPct(p)}`;
      if (canMiss && xValue === 0 && miss > maxP) cappedIndex = i;
    }
  } else if (resolvedView === 'cdf') {
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

  // One bucket per result until the row outgrows the budget. Every structure
  // below is reduced on this same index, so the curve, the hit zones, the mode
  // marker and the target overlay cannot fall out of step with each other.
  const buckets = Math.min(span, SPARK_BUCKETS);
  const perBucket = span / buckets;
  const bucketOf = (i: number): number =>
    Math.min(buckets - 1, Math.floor(i / perBucket));
  const bucketStep = width / buckets;

  const topPoints: Point[] = new Array(buckets);
  const hitZones: HitZone[] = new Array(buckets);
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * perBucket);
    const to = Math.min(span, Math.floor((b + 1) * perBucket)) - 1;
    const x = b * bucketStep;

    let y: number;
    let tip: string;
    if (resolvedView === 'cdf') {
      // Cumulative: the bucket's value is the running total at its far edge.
      y = baselineY - heightAt[to]!;
      tip = tipAt[to]!;
    } else if (resolvedView === 'ccdf') {
      y = baselineY - heightAt[from]!;
      tip = tipAt[from]!;
    } else {
      // The tallest result in the bucket, so a peak is never flattened by the
      // ones beside it. The tip adds the masses instead, because the honest
      // answer for a range is the chance of landing anywhere in it.
      let tallest = heightAt[from]!;
      let mass = 0;
      for (let i = from; i <= to; i++) {
        if (heightAt[i]! > tallest) tallest = heightAt[i]!;
        mass += massAt[i]!;
      }
      y = baselineY - tallest;
      tip =
        from === to
          ? tipAt[from]!
          : `${min + from} to ${min + to}: ${formatPct(mass)}`;
    }

    topPoints[b] = { x, y };
    hitZones[b] = { x, w: bucketStep, tip };
  }

  let modeIndex = -1;
  if (resolvedView === 'pmf' || resolvedView === 'target') {
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
  // Both markers point at a result; once results share a bucket they have to
  // point at the bucket that holds it.
  if (modeIndex >= 0) modeIndex = bucketOf(modeIndex);
  if (cappedIndex >= 0) cappedIndex = bucketOf(cappedIndex);

  // A bucket is highlighted when any result inside it matches, so the overlay
  // never loses a hit to rounding.
  const matchMask = new Array<boolean>(buckets).fill(false);
  if (resolvedView === 'target' && target && target.values.length > 0) {
    for (let i = 0; i < span; i++) {
      if (targetMatches(min + i, target)) matchMask[bucketOf(i)] = true;
    }
  }

  return {
    topPoints,
    hitZones,
    cappedIndex,
    modeIndex,
    matchMask,
    stepWidth: bucketStep,
    baselineY,
    effectiveView: resolvedView,
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

export const Sparkline = memo(function Sparkline({
  dist,
  color,
  view = 'pmf',
  target,
  mode = 'sum',
  width = 80,
  height = 24,
  fill = false,
  ariaLabel,
}: SparklineProps) {
  const geom = useMemo(
    () => buildGeometry(dist, view, target, width, height, canMiss({ mode })),
    [dist, view, target, width, height, mode],
  );

  if (geom.empty) return null;

  const {
    topPoints,
    hitZones,
    cappedIndex,
    modeIndex,
    matchMask,
    stepWidth,
    baselineY,
    effectiveView,
  } = geom;
  const stepOpts = { stepWidth };
  const isFilledView = effectiveView === 'pmf' || effectiveView === 'target';
  const isLineView = effectiveView === 'cdf' || effectiveView === 'ccdf';
  // Pool distributions count discrete successes, so the filled views render
  // one bar per count (a ladder) instead of a continuous stepped area. The
  // cumulative views keep the shared curve rendering.
  const isPoolLadder = !isTotalsMode({ mode }) && isFilledView;
  const hasMatchOverlay =
    effectiveView === 'target' && matchMask.some((m) => m);

  const areaD =
    isFilledView && !isPoolLadder
      ? buildStepAreaPath(topPoints, baselineY, stepOpts)
      : '';
  const pmfStrokeD =
    effectiveView === 'pmf' && !isPoolLadder
      ? buildStepPath(topPoints, stepOpts)
      : '';
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
  const matchD =
    hasMatchOverlay && !isPoolLadder
      ? buildMatchAreaPath(topPoints, matchMask, baselineY, stepWidth)
      : '';

  // The tallest ladder bar already marks the mode; the tick would double it.
  const cappedPoint =
    isFilledView && cappedIndex >= 0 ? topPoints[cappedIndex] : undefined;
  const showModeTick = isFilledView && !isPoolLadder && modeIndex >= 0;
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
      {areaD !== '' && (
        <path d={areaD} fill={color} fillOpacity={0.16} />
      )}
      {matchD !== '' && (
        <path d={matchD} fill={color} fillOpacity={0.55} />
      )}
      {isPoolLadder &&
        topPoints.map((p, i) => {
          const barHeight = baselineY - p.y;
          if (barHeight <= 0) return null;
          const inset = stepWidth * 0.15;
          const dimmed = hasMatchOverlay && !matchMask[i];
          return (
            <rect
              key={`bar-${i}`}
              x={p.x + inset}
              y={p.y}
              width={Math.max(stepWidth - inset * 2, 0.5)}
              height={barHeight}
              fill={color}
              fillOpacity={dimmed ? 0.16 : 0.55}
            />
          );
        })}
      {pmfStrokeD !== '' && (
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
      {cappedPoint && (
        <>
          {/* A dashed line alone reads as a solid top at 36px. Clearing a band
              under it leaves visible sky between the bar and its ceiling, which
              is what makes the cut legible at row scale. */}
          <rect
            x={cappedPoint.x}
            y={cappedPoint.y}
            width={stepWidth}
            height={Math.max(2, height * 0.09)}
            fill="var(--chakra-colors-bg-panel)"
          />
          <line
            x1={cappedPoint.x}
            x2={cappedPoint.x + stepWidth}
            y1={cappedPoint.y}
            y2={cappedPoint.y}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="1.5 1.5"
            vectorEffect="non-scaling-stroke"
          />
        </>
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
});

interface RowSparklineProps {
  dist: Distribution;
  color: string;
  exprName: string;
  view: ChartView;
  target: TargetState;
  mode?: ExpressionMode;
  height?: number;
  fill?: boolean;
}

export const RowSparkline = memo(function RowSparkline({
  dist,
  color,
  exprName,
  view,
  target,
  mode,
  height,
  fill,
}: RowSparklineProps) {
  return (
    <Sparkline
      dist={dist}
      color={color}
      view={view}
      target={target}
      {...(mode !== undefined && { mode })}
      {...(height !== undefined && { height })}
      {...(fill !== undefined && { fill })}
      ariaLabel={`Distribution shape for ${exprName}`}
    />
  );
});
