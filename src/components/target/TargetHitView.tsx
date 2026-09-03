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
  index: number;
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
  const { expressions, target, poolTarget } = useApp();
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
  const columns = useMemo(
    () => targetColumns(target, poolTarget, hasPools),
    [target, poolTarget, hasPools],
  );

  const cycleSort = useCallback((index: number) => {
    setSort((cur) => {
      if (cur === null || cur.index !== index) return { index, dir: 'desc' };
      if (cur.dir === 'desc') return { index, dir: 'asc' };
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

  // Removing a target can strand the sort on a column that no longer exists.
  const activeSort =
    sort !== null && sort.index < columns.length ? sort : null;

  const poolOnlyColumn = columns[0]?.pool === true;
  const showPoolFootnote = !poolOnlyColumn && filteredRows.some((r) => r.isPool);
  const hint =
    subView === 'grid'
      ? `Click a target column to sort. Green is reliable, red is a long shot.${
          showPoolFootnote ? ' * pool rows use the pool target.' : ''
        }`
      : subView === 'curves'
        ? 'Read any target off the lines. Dashed lines mark your current targets. Sum rolls only.'
        : poolOnlyColumn
          ? 'One panel per target. Pool rolls answer the pool target.'
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
          poolTarget={poolTarget}
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
          poolTarget={poolTarget}
        />
      )}
    </Stack>
  );
}

// A pool column never coexists with numeric ones, so the prefix is enough to
// keep the two kinds of key apart.
function columnKey(column: TargetColumn): string {
  return `${column.pool ? 'pool' : 'num'}-${column.value}`;
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
  poolTarget: number;
  sort: GridSort | null;
  onCycleSort: (index: number) => void;
  onClearSort: () => void;
}

function TargetGrid({
  rows,
  columns,
  ruling,
  poolTarget,
  sort,
  onCycleSort,
  onClearSort,
}: TargetGridProps) {
  // Array.prototype.sort is stable, so equal percents keep their table order.
  const sortedRows = useMemo(() => {
    const scored = rows.map((row) => ({
      row,
      hits: columns.map((column) =>
        rowHitChance(row, column, ruling, poolTarget),
      ),
    }));
    if (sort !== null) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      scored.sort(
        (a, b) => dir * ((a.hits[sort.index] ?? 0) - (b.hits[sort.index] ?? 0)),
      );
    }
    return scored;
  }, [rows, columns, ruling, poolTarget, sort]);

  const symbol = RULING_SYMBOL[ruling];

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
              <Table.ColumnHeader>
                <Tooltip content={tipForId('targetGridName')}>
                  <Button size="xs" variant="ghost" onClick={onClearSort}>
                    Name
                  </Button>
                </Tooltip>
              </Table.ColumnHeader>
              {columns.map((column, index) => {
                const isSorted = sort !== null && sort.index === index;
                return (
                  <Table.ColumnHeader
                    key={columnKey(column)}
                    textAlign="end"
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
                        onClick={() => onCycleSort(index)}
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
                <Table.Cell py={1.5}>
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
                  if (!rowShowsUnderTarget(row, column, index)) {
                    return <Table.Cell key={columnKey(column)} py={1.5} />;
                  }
                  const p = hits[index] ?? 0;
                  return (
                    <Table.Cell
                      key={columnKey(column)}
                      py={1.5}
                      textAlign="end"
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
                        {row.isPool && !column.pool ? '*' : ''}
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
