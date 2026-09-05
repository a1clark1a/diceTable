import { useCallback, useMemo, useState } from 'react';
import { Box, Button, HStack, Stack, Table, Text } from '@chakra-ui/react';
import { useApp } from '../../state/useApp';
import { RULING_SYMBOL } from '../targetRulingMeta';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';
import { formatPercent } from '../chart/format';
import { hitColor } from '../chart/palette';
import type { TargetRuling } from '../../types';
import {
  columnKey,
  rowHitChance,
  rowShowsUnderTarget,
  targetColumns,
  toTargetRows,
  type TargetColumn,
  type TargetRow,
} from './targetHitRows';
import { TargetBars } from './TargetBars';
import { TargetCurves } from './TargetCurves';

type SubView = 'grid' | 'curves' | 'bars';
type KindFilter = 'all' | 'sum' | 'pool';

interface GridSort {
  /** columnKey, not a position: the two axes shift as targets and filters change. */
  key: string;
  dir: 'desc' | 'asc';
}

const SUB_VIEWS: { value: SubView; label: string }[] = [
  { value: 'grid', label: 'Grid' },
  { value: 'curves', label: 'Curves' },
  { value: 'bars', label: 'Bars' },
];

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sum', label: 'Sum' },
  { value: 'pool', label: 'Pools' },
];

export function TargetHitView() {
  const { expressions, target, poolTargets } = useApp();
  const [subView, setSubView] = useState<SubView>('grid');
  const [filter, setFilter] = useState<KindFilter>('all');
  const [sort, setSort] = useState<GridSort | null>(null);

  const rows = useMemo(() => toTargetRows(expressions), [expressions]);
  const hasPools = rows.some((r) => r.isPool);
  const hasSums = rows.some((r) => !r.isPool);
  const showFilter = hasPools && hasSums;
  const effectiveFilter = showFilter ? filter : 'all';

  const filteredRows = useMemo(
    () =>
      effectiveFilter === 'all'
        ? rows
        : rows.filter((r) => (effectiveFilter === 'pool') === r.isPool),
    [rows, effectiveFilter],
  );
  const sumRows = useMemo(() => rows.filter((r) => !r.isPool), [rows]);
  // Built from the filtered rows so hiding one kind takes its axis with it
  // instead of leaving a run of columns nothing on screen can answer.
  const columns = useMemo(
    () =>
      targetColumns(
        target,
        poolTargets,
        filteredRows.some((r) => r.isPool),
        filteredRows.some((r) => !r.isPool),
      ),
    [target, poolTargets, filteredRows],
  );

  const cycleSort = useCallback((key: string) => {
    setSort((cur) => {
      if (cur === null || cur.key !== key) return { key, dir: 'desc' };
      if (cur.dir === 'desc') return { key, dir: 'asc' };
      return null;
    });
  }, []);
  const clearSort = useCallback(() => setSort(null), []);

  // Order matters: a table with nothing chartable needs to hear about its
  // rolls, not its targets. Asking for a target first would tell a table whose
  // only pool row has unusable dice to add a numeric target that pool rows
  // ignore, while the toolbar next to it offers the pool target.
  if (rows.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted" px={1}>
        Add a roll with valid dice to see hit chances against your targets.
      </Text>
    );
  }

  if (columns.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted" px={1}>
        Add a target above to see how likely each roll is to hit it.
      </Text>
    );
  }

  // Removing a target, or filtering its axis away, can strand the sort on a
  // column that is gone. Matching by key drops it instead of re-pointing it at
  // whatever column slid into that position.
  const activeSort =
    sort !== null && columns.some((c) => columnKey(c) === sort.key)
      ? sort
      : null;

  const hint =
    subView === 'grid'
      ? 'Click a target column to sort. Green is reliable, red is a long shot.'
      : subView === 'curves'
        ? 'Read any target off the lines. Dashed lines mark your current targets. Sum rolls only.'
        : 'One panel per target, best for a handful of rolls.';

  return (
    <Stack gap={3}>
      <HStack gap={3} align="center" flexWrap="wrap">
        <HStack
          gap={1}
          p={1}
          bg="bg.subtle"
          borderRadius="md"
          display="inline-flex"
          role="group"
          aria-label="Target sub-view"
        >
          {SUB_VIEWS.map((v) => {
            const isActive = subView === v.value;
            return (
              <Button
                key={v.value}
                size="sm"
                variant={isActive ? 'solid' : 'ghost'}
                colorPalette={isActive ? 'blue' : 'gray'}
                onClick={() => setSubView(v.value)}
                aria-pressed={isActive}
                minH="40px"
              >
                {v.label}
              </Button>
            );
          })}
        </HStack>
        {showFilter && (
          <HStack
            gap={1}
            p={1}
            bg="bg.subtle"
            borderRadius="md"
            display="inline-flex"
            role="group"
            aria-label="Filter by roll kind"
          >
            {KIND_FILTERS.map((f) => {
              const isActive = effectiveFilter === f.value;
              return (
                <Button
                  key={f.value}
                  size="sm"
                  variant={isActive ? 'solid' : 'ghost'}
                  colorPalette={isActive ? 'purple' : 'gray'}
                  onClick={() => setFilter(f.value)}
                  aria-pressed={isActive}
                  minH="40px"
                >
                  {f.label}
                </Button>
              );
            })}
          </HStack>
        )}
        <Text fontSize="xs" color="fg.muted">
          {hint}
        </Text>
      </HStack>
      {subView === 'grid' && (
        <TargetGrid
          rows={filteredRows}
          columns={columns}
          ruling={target.ruling}
          sort={activeSort}
          onCycleSort={cycleSort}
          onClearSort={clearSort}
        />
      )}
      {subView === 'curves' && <TargetCurves rows={sumRows} target={target} />}
      {subView === 'bars' && (
        <TargetBars
          rows={filteredRows}
          columns={columns}
          ruling={target.ruling}
        />
      )}
    </Stack>
  );
}

