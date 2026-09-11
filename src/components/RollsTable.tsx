import { memo, useCallback, useMemo, type ReactNode } from 'react';
import {
  Badge,
  Box,
  Button,
  HStack,
  IconButton,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import { ChevronDown, Pin, Plus, Trash2 } from 'lucide-react';
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
  CheckBadge,
  CheckSucceedsChip,
  PoolBadge,
  ExpressionModeToggle,
  PoolThresholdEditor,
} from './editor/PoolControls';
import { RollExpand } from './RollExpand';
import { RollPopover, RollResultInline } from './RollResult';
import { rowColor } from './chart/palette';
import { RowSparkline, ShapeHeaderLabel } from './chart/Sparkline';
import { effectiveChartView } from './chart/effectiveView';
import {
  EM_DASH,
  deltaTone,
  formatDelta,
  formatNumber,
} from './chart/format';
import {
  STAT_DELTA_EPS,
  buildBaselineComparison,
  type BaselineComparison,
} from './baseline/comparison';
import { buildVerdict } from './baseline/verdict';
import { DELTA_SLOT, DeltaValue } from './baseline/DeltaLine';
import { HitLine } from './HitLine';
import { avgDeltaAria, spreadDeltaAria } from './baseline/deltaText';
import { HelpTerm } from './ui/help-term';
import { tipForId } from '../docs/glossary';
import { RulingSymbol } from './targetRuling';
import { FlushedInput } from './FlushedInput';
import { InspectChart } from './inspect/InspectChart';
import { InspectDistribution } from './inspect/InspectDistribution';
import { InspectMean, InspectSigma } from './inspect/InspectStat';

// A row is one line of content plus 6px either side. Stacking anything inside a
// cell is what used to make rows 74px.
const CELL_RHYTHM = {
  '& td, & th': { paddingTop: '1.5', paddingBottom: '1.5', paddingInline: '2' },
} as const;

const COLUMN_HEADER_TYPE = {
  fontFamily: 'mono',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'fg.muted',
} as const;

// Uppercasing is a CSS transform, so anything that is already a distinct
// glyph or a name the user typed has to opt out of it.
const KEEP_CASE = { textTransform: 'none' } as const;

function DeltaSubLabel({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <HelpTerm tip={tip}>
      <Text
        as="span"
        fontSize="9px"
        fontWeight="500"
        letterSpacing="0.09em"
        color="fg.subtle"
        display="inline-block"
        minW={DELTA_SLOT}
        textAlign="end"
      >
        {children}
      </Text>
    </HelpTerm>
  );
}

// The cell shows two words; the sentence they stand for lives in the title so
// the row keeps its height.
const DIFFERENT_SCALE_HIT =
  'This roll counts successes and the baseline totals dice, so their averages are not comparable. Compare Hit % instead.';
const DIFFERENT_SCALE =
  'This roll and the baseline are on different scales, so their averages are not comparable.';

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
    poolTargets,
    baselineId,
    setExpandedId,
    setBaselineId,
    deleteExpression,
    renameExpression,
    updateExpression,
    addExpression,
  } = useApp();

  // Pool rows answer the shared pool target, so the column earns its place
  // even with the numeric target list empty.
  const showHit =
    target.values.length > 0 || expressions.some((e) => e.mode === 'pool');
  const atCap = expressions.length >= MAX_EXPRESSIONS;
  const comparison = useMemo(
    () => buildBaselineComparison(expressions, baselineId, target, poolTargets),
    [expressions, baselineId, target, poolTargets],
  );

  return (
    <Stack gap={3}>
      <Box
        bg="bg.panel"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        flex="0 1 auto"
        overflow="hidden"
      >
        {/* Tables cannot shrink below min-content; without a scroll fallback
            the overflow:hidden panel would clip the rightmost columns
            unreachably at narrow desktop widths. */}
        <Table.ScrollArea>
          <Table.Root size="sm" variant="line" striped={false} css={CELL_RHYTHM}>
          <Table.Header css={COLUMN_HEADER_TYPE}>
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
                {comparison !== null ? (
                  <Stack gap={0.5} align="flex-end">
                    <HelpTerm tip={tipForId('baseline')}>
                      vs{' '}
                      <Text as="span" css={KEEP_CASE}>
                        {comparison.name}
                      </Text>
                    </HelpTerm>
                    <HStack as="span" gap={4} justify="flex-end">
                      <DeltaSubLabel tip={tipForId('deltaAvg')}>Avg</DeltaSubLabel>
                      <DeltaSubLabel tip={tipForId('deltaSpread')}>
                        Spread
                      </DeltaSubLabel>
                    </HStack>
                  </Stack>
                ) : (
                  <HelpTerm tip={tipForId('meanSigma')}>
                    Mean ±{' '}
                    <Text as="span" css={KEEP_CASE}>
                      σ
                    </Text>
                  </HelpTerm>
                )}
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
                    <HelpTerm
                      tip={tipForId(comparison !== null ? 'deltaHit' : 'hit')}
                    >
                      Hit %
                    </HelpTerm>
                    {/* The ruling describes sum rows only; pool cells carry
                        their own ≥n label against the pool target. */}
                    {target.values.length > 0 && (
                      <RulingSymbol ruling={target.ruling} color="fg.muted" />
                    )}
                  </HStack>
                </Table.ColumnHeader>
              )}
              <Table.ColumnHeader textAlign="end" w="160px">
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
                chartView={chartView}
                target={target}
                poolTargets={poolTargets}
                baselineId={baselineId}
                comparison={comparison}
                setExpandedId={setExpandedId}
                setBaselineId={setBaselineId}
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
    </Stack>
  );
}

