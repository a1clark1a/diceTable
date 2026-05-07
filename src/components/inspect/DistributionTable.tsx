import { Fragment, type CSSProperties } from 'react';
import { Box, Table, Text } from '@chakra-ui/react';
import type { Distribution } from '../../types';
import { sortedKeys } from '../../engine/distribution';
import { formatNumber, formatPercent } from '../chart/format';

export type DistOrder = 'value-asc' | 'prob-desc';

export interface DistributionTableProps {
  dist: Distribution;
  mean?: number;
  modes?: number[];
  shadeRange?: { lo: number; hi: number };
  filter?: (value: number, p: number) => boolean;
  showWeighted?: boolean;
  showCumulative?: boolean;
  order?: DistOrder;
  limit?: number;
  maxHeight?: string;
  emptyMessage?: string;
}

interface DisplayRow {
  value: number;
  p: number;
  cum: number;
  weighted: number;
  isMode: boolean;
  isShaded: boolean;
}

const NUMERIC: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export function DistributionTable({
  dist,
  mean,
  modes,
  shadeRange,
  filter,
  showWeighted = false,
  showCumulative = true,
  order = 'value-asc',
  limit,
  maxHeight = '320px',
  emptyMessage = 'No distribution available.',
}: DistributionTableProps) {
  if (dist.size === 0) {
    return (
      <Text fontSize="xs" color="fg.muted">
        {emptyMessage}
      </Text>
    );
  }

  const ascKeys = sortedKeys(dist);
  const cumByValue = new Map<number, number>();
  let running = 0;
  for (const k of ascKeys) {
    running += dist.get(k) ?? 0;
    cumByValue.set(k, running);
  }

  const modeSet = new Set(modes ?? []);
  const allRows: DisplayRow[] = ascKeys.map((k) => {
    const p = dist.get(k) ?? 0;
    return {
      value: k,
      p,
      cum: cumByValue.get(k) ?? 0,
      weighted: k * p,
      isMode: modeSet.has(k),
      isShaded: shadeRange ? k >= shadeRange.lo && k <= shadeRange.hi : false,
    };
  });

  const filtered = filter ? allRows.filter((r) => filter(r.value, r.p)) : allRows;

  let displayRows = filtered;
  if (order === 'prob-desc') {
    displayRows = [...filtered].sort((a, b) => b.p - a.p || a.value - b.value);
  }
  if (limit !== undefined && displayRows.length > limit) {
    displayRows = displayRows.slice(0, limit);
  }

  let meanAfterIndex: number | null = null;
  if (mean !== undefined && order === 'value-asc') {
    let idx = -1;
    for (let i = 0; i < displayRows.length; i++) {
      if (displayRows[i]!.value <= mean) idx = i;
      else break;
    }
    if (idx >= 0 && idx < displayRows.length - 1) meanAfterIndex = idx;
  }

  const colCount = 2 + (showCumulative ? 1 : 0) + (showWeighted ? 1 : 0);

  if (displayRows.length === 0) {
    return (
      <Text fontSize="xs" color="fg.muted">
        {emptyMessage}
      </Text>
    );
  }

  return (
    <Box
      maxH={maxHeight}
      overflowY="auto"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      bg="bg.panel"
    >
      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row bg="bg.subtle">
            <Table.ColumnHeader
              fontSize="2xs"
              textTransform="uppercase"
              color="fg.muted"
              letterSpacing="wider"
            >
              Value
            </Table.ColumnHeader>
            <Table.ColumnHeader
              fontSize="2xs"
              textTransform="uppercase"
              color="fg.muted"
              letterSpacing="wider"
              textAlign="end"
            >
              P
            </Table.ColumnHeader>
            {showCumulative && (
              <Table.ColumnHeader
                fontSize="2xs"
                textTransform="uppercase"
                color="fg.muted"
                letterSpacing="wider"
                textAlign="end"
              >
                Cum
              </Table.ColumnHeader>
            )}
            {showWeighted && (
              <Table.ColumnHeader
                fontSize="2xs"
                textTransform="uppercase"
                color="fg.muted"
                letterSpacing="wider"
                textAlign="end"
              >
                k·P
              </Table.ColumnHeader>
            )}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {displayRows.map((r, i) => (
            <Fragment key={r.value}>
              <Table.Row bg={r.isMode ? 'bg.muted' : r.isShaded ? 'bg.subtle' : undefined}>
                <Table.Cell
                  fontFamily="mono"
                  fontSize="xs"
                  fontWeight={r.isMode ? 'semibold' : undefined}
                  style={NUMERIC}
                >
                  {r.value}
                  {r.isMode && (
                    <Text
                      as="span"
                      ml={1}
                      fontSize="2xs"
                      color="fg.muted"
                      fontWeight="normal"
                    >
                      mode
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell
                  fontFamily="mono"
                  fontSize="xs"
                  fontWeight={r.isMode ? 'semibold' : undefined}
                  textAlign="end"
                  style={NUMERIC}
                >
                  {formatPercent(r.p)}
                </Table.Cell>
                {showCumulative && (
                  <Table.Cell
                    fontFamily="mono"
                    fontSize="xs"
                    textAlign="end"
                    color="fg.muted"
                    style={NUMERIC}
                  >
                    {formatPercent(r.cum)}
                  </Table.Cell>
                )}
                {showWeighted && (
                  <Table.Cell
                    fontFamily="mono"
                    fontSize="xs"
                    textAlign="end"
                    color="fg.muted"
                    style={NUMERIC}
                  >
                    {formatNumber(r.weighted, 3)}
                  </Table.Cell>
                )}
              </Table.Row>
              {meanAfterIndex === i && mean !== undefined && (
                <Table.Row aria-hidden="true">
                  <Table.Cell
                    colSpan={colCount}
                    py={1}
                    borderTopWidth="1px"
                    borderTopColor="border.emphasized"
                    borderTopStyle="dashed"
                    bg="bg.subtle"
                  >
                    <Text
                      fontSize="2xs"
                      color="fg.muted"
                      fontFamily="mono"
                      style={NUMERIC}
                    >
                      µ ≈ {formatNumber(mean, 3)}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Fragment>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
