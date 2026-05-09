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
import { useDistributions } from '../state/useDistributions';
import {
  hitProbability,
  max as distMax,
  mean as distMean,
  min as distMin,
  mode as distMode,
  stddev as distStddev,
} from '../engine/stats';
import type { Distribution, Expression } from '../types';
import { ExpressionDiceText } from './editor/ExpressionRender';
import { TargetToolbar } from './TargetToolbar';
import { RollExpand } from './RollExpand';
import { RollPopover, RollResultInline } from './RollResult';
import { hitColor, rowColor } from './chart/palette';
import { RowSparkline, ShapeHeaderLabel } from './chart/Sparkline';
import { EM_DASH, formatNumber, formatPercent } from './chart/format';
import { HelpTerm } from './ui/help-term';
import { tipForId } from '../docs/glossary';
import { RulingSymbol } from './targetRuling';
import { InspectChart } from './inspect/InspectChart';
import { InspectDistribution } from './inspect/InspectDistribution';
import { InspectMean, InspectSigma } from './inspect/InspectStat';

interface RowStats {
  dist: Distribution;
  hasDist: boolean;
  mean: number;
  min: number;
  max: number;
  mode: number[];
  stddev: number;
}

function computeRowStats(dist: Distribution): RowStats {
  const hasDist = dist.size > 0;
  return {
    dist,
    hasDist,
    mean: hasDist ? distMean(dist) : 0,
    min: hasDist ? distMin(dist) : 0,
    max: hasDist ? distMax(dist) : 0,
    mode: hasDist ? distMode(dist) : [],
    stddev: hasDist ? distStddev(dist) : 0,
  };
}

const EMPTY_DIST: Distribution = new Map();

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
    target,
    setExpandedId,
    deleteExpression,
    renameExpression,
    updateExpression,
    addExpression,
  } = useApp();

  const { dists, tooComplex } = useDistributions();

  const rows = useMemo(
    () =>
      expressions.map((expr, idx) => ({
        expr,
        color: rowColor(idx),
        stats: computeRowStats(dists.get(expr.id) ?? EMPTY_DIST),
        tooComplex: tooComplex.has(expr.id),
      })),
    [expressions, dists, tooComplex],
  );

  const showHit = target.values.length > 0;

  return (
    <Stack gap={3}>
      <TargetToolbar />

      {rows.length === 0 ? (
        <EmptyState onAdd={addExpression} />
      ) : (
        <Box
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="md"
          overflow="hidden"
        >
          <Table.Root size="sm" variant="line" striped={false}>
            <Table.Header>
              <Table.Row bg="bg.subtle">
                <Table.ColumnHeader>Name</Table.ColumnHeader>
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
              {rows.map(({ expr, color, stats, tooComplex: rowTooComplex }) => {
                const expanded = expandedId === expr.id;
                const hits = showHit && stats.hasDist
                  ? target.values.map((v) =>
                      hitProbability(stats.dist, v, target.ruling),
                    )
                  : null;
                return (
                  <RollTableRow
                    key={expr.id}
                    expr={expr}
                    color={color}
                    stats={stats}
                    hits={hits}
                    targetValues={target.values}
                    expanded={expanded}
                    showHit={showHit}
                    tooComplex={rowTooComplex}
                    setExpandedId={setExpandedId}
                    deleteExpression={deleteExpression}
                    renameExpression={renameExpression}
                    updateExpression={updateExpression}
                  />
                );
              })}
              <Table.Row>
                <Table.Cell colSpan={showHit ? 8 : 7} py={3}>
                  <Button
                    size="sm"
                    variant="outline"
                    borderStyle="dashed"
                    width="100%"
                    onClick={addExpression}
                  >
                    <Plus size={14} />
                    Add roll
                  </Button>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
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
  color: string;
  stats: RowStats;
  hits: number[] | null;
  targetValues: number[];
  expanded: boolean;
  showHit: boolean;
  tooComplex: boolean;
  setExpandedId: (id: string | null) => void;
  deleteExpression: (id: string) => void;
  renameExpression: (id: string, name: string) => void;
  updateExpression: (id: string, patch: ExpressionPatch) => void;
}

const RollTableRow = memo(function RollTableRow({
  expr,
  color,
  stats,
  hits,
  targetValues,
  expanded,
  showHit,
  tooComplex,
  setExpandedId,
  deleteExpression,
  renameExpression,
  updateExpression,
}: RollTableRowProps) {
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
        <Table.Cell>
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
          </HStack>
        </Table.Cell>
        <Table.Cell fontFamily="mono" fontSize="xs" color="fg">
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
        </Table.Cell>
        <Table.Cell textAlign="end">
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
            {hits === null ? (
              EM_DASH
            ) : (
              <Stack gap={0.5} align="flex-end">
                {hits.map((p, i) => (
                  <HStack key={targetValues[i]} gap={2} justify="flex-end">
                    {targetValues.length > 1 && (
                      <Text as="span" color="fg.muted" fontSize="xs">
                        {targetValues[i]}
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
            <RollResultInline exprId={expr.id} />
            <RollPopover
              exprId={expr.id}
              exprName={expr.name}
              dist={stats.dist}
              disabled={!stats.hasDist || tooComplex}
            />
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
          <Table.Cell colSpan={showHit ? 8 : 7} p={0} bg="bg.subtle">
            <RollExpand expression={expr} />
          </Table.Cell>
        </Table.Row>
      )}
    </>
  );
});