interface RollTableRowProps {
  expr: Expression;
  idx: number;
  expanded: boolean;
  showHit: boolean;
  chartView: ChartView;
  target: TargetState;
  poolTargets: number[];
  baselineId: string | null;
  comparison: BaselineComparison | null;
  setExpandedId: (id: string | null) => void;
  setBaselineId: (id: string | null) => void;
  deleteExpression: (id: string) => void;
  renameExpression: (id: string, name: string) => void;
  updateExpression: (id: string, patch: ExpressionPatch) => void;
}

const RollTableRow = memo(function RollTableRow({
  expr,
  idx,
  expanded,
  showHit,
  chartView,
  target,
  poolTargets,
  baselineId,
  comparison,
  setExpandedId,
  setBaselineId,
  deleteExpression,
  renameExpression,
  updateExpression,
}: RollTableRowProps) {
  const { stats, tooComplex, checkChances } = getRowData(expr);
  const color = rowColor(idx);
  const isPool = expr.mode === 'pool';
  const isCheck = expr.mode === 'check';
  const hits = useMemo(
    () =>
      !isPool && showHit && stats.hasDist && target.values.length > 0
        ? target.values.map((v) => hitProbability(stats.dist, v, target.ruling))
        : null,
    [isPool, showHit, stats, target],
  );
  const poolHits = useMemo(
    () =>
      isPool && showHit && stats.hasDist
        ? poolTargets.map((n) => ({
            target: n,
            p: hitProbability(stats.dist, n, 'gte'),
          }))
        : null,
    [isPool, showHit, stats, poolTargets],
  );
  // In target view a pool row's shape highlights against the shared pool
  // targets; the numeric target list describes sums, not success counts.
  const sparkTarget = useMemo<TargetState>(
    () => (isPool ? { values: poolTargets, ruling: 'gte' } : target),
    [isPool, poolTargets, target],
  );
  const view = effectiveChartView(chartView, sparkTarget.values.length > 0);
  // Pointing at the Hit % column only helps a row that has one; a sum row
  // with no numeric target set shows a dash there.
  const hasHitValue = hits !== null || poolHits !== null;
  const isBaseline = baselineId === expr.id;
  const rowOk = stats.hasDist && !tooComplex;
  const deltasActive = comparison !== null && !isBaseline && rowOk;
  const sameScale = comparison === null || isPool === comparison.isPool;
  const baselineAccent = isBaseline && comparison !== null;
  const meanDelta =
    comparison !== null ? stats.mean - comparison.stats.mean : 0;
  const sigmaDelta =
    comparison !== null ? stats.stddev - comparison.stats.stddev : 0;
  // Index-aligned while the row and the baseline share a scale; across scales
  // the two lists measure different things, so both read their first entry.
  const baseHitFor = (i: number): number | undefined => {
    if (comparison === null || comparison.hits === null) return undefined;
    return isPool === comparison.isPool ? comparison.hits[i] : comparison.hits[0];
  };
  const hitMax = comparison?.maxHitDelta ?? 0;
  const verdict = deltasActive
    ? buildVerdict({
        mean: stats.mean,
        stddev: stats.stddev,
        isPool,
        firstHit: isPool ? (poolHits?.[0]?.p ?? null) : (hits?.[0] ?? null),
        baseMean: comparison.stats.mean,
        baseStddev: comparison.stats.stddev,
        baseIsPool: comparison.isPool,
        baseFirstHit: comparison.hits?.[0] ?? null,
      })
    : null;
  const onToggleExpand = useCallback(
    () => setExpandedId(expanded ? null : expr.id),
    [setExpandedId, expanded, expr.id],
  );
  const onTogglePin = useCallback(
    () => setBaselineId(isBaseline ? null : expr.id),
    [setBaselineId, isBaseline, expr.id],
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
      <Table.Row
        bg={baselineAccent ? 'bg.subtle' : undefined}
        _hover={{ bg: 'bg.subtle' }}
      >
        {/* Transparent border on sum rows keeps every row's left edge aligned;
            pool and check rows tint it as their identity band. A mode band wins
            over the baseline band so a pinned row never hides its scale cue. */}
        <Table.Cell
          borderLeftWidth="3px"
          borderLeftColor={
            isPool
              ? 'purple.solid'
              : isCheck
                ? 'orange.solid'
                : baselineAccent
                  ? 'blue.solid'
                  : 'transparent'
          }
        >
          <HStack gap={2} minW="200px">
            <Box
              w="10px"
              h="10px"
              borderRadius="2px"
              bg={color}
              flexShrink={0}
            />
            <FlushedInput
              size="sm"
              h="32px"
              value={nameBuf.value}
              onChange={(e) => nameBuf.setValue(e.target.value)}
              onBlur={nameBuf.onBlur}
              onKeyDown={nameBuf.onKeyDown}
              maxW="220px"
              aria-label="Roll name"
            />
            {isBaseline && (
              <Tooltip content={tipForId('baseline')}>
                <Badge colorPalette="blue" variant="surface" flexShrink={0}>
                  Baseline
                </Badge>
              </Tooltip>
            )}
            {isPool && <PoolBadge />}
            {isCheck && <CheckBadge />}
          </HStack>
        </Table.Cell>
        <Table.Cell>
          <HStack gap={3} align="center" flexWrap="wrap">
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
              <ExpressionModeToggle mode={expr.mode} onSelect={onModeChange} />
              {isPool && expr.successThreshold && (
                <PoolThresholdEditor
                  threshold={expr.successThreshold}
                  onChange={onThresholdChange}
                />
              )}
              {isCheck && <CheckSucceedsChip chances={checkChances} />}
            </HStack>
          </HStack>
        </Table.Cell>
        <Table.Cell textAlign="end">
          <Tooltip
            content={tipForId(isPool ? 'poolAutoSuccess' : 'checkModifier')}
            disabled={!isPool && !isCheck}
          >
            <FlushedInput
              size="sm"
              h="32px"
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
          {!stats.hasDist ? (
            EM_DASH
          ) : deltasActive && sameScale ? (
            <HStack
              as="span"
              gap={4}
              justify="flex-end"
              {...(verdict !== null ? { title: verdict } : {})}
            >
              <DeltaValue
                tip={tipForId('deltaAvg')}
                text={formatDelta(meanDelta, 2)}
                ariaLabel={avgDeltaAria(
                  meanDelta,
                  deltaTone(meanDelta, STAT_DELTA_EPS),
                )}
                tone={deltaTone(meanDelta, STAT_DELTA_EPS)}
              />
              <DeltaValue
                tip={tipForId('deltaSpread')}
                text={formatDelta(sigmaDelta, 2)}
                ariaLabel={spreadDeltaAria(
                  sigmaDelta,
                  deltaTone(sigmaDelta, STAT_DELTA_EPS),
                )}
                tone={deltaTone(sigmaDelta, STAT_DELTA_EPS)}
                neutral
              />
            </HStack>
          ) : (
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
              {deltasActive && !sameScale && (
                <Text
                  fontSize="xs"
                  color="fg.muted"
                  fontFamily="body"
                  whiteSpace="nowrap"
                  title={hasHitValue ? DIFFERENT_SCALE_HIT : DIFFERENT_SCALE}
                >
                  different scale
                </Text>
              )}
            </>
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
              target={sparkTarget}
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
              poolHits === null ? (
                EM_DASH
              ) : (
                <Stack gap={0.5} align="flex-end">
                  {poolHits.map(({ target: n, p }, i) => (
                    // Pool rows answer to the shared pool targets, not the
                    // toolbar's numeric ones; the labeled ≥n makes that
                    // visible (and audible) per entry.
                    <HitLine
                      key={n}
                      label={
                        <HelpTerm
                          tip={tipForId('poolTarget')}
                          ariaLabel={`At least ${n} successes`}
                        >
                          <Text as="span" color="purple.fg" fontSize="xs">
                            ≥{n}
                          </Text>
                        </HelpTerm>
                      }
                      p={p}
                      baseHit={deltasActive ? baseHitFor(i) : undefined}
                      maxDelta={hitMax}
                    />
                  ))}
                </Stack>
              )
            ) : hits === null ? (
              EM_DASH
            ) : (
              <Stack gap={0.5} align="flex-end">
                {hits.map((p, i) => (
                  <HitLine
                    key={target.values[i]}
                    {...(target.values.length > 1
                      ? {
                          label: (
                            <Text as="span" color="fg.muted" fontSize="xs">
                              {target.values[i]}
                            </Text>
                          ),
                        }
                      : {})}
                    p={p}
                    baseHit={deltasActive ? baseHitFor(i) : undefined}
                    maxDelta={hitMax}
                  />
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
              aria-label={isBaseline ? 'Clear baseline' : 'Pin as baseline'}
              size="xs"
              variant={isBaseline ? 'subtle' : 'ghost'}
              colorPalette={isBaseline ? 'blue' : 'gray'}
              onClick={onTogglePin}
              title={tipForId(isBaseline ? 'baselinePinActive' : 'baselinePin')}
            >
              <Pin size={14} fill={isBaseline ? 'currentColor' : 'none'} />
            </IconButton>
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
            borderLeftColor={
              isPool
                ? 'purple.solid'
                : isCheck
                  ? 'orange.solid'
                  : baselineAccent
                    ? 'blue.solid'
                    : 'transparent'
            }
          >
            <RollExpand expression={expr} />
          </Table.Cell>
        </Table.Row>
      )}
    </>
  );
});
