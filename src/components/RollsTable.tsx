import { memo, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  HStack,
  IconButton,
  Input,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useApp, type ExpressionPatch } from '../state/useApp';
import { useBufferedValue } from '../hooks/useBufferedValue';
import { getRowData } from '../state/useDistributions';
import { hitProbability } from '../engine/stats';
import {
  MAX_EXPRESSIONS,
  type ChartView,
  type Expression,
  type ExpressionMode,
  type SuccessThreshold,
  type TargetState,
} from '../types';
import { Tooltip } from './ui/tooltip';
import { ExpressionDiceText } from './editor/ExpressionRender';
import {
  PoolBadge,
  PoolModeToggle,
  PoolThresholdEditor,
} from './editor/PoolControls';
import { RollExpand } from './RollExpand';
import { RollPopover, RollResultInline } from './RollResult';
import { hitColor, rowColor } from './chart/palette';
import { RowSparkline, ShapeHeaderLabel } from './chart/Sparkline';
import { effectiveChartView } from './chart/effectiveView';
import { EM_DASH, formatNumber, formatPercent } from './chart/format';
import { HelpTerm } from './ui/help-term';
import { tipForId } from '../docs/glossary';
import { RulingSymbol } from './targetRuling';
import { InspectChart } from './inspect/InspectChart';
import { InspectDistribution } from './inspect/InspectDistribution';
import { InspectMean, InspectSigma } from './inspect/InspectStat';

function parseMod(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '+' || trimmed === '-') return 0;
  const n = Number.parseInt(trimmed.replace(/^\+/, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseName(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : 'Untitled';
}

function formatString(s: string): string {
  return s;
}

function formatNumberValue(n: number): string {
  return String(n);
}

export function RollsTable() {
  const {
    expressions,
    expandedId,
    chartView,
    target,
    poolTarget,
    setExpandedId,
    deleteExpression,
    renameExpression,
    updateExpression,
    addExpression,
  } = useApp();

  const showHit = target.values.length > 0;
  const view = effectiveChartView(chartView, target);
  const atCap = expressions.length >= MAX_EXPRESSIONS;

  return (
    <Stack gap={3}>
      {expressions.length === 0 ? (
        <EmptyState onAdd={addExpression} />
      ) : (
        <Box
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="md"
          overflow="hidden"
        >
          {/* Tables cannot shrink below min-content; without a scroll fallback
              the overflow:hidden panel would clip the rightmost columns
              unreachably at narrow desktop widths. */}
          <Table.ScrollArea>
            <Table.Root size="sm" variant="line" striped={false}>
            <Table.Header>
              <Table.Row bg="bg.subtle">
                <Table.ColumnHeader
                  borderLeftWidth="3px"
                  borderLeftColor="transparent"
                >
                  Name
                </Table.ColumnHeader>
                <Table.ColumnHeader>Dice</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">
                  <HelpTerm tip={tipForId('mod')}>Mod</HelpTerm>
                </Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">
                  <HelpTerm tip={tipForId('meanSigma')}>Mean ± σ</HelpTerm>
                </Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">
                  <HelpTerm tip={tipForId('range')}>Range</HelpTerm>
                </Table.ColumnHeader>
                <Table.ColumnHeader textAlign="center" w="100px">
                  <ShapeHeaderLabel />
                </Table.ColumnHeader>
                {showHit && (
                  <Table.ColumnHeader textAlign="end">
                    <HStack as="span" gap={1} justify="end">
                      <HelpTerm tip={tipForId('hit')}>Hit %</HelpTerm>
                      <RulingSymbol ruling={target.ruling} color="fg.muted" />
                    </HStack>
                  </Table.ColumnHeader>
                )}
                <Table.ColumnHeader textAlign="end" w="140px">
                  {' '}
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {expressions.map((expr, idx) => (
                <RollTableRow
                  key={expr.id}
                  expr={expr}
                  idx={idx}
                  expanded={expandedId === expr.id}
                  showHit={showHit}
                  view={view}
                  target={target}
                  poolTarget={poolTarget}
                  setExpandedId={setExpandedId}
                  deleteExpression={deleteExpression}
                  renameExpression={renameExpression}
                  updateExpression={updateExpression}
                />
              ))}
              <Table.Row>
                <Table.Cell
                  colSpan={showHit ? 8 : 7}
                  py={3}
                  borderLeftWidth="3px"
                  borderLeftColor="transparent"
                >
                  <Tooltip
                    content={`Up to ${MAX_EXPRESSIONS} rolls. Delete a row to add another.`}
                    disabled={!atCap}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      borderStyle="dashed"
                      width="100%"
                      onClick={addExpression}
                      disabled={atCap}
                    >
                      <Plus size={14} />
                      Add roll
                    </Button>
                  </Tooltip>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Box>
      )}
    </Stack>
  );
}

interface EmptyStateProps {
  onAdd: () => void;
}

function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border.subtle"
      borderRadius="md"
      p={{ base: 6, md: 10 }}
      textAlign="center"
    >
      <Stack gap={3} align="center">
        <Text fontSize="md" fontWeight="medium">
          No rolls yet.
        </Text>
        <Text fontSize="sm" color="fg.muted" maxW="320px">
          Add a roll to start comparing distributions. Try a weapon attack, a
          save DC check, or an ability score generator.
        </Text>
        <Button colorPalette="blue" onClick={onAdd}>
          <Plus size={16} />
          Add roll
        </Button>
      </Stack>
    </Box>
  );
}

