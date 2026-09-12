import { memo, useCallback, useMemo, type ReactNode } from 'react';
import {
  Box,
  Button,
  Grid,
  HStack,
  IconButton,
  SimpleGrid,
  Stack,
  Text,
  type BoxProps,
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
  CheckSucceedsChip,
  ExpressionModeToggle,
  PoolThresholdEditor,
} from './editor/PoolControls';
import { RollExpand } from './RollExpand';
import { RollPopover, RollResultInline } from './RollResult';
import { rowColor } from './chart/palette';
import { RowSparkline, ShapeCardLabel } from './chart/Sparkline';
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

export function RollsCards() {
  const {
    expressions,
    expandedId,
    chartViews,
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

  // Pool rows answer the shared pool target, so the pill earns its place even
  // with the numeric target list empty.
  const showHit =
    target.values.length > 0 || expressions.some((e) => e.mode === 'pool');
  const atCap = expressions.length >= MAX_EXPRESSIONS;
  const comparison = useMemo(
    () => buildBaselineComparison(expressions, baselineId, target, poolTargets),
    [expressions, baselineId, target, poolTargets],
  );

  return (
    <Stack gap={2}>
      {/* One column is the phone layout. Above md the cards are the only layout
          up to the table's own threshold, and a single column there stretches
          one roll across the whole window: a 965px card at 991px holds a flat
          sparkline and three tiles sized for a phone. Two columns show twice
          the rolls at a width each card was designed for. */}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={2} alignItems="start">
          {expressions.map((expr, idx) => (
          <RollCard
          key={expr.id}
          expr={expr}
          idx={idx}
          expanded={expandedId === expr.id}
          showHit={showHit}
          chartView={chartViews.shape}
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
      </SimpleGrid>
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
    </Stack>
  );
}

interface RollCardProps {
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

const RollCard = memo(function RollCard({
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
}: RollCardProps) {
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
  const deltaMode = deltasActive && sameScale;
  const baselineAccent = isBaseline && comparison !== null;
  const meanDelta =
    comparison !== null ? stats.mean - comparison.stats.mean : 0;
  const sigmaDelta =
    comparison !== null ? stats.stddev - comparison.stats.stddev : 0;
  // Index-aligned while the card and the baseline share a scale; across scales
  // the two lists measure different things, so both read their first entry.
  const baseHitFor = (i: number): number | undefined => {
    if (comparison === null || comparison.hits === null) return undefined;
    return isPool === comparison.isPool ? comparison.hits[i] : comparison.hits[0];
  };
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
    <Box
      bg={baselineAccent ? 'bg.muted' : 'bg.panel'}
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="10px"
      overflow="hidden"
      // Inset shadow instead of a thicker border so pool and check cards' content
      // stays aligned with sum cards in the stack (a 3px border would inset it
      // 2px). A mode band wins over the baseline band so a pinned card never
      // hides its scale cue.
      boxShadow={
        isPool
          ? 'inset 3px 0 0 {colors.purple.solid}'
          : isCheck
            ? 'inset 3px 0 0 {colors.orange.solid}'
            : baselineAccent
              ? 'inset 3px 0 0 {colors.blue.solid}'
              : undefined
      }
    >
      <Box p={3}>
        <HStack gap={2} align="center">
          <Box
            w="10px"
            h="10px"
            borderRadius="2px"
            bg={color}
            flexShrink={0}
          />
          <FlushedInput
            size="sm"
            fontSize="15px"
            fontWeight="600"
            value={nameBuf.value}
            onChange={(e) => nameBuf.setValue(e.target.value)}
            onBlur={nameBuf.onBlur}
            onKeyDown={nameBuf.onKeyDown}
            flex="1"
            minW={0}
            aria-label="Roll name"
          />
          <IconButton
            aria-label={isBaseline ? 'Clear baseline' : 'Pin as baseline'}
            size="sm"
            variant={isBaseline ? 'subtle' : 'ghost'}
            colorPalette={isBaseline ? 'blue' : 'gray'}
            onClick={onTogglePin}
            title={tipForId(isBaseline ? 'baselinePinActive' : 'baselinePin')}
            flexShrink={0}
          >
            <Pin size={14} fill={isBaseline ? 'currentColor' : 'none'} />
          </IconButton>
          <IconButton
            aria-label={expanded ? 'Collapse card' : 'Expand card'}
            size="sm"
            variant="ghost"
            onClick={onToggleExpand}
            title={expanded ? 'Collapse' : 'Expand'}
            flexShrink={0}
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
            aria-label="Delete card"
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={onDelete}
            title="Delete"
            flexShrink={0}
          >
            <Trash2 size={14} />
          </IconButton>
        </HStack>

        <HStack gap={2} mt={2} align="center">
          <Text
            fontFamily="mono"
            fontSize="xs"
            color="fg.muted"
            flex="1"
            wordBreak="break-word"
          >
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
          </Text>
        </HStack>

        <HStack gap={1} mt={1.5} flexWrap="wrap" align="center">
          <ExpressionModeToggle mode={expr.mode} onSelect={onModeChange} />
          {isPool && expr.successThreshold && (
            <PoolThresholdEditor
              threshold={expr.successThreshold}
              onChange={onThresholdChange}
            />
          )}
          {isCheck && <CheckSucceedsChip chances={checkChances} />}
          <HStack gap={1} align="center" ml="auto">
            <HelpTerm
              tip={tipForId(
                isPool ? 'poolAutoSuccess' : isCheck ? 'checkModifier' : 'mod',
              )}
            >
              <Text as="span" fontSize="xs" color="fg.muted">
                Mod
              </Text>
            </HelpTerm>
            <FlushedInput
              size="xs"
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
            />
          </HStack>
        </HStack>

        {verdict !== null && (
          <Text mt={2} fontSize="xs" color="fg.muted" css={{ textWrap: 'pretty' }}>
            {verdict}
          </Text>
        )}

        {stats.hasDist && !tooComplex && (
          <Box mt={3} bg="bg.subtle" borderRadius="md" px={3} py={2}>
            <HStack gap={3} align="center">
              <ShapeCardLabel view={view} />
              <Box flex="1">
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
                    height={36}
                    fill
                  />
                </InspectChart>
              </Box>
            </HStack>
          </Box>
        )}

        {/* Two columns on cramped phones so mono values never wrap inside a
            pill; the Hit pill drops to its own full-width row there. Delta
            mode gives the wider vs-baseline pill 2fr of the first row. */}
        <Grid
          templateColumns={
            deltaMode
              ? { base: '2fr 1fr', sm: 'repeat(3, 1fr)' }
              : showHit
                ? { base: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }
                : 'repeat(2, 1fr)'
          }
          gap={2}
          mt={3}
        >
          <StatPill
            label={
              deltaMode ? (
                <HStack as="span" gap={3} justify="center">
                  <Box as="span" minW={DELTA_SLOT} textAlign="end">
                    Avg
                  </Box>
                  <Box as="span" minW={DELTA_SLOT} textAlign="end">
                    Spread
                  </Box>
                </HStack>
              ) : (
                // The label is CSS-uppercased; σ must opt out or it renders
                // as capital sigma, a different symbol.
                <>
                  Mean ±{' '}
                  <Box as="span" textTransform="none">
                    σ
                  </Box>
                </>
              )
            }
            tip={tipForId(deltaMode ? 'baseline' : 'meanSigma')}
            value={
              !stats.hasDist ? (
                EM_DASH
              ) : deltaMode && comparison !== null ? (
                <HStack as="span" gap={3} justify="center">
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
                      css={{ textWrap: 'pretty' }}
                    >
                      {hasHitValue
                        ? 'different scale, compare Hit % instead'
                        : 'different scale from the baseline'}
                    </Text>
                  )}
                </>
              )
            }
          />
          <StatPill
            label="Range"
            tip={tipForId('range')}
            value={stats.hasDist ? `${stats.min}–${stats.max}` : EM_DASH}
          />
          {showHit && (
            <StatPill
              label="Hit %"
              gridColumn={{ base: '1 / -1', sm: 'auto' }}
              // The numeric ruling symbol describes sum rows only; pool cards
              // carry their own ≥n label against the pool target instead.
              accessory={
                isPool ? undefined : (
                  <RulingSymbol ruling={target.ruling} color="fg.muted" />
                )
              }
              tip={tipForId(
                deltasActive ? 'deltaHit' : isPool ? 'poolTarget' : 'hit',
              )}
              value={
                isPool ? (
                  poolHits === null ? (
                    EM_DASH
                  ) : (
                    <Stack gap={0.5} align="center">
                      {poolHits.map(({ target: n, p }, i) => (
                        <HitLine
                          key={n}
                          label={
                            <Text as="span" color="purple.fg" fontSize="2xs">
                              ≥{n}
                            </Text>
                          }
                          p={p}
                          baseHit={deltasActive ? baseHitFor(i) : undefined}
                          justify="center"
                        />
                      ))}
                    </Stack>
                  )
                ) : hits === null ? (
                  EM_DASH
                ) : (
                  <Stack gap={0.5} align="center">
                    {hits.map((p, i) => (
                      <HitLine
                        key={target.values[i]}
                        {...(target.values.length > 1
                          ? {
                              label: (
                                <Text as="span" color="fg.muted" fontSize="2xs">
                                  {target.values[i]}
                                </Text>
                              ),
                            }
                          : {})}
                        p={p}
                        baseHit={deltasActive ? baseHitFor(i) : undefined}
                        justify="center"
                      />
                    ))}
                  </Stack>
                )
              }
            />
          )}
        </Grid>

        {!isPool && (
          <HStack justify="flex-end" gap={1} mt={2} align="center">
            <RollResultInline exprId={expr.id} />
            <RollPopover
              exprId={expr.id}
              exprName={expr.name}
              dist={stats.dist}
              disabled={!stats.hasDist || tooComplex}
            />
          </HStack>
        )}
      </Box>
      {expanded && <RollExpand expression={expr} />}
    </Box>
  );
});

interface StatPillProps {
  label: ReactNode;
  value: ReactNode;
  tip: string;
  accessory?: ReactNode;
  /** Lets a pill span the stats grid when its content needs the full card width. */
  gridColumn?: BoxProps['gridColumn'];
}

function StatPill({ label, value, tip, accessory, gridColumn }: StatPillProps) {
  return (
    <Box
      bg="bg.subtle"
      borderRadius="md"
      px={2}
      py={1.5}
      textAlign="center"
      gridColumn={gridColumn}
    >
      <HStack as="span" gap={1} justify="center">
        <HelpTerm tip={tip}>
          <Text
            as="span"
            fontSize="2xs"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            {label}
          </Text>
        </HelpTerm>
        {accessory !== undefined && (
          <Box
            as="span"
            fontSize="2xs"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            {accessory}
          </Box>
        )}
      </HStack>
      <Box
        fontFamily="mono"
        fontSize="sm"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Box>
    </Box>
  );
}