function bucketBg(p: number): string {
  if (p >= 0.66) return 'green.subtle';
  if (p >= 0.33) return 'orange.subtle';
  return 'red.subtle';
}

interface TargetGridProps {
  rows: TargetRow[];
  columns: TargetColumn[];
  ruling: TargetRuling;
  sort: GridSort | null;
  onCycleSort: (key: string) => void;
  onClearSort: () => void;
}

function TargetGrid({
  rows,
  columns,
  ruling,
  sort,
  onCycleSort,
  onClearSort,
}: TargetGridProps) {
  // Array.prototype.sort is stable, so equal percents keep their table order.
  const sortedRows = useMemo(() => {
    const scored = rows.map((row) => ({
      row,
      // null where the row is on the other scale from the column: nothing to
      // measure, nothing to print, and nothing to rank by.
      hits: columns.map((column) =>
        rowShowsUnderTarget(row, column)
          ? rowHitChance(row, column, ruling)
          : null,
      ),
    }));
    const index =
      sort === null ? -1 : columns.findIndex((c) => columnKey(c) === sort.key);
    if (index >= 0 && sort !== null) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      // Blank rows sink together rather than interleaving on a rank they have
      // no value for.
      scored.sort((a, b) => {
        const av = a.hits[index] ?? null;
        const bv = b.hits[index] ?? null;
        if (av === null) return bv === null ? 0 : 1;
        if (bv === null) return -1;
        return dir * (av - bv);
      });
    }
    return scored;
  }, [rows, columns, ruling, sort]);

  const symbol = RULING_SYMBOL[ruling];
  // Ten columns overflow a phone, so the name has to stay put or a scrolled
  // row loses its identity. Sticky cells need their own opaque background,
  // otherwise the scrolled columns show through.
  const stickyName = {
    position: 'sticky',
    left: '0',
    zIndex: 1,
    borderRightWidth: '1px',
    borderRightColor: 'border.subtle',
  } as const;
  // The two axes measure different things, so the first pool column opens with
  // the same purple edge that marks pool rows and pool bar panels. Only when
  // numeric columns precede it: a pool-only grid has nothing to divide from.
  const dividerIndex = columns.findIndex((c) => c.pool);
  const axisDivider = (index: number) =>
    index > 0 && index === dividerIndex
      ? { borderLeftWidth: '2px', borderLeftColor: 'purple.solid' }
      : {};

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      overflow="hidden"
    >
      <Table.ScrollArea>
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row bg="bg.subtle">
              <Table.ColumnHeader {...stickyName} bg="bg.subtle">
                <Tooltip content={tipForId('targetGridName')}>
                  <Button size="xs" variant="ghost" onClick={onClearSort}>
                    Name
                  </Button>
                </Tooltip>
              </Table.ColumnHeader>
              {columns.map((column, index) => {
                const isSorted =
                  sort !== null && sort.key === columnKey(column);
                return (
                  <Table.ColumnHeader
                    key={columnKey(column)}
                    textAlign="end"
                    {...axisDivider(index)}
                    aria-sort={
                      isSorted
                        ? sort.dir === 'desc'
                          ? 'descending'
                          : 'ascending'
                        : undefined
                    }
                  >
                    <Tooltip
                      content={tipForId(
                        column.pool ? 'poolTarget' : 'targetGridSort',
                      )}
                    >
                      <Button
                        size="xs"
                        variant="ghost"
                        fontFamily="mono"
                        color={column.pool ? 'purple.fg' : undefined}
                        onClick={() => onCycleSort(columnKey(column))}
                      >
                        {column.pool
                          ? `≥${column.value} successes`
                          : `${symbol} ${column.value}`}
                        {isSorted ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : ''}
                      </Button>
                    </Tooltip>
                  </Table.ColumnHeader>
                );
              })}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {sortedRows.map(({ row, hits }) => (
              <Table.Row key={row.id}>
                <Table.Cell py={1.5} {...stickyName} bg="bg.panel">
                  <HStack gap={2}>
                    <Box
                      w="8px"
                      h="8px"
                      borderRadius="2px"
                      bg={row.color}
                      flexShrink={0}
                    />
                    <Text fontSize="sm">{row.name}</Text>
                  </HStack>
                </Table.Cell>
                {columns.map((column, index) => {
                  const p = hits[index] ?? null;
                  if (p === null) {
                    return (
                      <Table.Cell
                        key={columnKey(column)}
                        py={1.5}
                        {...axisDivider(index)}
                      />
                    );
                  }
                  return (
                    <Table.Cell
                      key={columnKey(column)}
                      py={1.5}
                      textAlign="end"
                      {...axisDivider(index)}
                      bg={bucketBg(p)}
                      fontFamily="mono"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      <Text
                        as="span"
                        fontSize="sm"
                        color={hitColor(p)}
                        fontWeight={p >= 0.66 ? 'semibold' : undefined}
                      >
                        {formatPercent(p)}
                      </Text>
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>
    </Box>
  );
}
