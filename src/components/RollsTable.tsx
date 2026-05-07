import { memo, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  HStack,
  IconButton,
  Input,
  Popover,
  Portal,
  Stack,
  Table,
  Text,
  chakra,
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
import { EM_DASH, formatNumber, formatPercent } from './chart/format';
import { HelpTerm } from './ui/help-term';
import { TIPS } from './ui/tips';
import { InspectDistribution } from './inspect/InspectDistribution';
import {
  InspectMean,
  InspectMode,
  InspectSigma,
} from './inspect/InspectStat';

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

  const showHit = target.value !== null;

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
                  <HelpTerm tip={TIPS.mod}>Mod</HelpTerm>
                </Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">
                  <HelpTerm tip={TIPS.mean}>Mean</HelpTerm>
                </Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">
                  <HelpTerm tip={TIPS.min}>Min</HelpTerm>
                </Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">
                  <HelpTerm tip={TIPS.max}>Max</HelpTerm>
                </Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">
                  <HelpTerm tip={TIPS.mode}>Mode</HelpTerm>
                </Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">
                  <HelpTerm tip={TIPS.sigma} ariaLabel="Standard deviation">
                    σ
                  </HelpTerm>
                </Table.ColumnHeader>
                {showHit && (
                  <Table.ColumnHeader textAlign="end">
                    <HelpTerm tip={TIPS.hit}>Hit %</HelpTerm>
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
                const hit = showHit && stats.hasDist
                  ? hitProbability(stats.dist, target.value!, target.ruling)
                  : null;
                return (
                  <RollTableRow
                    key={expr.id}
                    expr={expr}
                    color={color}
                    stats={stats}
                    hit={hit}
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
                <Table.Cell colSpan={showHit ? 10 : 9} py={3}>
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

interface ModeCellProps {
  modes: number[];
}

function ModeCell({ modes }: ModeCellProps) {
  if (modes.length === 0) return <>{EM_DASH}</>;
  if (modes.length <= 3) return <>{modes.join(', ')}</>;

  const visible = modes.slice(0, 3).join(', ');
  const hidden = modes.length - 3;

  return (
    <Popover.Root positioning={{ placement: 'top' }}>
      <Popover.Trigger asChild>
        <chakra.button
          type="button"
          fontFamily="mono"
          color="fg"
          cursor="pointer"
          borderRadius="sm"
          px={1}
          mx={-1}
          bg="transparent"
          _hover={{
            color: 'colorPalette.fg',
            bg: 'bg.muted',
          }}
          _focusVisible={{
            outline: '2px solid',
            outlineColor: 'colorPalette.solid',
            outlineOffset: '1px',
          }}
          aria-label={`Show all ${modes.length} tied results`}
          title="Click to see all tied results"
        >
          {visible},{' '}
          <Text
            as="span"
            textDecoration="underline"
            textDecorationStyle="dotted"
          >
            +{hidden}
          </Text>
        </chakra.button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content maxW="280px">
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body>
              <Text fontSize="xs" color="fg.muted" mb={1}>
                {modes.length} results are equally likely
              </Text>
              <Text fontFamily="mono" fontSize="sm" wordBreak="break-word">
                {modes.join(', ')}
              </Text>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

interface RollTableRowProps {
  expr: Expression;
  color: string;
  stats: RowStats;
  hit: number | null;
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
  hit,
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
            <InspectMean
              exprName={expr.name}
              hasDist={stats.hasDist && !tooComplex}
              dist={stats.dist}
              mean={stats.mean}
            >
              {formatNumber(stats.mean, 3)}
            </InspectMean>
          ) : (
            EM_DASH
          )}
        </Table.Cell>
        <Table.Cell
          textAlign="end"
          fontFamily="mono"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {stats.hasDist ? stats.min : EM_DASH}
        </Table.Cell>
        <Table.Cell
          textAlign="end"
          fontFamily="mono"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {stats.hasDist ? stats.max : EM_DASH}
        </Table.Cell>
        <Table.Cell
          textAlign="end"
          fontFamily="mono"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {stats.mode.length > 0 && stats.mode.length <= 3 ? (
            <InspectMode
              exprName={expr.name}
              hasDist={stats.hasDist && !tooComplex}
              dist={stats.dist}
              modes={stats.mode}
            >
              {stats.mode.join(', ')}
            </InspectMode>
          ) : (
            <ModeCell modes={stats.mode} />
          )}
        </Table.Cell>
        <Table.Cell
          textAlign="end"
          fontFamily="mono"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {stats.hasDist ? (
            <InspectSigma
              exprName={expr.name}
              hasDist={stats.hasDist && !tooComplex}
              dist={stats.dist}
              mean={stats.mean}
              stddev={stats.stddev}
            >
              {formatNumber(stats.stddev, 3)}
            </InspectSigma>
          ) : (
            EM_DASH
          )}
        </Table.Cell>
        {showHit && (
          <Table.Cell
            textAlign="end"
            fontFamily="mono"
            style={{ fontVariantNumeric: 'tabular-nums' }}
            color={hit === null ? undefined : hitColor(hit)}
            fontWeight={hit !== null && hit >= 0.66 ? 'semibold' : undefined}
          >
            {hit === null ? EM_DASH : formatPercent(hit)}
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
          <Table.Cell colSpan={showHit ? 10 : 9} p={0} bg="bg.subtle">
            <RollExpand expression={expr} />
          </Table.Cell>
        </Table.Row>
      )}
    </>
  );
});
