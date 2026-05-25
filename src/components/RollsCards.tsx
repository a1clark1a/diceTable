import { memo, useCallback, useMemo, type ReactNode } from 'react';
import {
  Box,
  Button,
  Grid,
  HStack,
  IconButton,
  Input,
  Stack,
  Text,
} from '@chakra-ui/react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useApp, type ExpressionPatch } from '../state/useApp';
import { useBufferedValue } from '../hooks/useBufferedValue';
import { getRowData } from '../state/useDistributions';
import { hitProbability } from '../engine/stats';
import type { ChartView, Expression, TargetState } from '../types';
import { ExpressionDiceText } from './editor/ExpressionRender';
import { TargetToolbar } from './TargetToolbar';
import { RollExpand } from './RollExpand';
import { RollPopover, RollResultInline } from './RollResult';
import { hitColor, rowColor } from './chart/palette';
import { RowSparkline, ShapeCardLabel } from './chart/Sparkline';
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

export function RollsCards() {
  const {
    expressions,
    expandedId,
    chartView,
    target,
    setExpandedId,
    deleteExpression,
    renameExpression,
    updateExpression,
    addExpression,
  } = useApp();

  const showHit = target.values.length > 0;
  const view = effectiveChartView(chartView, target);

  return (
    <Stack gap={3}>
      <TargetToolbar />

      {expressions.length === 0 ? (
        <Box
          p={6}
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border.subtle"
          borderRadius="md"
          bg="bg.panel"
          textAlign="center"
        >
          <Stack gap={3} align="center">
            <Text fontSize="sm" fontWeight="medium">
              No rolls yet.
            </Text>
            <Text fontSize="xs" color="fg.muted" maxW="280px">
              Add a roll to start comparing distributions.
            </Text>
            <Button colorPalette="blue" size="sm" onClick={addExpression}>
              <Plus size={14} />
              Add roll
            </Button>
          </Stack>
        </Box>
      ) : (
        <Stack gap={2}>
          {expressions.map((expr, idx) => (
            <RollCard
              key={expr.id}
              expr={expr}
              idx={idx}
              expanded={expandedId === expr.id}
              showHit={showHit}
              view={view}
              target={target}
              setExpandedId={setExpandedId}
              deleteExpression={deleteExpression}
              renameExpression={renameExpression}
              updateExpression={updateExpression}
            />
          ))}
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
        </Stack>
      )}
    </Stack>
  );
}

interface RollCardProps {
  expr: Expression;
  idx: number;
  expanded: boolean;
  showHit: boolean;
  view: ChartView;
  target: TargetState;
  setExpandedId: (id: string | null) => void;
  deleteExpression: (id: string) => void;
  renameExpression: (id: string, name: string) => void;
  updateExpression: (id: string, patch: ExpressionPatch) => void;
}

const RollCard = memo(function RollCard({
  expr,
  idx,
  expanded,
  showHit,
  view,
  target,
  setExpandedId,
  deleteExpression,
  renameExpression,
  updateExpression,
}: RollCardProps) {
  const { stats, tooComplex } = getRowData(expr);
  const color = rowColor(idx);
  const hits = useMemo(
    () =>
      showHit && stats.hasDist
        ? target.values.map((v) => hitProbability(stats.dist, v, target.ruling))
        : null,
    [showHit, stats, target],
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
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      overflow="hidden"
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
          <Input
            size="sm"
            value={nameBuf.value}
            onChange={(e) => nameBuf.setValue(e.target.value)}
            onBlur={nameBuf.onBlur}
            onKeyDown={nameBuf.onKeyDown}
            flex="1"
            aria-label="Roll name"
          />
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
          <HStack gap={1} align="center">
            <HelpTerm tip={tipForId('mod')}>
              <Text as="span" fontSize="xs" color="fg.muted">
                Mod
              </Text>
            </HelpTerm>
            <Input
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

        {stats.hasDist && !tooComplex && (
          <Box mt={3} bg="bg.subtle" borderRadius="md" px={3} py={2}>
            <HStack gap={3} align="center">
              <ShapeCardLabel view={view} />
              <Box flex="1">
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
                    target={target}
                    height={36}
                    fill
                  />
                </InspectChart>
              </Box>
            </HStack>
          </Box>
        )}

        <Grid
          templateColumns={showHit ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'}
          gap={2}
          mt={3}
        >
          <StatPill
            label="Mean ± σ"
            tip={tipForId('meanSigma')}
            value={
              stats.hasDist ? (
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
              accessory={<RulingSymbol ruling={target.ruling} color="fg.muted" />}
              tip={tipForId('hit')}
              value={
                hits === null ? (
                  EM_DASH
                ) : (
                  <Stack gap={0.5} align="center">
                    {hits.map((p, i) => (
                      <HStack key={target.values[i]} gap={2} justify="center">
                        {target.values.length > 1 && (
                          <Text as="span" color="fg.muted" fontSize="2xs">
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
                )
              }
            />
          )}
        </Grid>

        <HStack justify="flex-end" gap={1} mt={2} align="center">
          <RollResultInline exprId={expr.id} />
          <RollPopover
            exprId={expr.id}
            exprName={expr.name}
            dist={stats.dist}
            disabled={!stats.hasDist || tooComplex}
          />
          <IconButton
            aria-label={expanded ? 'Collapse card' : 'Expand card'}
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
            aria-label="Delete card"
            size="xs"
            variant="ghost"
            colorPalette="red"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 size={14} />
          </IconButton>
        </HStack>
      </Box>
      {expanded && <RollExpand expression={expr} />}
    </Box>
  );
});

interface StatPillProps {
  label: string;
  value: ReactNode;
  tip: string;
  accessory?: ReactNode;
}

function StatPill({ label, value, tip, accessory }: StatPillProps) {
  return (
    <Box bg="bg.subtle" borderRadius="md" px={2} py={1.5} textAlign="center">
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
