import { useMemo, useState } from 'react';
import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { HelpTerm } from '../ui/help-term';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';
import { tapTarget } from '../tapTarget';
import { RangePager } from '../chart/RangePager';
import { pageCount } from '../chart/rowCap';
import type { TargetState } from '../../types';
import { hitSeries } from '../../engine/stats';
import type { TargetRow } from './targetHitRows';

const W = 640;
const H = 210;
const LEGEND_CAP = 12;
/** One page of curves, matching the comparison chart's page. */
export const CURVE_PAGE = 20;

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

/**
 * `rows` sets the axis, `drawn` sets the lines.
 *
 * They differ while a page is showing, and keeping the axis on the whole table
 * is the point: an axis rebuilt per page would slide under the curves, and two
 * pages read one after the other would be measuring against different rulers.
 */
function buildGeometry(
  rows: TargetRow[],
  drawn: TargetRow[],
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
  const paths = drawn.map((row) => {
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
  // Off by default: this view draws the whole table at once, and paging is an
  // answer to a crowded canvas rather than something to impose on every one.
  // Transient like the comparison chart's page, so a reload starts whole and a
  // share image pictures the table rather than a slice the picture cannot page.
  const [paged, setPaged] = useState(false);
  const [page, setPage] = useState(0);

  const total = rows.length;
  const offered = total > CURVE_PAGE;
  const isPaged = paged && offered;
  const pages = pageCount(total, CURVE_PAGE);
  // Deleting rows can strand the page past the end; the last page is a better
  // answer there than an empty canvas.
  const safePage = Math.min(Math.max(page, 0), pages - 1);
  const from = safePage * CURVE_PAGE;

  const drawn = useMemo(
    () => (isPaged ? rows.slice(from, from + CURVE_PAGE) : rows),
    [isPaged, rows, from],
  );
  const geometry = useMemo(
    () => buildGeometry(rows, drawn, target),
    [rows, drawn, target],
  );

  if (geometry === null) {
    return (
      <Text fontSize="sm" color="fg.muted" px={1}>
        Curves compare rolls that add into a total. Switch a roll to Sum to see
        it here.
      </Text>
    );
  }

  // A page is short enough to name every line it draws, so the trim is for
  // the whole table only. Naming them is most of why a page is worth asking
  // for, and a page that cut its own legend would undo that.
  const legendCap = isPaged ? CURVE_PAGE : LEGEND_CAP;
  const legend =
    drawn.length > legendCap
      ? [
          ...drawn.slice(0, legendCap).map((r) => ({
            key: r.id,
            name: r.name,
            color: r.color,
          })),
          {
            key: 'overflow',
            name: `+${drawn.length - legendCap} more`,
            color: 'bg.muted',
          },
        ]
      : drawn.map((r) => ({ key: r.id, name: r.name, color: r.color }));

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      p={4}
    >
      <HStack justify="space-between" align="center" gap={2} flexWrap="wrap">
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
        {offered && (
          <Tooltip content={tipForId('chartPageTwenty')}>
            <Button
              size="xs"
              variant={isPaged ? 'solid' : 'ghost'}
              colorPalette={isPaged ? 'blue' : 'gray'}
              aria-pressed={isPaged}
              h={tapTarget('24px')}
              onClick={() => {
                setPaged(!isPaged);
                setPage(0);
              }}
            >
              {CURVE_PAGE} at a time
            </Button>
          </Tooltip>
        )}
      </HStack>
      {isPaged && (
        <Box mt={1}>
          <RangePager
            from={from}
            shown={drawn.length}
            total={total}
            page={safePage}
            pages={pages}
            what="target curves"
            onPage={setPage}
            tip={tipForId('chartRowCap')}
          />
        </Box>
      )}
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
