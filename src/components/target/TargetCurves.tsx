import { useMemo } from 'react';
import { Box, HStack, Text } from '@chakra-ui/react';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import type { TargetState } from '../../types';
import { hitSeries, type TargetRow } from './targetHitRows';

const W = 640;
const H = 210;
const LEGEND_CAP = 12;

interface TargetCurvesProps {
  /** Sum rows only; curves always plot totals, whatever the kind filter says. */
  rows: TargetRow[];
  target: TargetState;
}

interface CurveGeometry {
  paths: { id: string; d: string; color: string }[];
  markers: { value: number; left: string }[];
  xMin: number;
  xMax: number;
}

function buildGeometry(
  rows: TargetRow[],
  target: TargetState,
): CurveGeometry | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of rows) {
    if (row.min < lo) lo = row.min;
    if (row.max > hi) hi = row.max;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  for (const tv of target.values) {
    if (tv < lo) lo = tv;
    if (tv > hi) hi = tv;
  }
  const span = Math.max(1, hi - lo);
  const x = (v: number) => ((v - lo) / span) * (W - 56) + 48;
  const y = (p: number) => H - 8 - p * (H - 16);
  // Outside a row's own range the curve is constant, so a far-away target
  // widens the axis with two extra points instead of thousands of samples.
  const leftVal =
    target.ruling === 'gte' || target.ruling === 'gt' ? 1 : 0;
  const rightVal =
    target.ruling === 'lte' || target.ruling === 'lt' ? 1 : 0;
  const paths = rows.map((row) => {
    const pts: string[] = [];
    const push = (v: number, p: number) =>
      pts.push(`${x(v).toFixed(1)},${y(p).toFixed(1)}`);
    if (lo < row.min) {
      push(lo, leftVal);
      if (row.min - 1 > lo) push(row.min - 1, leftVal);
    }
    const series = hitSeries(row.dist, row.min, row.max, target.ruling);
    series.forEach((p, i) => push(row.min + i, p));
    if (hi > row.max) {
      if (row.max + 1 < hi) push(row.max + 1, rightVal);
      push(hi, rightVal);
    }
    return { id: row.id, d: `M${pts.join(' L')}`, color: row.color };
  });
  const markers = target.values.map((tv) => ({
    value: tv,
    left: `${((x(tv) / W) * 100).toFixed(2)}%`,
  }));
  return { paths, markers, xMin: lo, xMax: hi };
}

export function TargetCurves({ rows, target }: TargetCurvesProps) {
  const geometry = useMemo(() => buildGeometry(rows, target), [rows, target]);

  if (geometry === null) {
    return (
      <Text fontSize="sm" color="fg.muted" px={1}>
        Curves compare rolls that add into a total. Switch a roll to Sum to see
        it here.
      </Text>
    );
  }

  const legend =
    rows.length > LEGEND_CAP
      ? [
          ...rows.slice(0, LEGEND_CAP).map((r) => ({
            key: r.id,
            name: r.name,
            color: r.color,
          })),
          {
            key: 'overflow',
            name: `+${rows.length - LEGEND_CAP} more`,
            color: 'bg.muted',
          },
        ]
      : rows.map((r) => ({ key: r.id, name: r.name, color: r.color }));

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      p={4}
    >
      <HelpTerm tip={tipForId('targetCurves')}>
        <Text
          as="span"
          fontSize="2xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
        >
          Hit chance by target
        </Text>
      </HelpTerm>
      {/* pt reserves room above the plot for the marker chips. The inner box
          matches the svg exactly so percent-positioned overlays line up, and
          the axis labels live in HTML so they keep a fixed, readable size
          instead of scaling with the viewBox. */}
      <Box position="relative" mt={2} pt="22px" color="fg.muted">
        <Box position="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ display: 'block' }}
            role="img"
            aria-label="Hit chance for every candidate target, one line per roll"
          >
            <line
              x1={8}
              y1={8}
              x2={W - 8}
              y2={8}
              stroke="currentColor"
              strokeOpacity={0.15}
            />
            <line
              x1={8}
              y1={H / 2}
              x2={W - 8}
              y2={H / 2}
              stroke="currentColor"
              strokeOpacity={0.15}
            />
            <line
              x1={8}
              y1={H - 8}
              x2={W - 8}
              y2={H - 8}
              stroke="currentColor"
              strokeOpacity={0.15}
            />
            {geometry.paths.map((p) => (
              <path
                key={p.id}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={1.8}
                strokeLinejoin="round"
              />
            ))}
          </svg>
          {[
            { label: '100%', top: `${((8 / H) * 100).toFixed(1)}%` },
            { label: '50%', top: '50%' },
            { label: '0%', top: `${(((H - 8) / H) * 100).toFixed(1)}%` },
          ].map((gl) => (
            <Text
              key={gl.label}
              position="absolute"
              top={gl.top}
              left="4px"
              transform="translateY(-100%)"
              fontSize="2xs"
              fontFamily="mono"
              color="fg.muted"
              lineHeight={1.2}
            >
              {gl.label}
            </Text>
          ))}
          {geometry.markers.map((m) => (
            <Box
              key={m.value}
              position="absolute"
              top="0"
              bottom="0"
              w="0"
              left={m.left}
              borderLeftWidth="1px"
              borderLeftStyle="dashed"
              borderLeftColor="border.emphasized"
            >
              <Text
                position="absolute"
                top="-20px"
                left="0"
                transform="translateX(-50%)"
                fontSize="xs"
                fontWeight="semibold"
                fontFamily="mono"
                color="fg"
                bg="bg.subtle"
                borderWidth="1px"
                borderColor="border.subtle"
                px={1.5}
                borderRadius="sm"
                lineHeight={1.3}
              >
                {m.value}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
      <HStack justify="space-between" mt={1}>
        <Text fontSize="xs" color="fg.muted" fontFamily="mono">
          {geometry.xMin}
        </Text>
        <Text fontSize="xs" color="fg.muted" fontFamily="mono">
          {geometry.xMax}
        </Text>
      </HStack>
      <HStack flexWrap="wrap" gap={3} mt={2}>
        {legend.map((item) => (
          <HStack key={item.key} gap={1}>
            <Box w="8px" h="8px" borderRadius="2px" bg={item.color} />
            <Text fontSize="xs" color="fg.muted">
              {item.name}
            </Text>
          </HStack>
        ))}
      </HStack>
    </Box>
  );
}