interface RollTableRowProps {
  expr: Expression;
  idx: number;
  expanded: boolean;
  showHit: boolean;
  view: ChartView;
  target: TargetState;
  poolTarget: number;
  setExpandedId: (id: string | null) => void;
  deleteExpression: (id: string) => void;
  renameExpression: (id: string, name: string) => void;
  updateExpression: (id: string, patch: ExpressionPatch) => void;
}

const RollTableRow = memo(function RollTableRow({
  expr,
  idx,
  expanded,
  showHit,
  view,
  target,
  poolTarget,
  setExpandedId,
  deleteExpression,
  renameExpression,
  updateExpression,
}: RollTableRowProps) {
  const { stats, tooComplex } = getRowData(expr);
  const color = rowColor(idx);
  const isPool = expr.mode === 'pool';
  const hits = useMemo(
    () =>
      !isPool && showHit && stats.hasDist
        ? target.values.map((v) => hitProbability(stats.dist, v, target.ruling))
        : null,
    [isPool, showHit, stats, target],
  );
  const poolHit =
    isPool && showHit && stats.hasDist
      ? hitProbability(stats.dist, poolTarget, 'gte')
      : null;
  // In target view a pool row's shape highlights against the shared pool
  // target; the numeric target list describes sums, not success counts.
  const sparkTarget = useMemo<TargetState>(
    () => (isPool ? { values: [poolTarget], ruling: 'gte' } : target),
    [isPool, poolTarget, target],
  );
  const onToggleExpand = useCallback(
    () => setExpandedId(expanded ? null : expr.id),
    [setExpandedId, expanded, expr.id],
  );
  const onDelete = useCallback(
    () => deleteExpression(expr.id),
    [deleteExpression, expr.id],
  );
  const onRename = useCallback(
    (name: string) => renameExpression(expr.id, name),
    [renameExpression, expr.id],
  );
  const onModChange = useCallback(
    (value: number) => updateExpression(expr.id, { flatModifier: value }),
    [updateExpression, expr.id],
  );
  const onModeChange = useCallback(
    (mode: ExpressionMode) => updateExpression(expr.id, { mode }),
    [updateExpression, expr.id],
  );
  const onThresholdChange = useCallback(
    (successThreshold: SuccessThreshold) =>
      updateExpression(expr.id, { successThreshold }),
    [updateExpression, expr.id],
  );
  const nameBuf = useBufferedValue<string>({
    committed: expr.name,
    commit: onRename,
    parse: parseName,
    format: formatString,
  });
  const modBuf = useBufferedValue<number>({
    committed: expr.flatModifier,
    commit: onModChange,
    parse: parseMod,
    format: formatNumberValue,
  });
  return (
    <>
      <Table.Row _hover={{ bg: 'bg.subtle' }}>
        {/* Transparent border on sum rows keeps every row's left edge aligned;
            pool rows tint it as their identity band. */}
        <Table.Cell
          borderLeftWidth="3px"
          borderLeftColor={isPool ? 'purple.solid' : 'transparent'}
        >
          <HStack gap={2} minW="200px">
            <Box
              w="10px"
              h="10px"
              borderRadius="2px"
              bg={color}
              flexShrink={0}
            />
            <Input
              size="sm"
              variant="subtle"
              value={nameBuf.value}
              onChange={(e) => nameBuf.setValue(e.target.value)}
              onBlur={nameBuf.onBlur}
              onKeyDown={nameBuf.onKeyDown}
              maxW="220px"
              aria-label="Roll name"
            />
            {isPool && <PoolBadge />}
          </HStack>
        </Table.Cell>
        <Table.Cell>
          <Stack gap={1} align="flex-start">
            <Box fontFamily="mono" fontSize="xs" color="fg">
              <InspectDistribution
                exprName={expr.name}
                dist={stats.dist}
                mean={stats.mean}
                modes={stats.mode}
                hasDist={stats.hasDist && !tooComplex}
              >
                <ExpressionDiceText expr={expr} showRollMode />
              </InspectDistribution>
              {tooComplex && (
                <Text as="span" ml={2} color="fg.muted">
                  (too complex)
                </Text>
              )}
            </Box>
            <HStack gap={1} flexWrap="wrap">
              <PoolModeToggle mode={expr.mode} onSelect={onModeChange} />
              {isPool && expr.successThreshold && (
                <PoolThresholdEditor
                  threshold={expr.successThreshold}
                  onChange={onThresholdChange}
                />
              )}
            </HStack>
          </Stack>
        </Table.Cell>
        <Table.Cell textAlign="end">
          <Tooltip content={tipForId('poolAutoSuccess')} disabled={!isPool}>
            <Input
              size="sm"
              type="text"
              inputMode="numeric"
              value={modBuf.value}
              onChange={(e) => modBuf.setValue(e.target.value)}
              onBlur={modBuf.onBlur}
              onKeyDown={modBuf.onKeyDown}
              maxW="64px"
              textAlign="end"
              fontFamily="mono"
              aria-label="Modifier"
              ml="auto"
            />
          </Tooltip>
        </Table.Cell>
        <Table.Cell
          textAlign="end"
          fontFamily="mono"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {stats.hasDist ? (
            <>
              <InspectMean
                exprName={expr.name}
                hasDist={stats.hasDist && !tooComplex}
                dist={stats.dist}
                mean={stats.mean}
              >
                {formatNumber(stats.mean, 2)}
              </InspectMean>
              <Text as="span" color="fg.muted" mx={1}>
                ±
              </Text>
              <InspectSigma
                exprName={expr.name}
                hasDist={stats.hasDist && !tooComplex}
                dist={stats.dist}
                mean={stats.mean}
                stddev={stats.stddev}
              >
                {formatNumber(stats.stddev, 2)}
              </InspectSigma>
            </>
          ) : (
            EM_DASH
          )}
        </Table.Cell>
        <Table.Cell
          textAlign="end"
          fontFamily="mono"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {stats.hasDist ? `${stats.min}–${stats.max}` : EM_DASH}
        </Table.Cell>
        <Table.Cell textAlign="center" verticalAlign="middle">
          {stats.hasDist && !tooComplex ? (
            <InspectChart
              exprName={expr.name}
              dist={stats.dist}
              color={color}
            >
              <RowSparkline
                dist={stats.dist}
                color={color}
                exprName={expr.name}
                view={view}
                target={sparkTarget}
                mode={expr.mode}
              />
            </InspectChart>
          ) : (
            <Text as="span" color="fg.muted">
              {EM_DASH}
            </Text>
          )}
        </Table.Cell>
        {showHit && (
          <Table.Cell
            textAlign="end"
            fontFamily="mono"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {isPool ? (
              poolHit === null ? (
                EM_DASH
              ) : (
                <HStack gap={2} justify="flex-end">
                  {/* Pool rows answer to the shared pool target, not the
                      column's toolbar targets; the labeled ≥n makes that
                      visible (and audible) per cell. */}
                  <HelpTerm
                    tip={tipForId('poolTarget')}
                    ariaLabel={`At least ${poolTarget} successes`}
                  >
                    <Text as="span" color="purple.fg" fontSize="xs">
                      ≥{poolTarget}
                    </Text>
                  </HelpTerm>
                  <Text
                    as="span"
                    color={hitColor(poolHit)}
                    fontWeight={poolHit >= 0.66 ? 'semibold' : undefined}
                  >
                    {formatPercent(poolHit)}
                  </Text>
                </HStack>
              )
            ) : hits === null ? (
              EM_DASH
            ) : (
              <Stack gap={0.5} align="flex-end">
                {hits.map((p, i) => (
                  <HStack key={target.values[i]} gap={2} justify="flex-end">
                    {target.values.length > 1 && (
                      <Text as="span" color="fg.muted" fontSize="xs">
                        {target.values[i]}
                      </Text>
                    )}
                    <Text
                      as="span"
                      color={hitColor(p)}
                      fontWeight={p >= 0.66 ? 'semibold' : undefined}
                    >
                      {formatPercent(p)}
                    </Text>
                  </HStack>
                ))}
              </Stack>
            )}
          </Table.Cell>
        )}
        <Table.Cell textAlign="end">
          <HStack gap={1} justify="flex-end" align="center">
            {!isPool && (
              <>
                <RollResultInline exprId={expr.id} />
                <RollPopover
                  exprId={expr.id}
                  exprName={expr.name}
                  dist={stats.dist}
                  disabled={!stats.hasDist || tooComplex}
                />
              </>
            )}
            <IconButton
              aria-label={expanded ? 'Collapse row' : 'Expand row'}
              size="xs"
              variant="ghost"
              onClick={onToggleExpand}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              <Box
                transform={expanded ? 'rotate(180deg)' : undefined}
                transition="transform 0.15s"
                lineHeight={0}
              >
                <ChevronDown size={14} />
              </Box>
            </IconButton>
            <IconButton
              aria-label="Delete row"
              size="xs"
              variant="ghost"
              colorPalette="red"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 size={14} />
            </IconButton>
          </HStack>
        </Table.Cell>
      </Table.Row>
      {expanded && (
        <Table.Row>
          <Table.Cell
            colSpan={showHit ? 8 : 7}
            p={0}
            bg="bg.subtle"
            borderLeftWidth="3px"
            borderLeftColor={isPool ? 'purple.solid' : 'transparent'}
          >
            <RollExpand expression={expr} />
          </Table.Cell>
        </Table.Row>
      )}
    </>
  );
});
