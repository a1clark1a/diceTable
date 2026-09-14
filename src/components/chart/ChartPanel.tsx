import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  HStack,
  Stack,
  Text,
  VisuallyHidden,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { RangePager } from './RangePager';
import { pageCount } from './rowCap';
import { CHART_FIELD_THRESHOLD } from './fieldPen';
import { litSummary } from './litSummary';
import { getRowData } from '../../state/useDistributions';
import type { Distribution } from '../../types';
import { ChartFallback } from './ChartFallback';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import type { ChartUnit } from './OverlayChartImpl';
import type { ChartPanelData } from './useChartPanels';
import { ChartViewChips } from './ChartViewChips';

const OverlayChartImpl = lazy(() => import('./OverlayChartImpl'));

interface PanelLegendProps {
  entries: ChartPanelData['entries'];
  focusedId: string | null;
  pickedId: string | null;
  onPreview: (id: string | null) => void;
  onPick: (id: string) => void;
  /** The chart is drawing a field, so this list is the only index into it. */
  dense?: boolean;
}

// The number every other capped legend in the app uses, so a reader meets one
// rule rather than three. The overflow expands rather than being a dead chip:
// these entries are the only control that isolates a roll, so hiding one behind
// a label that does nothing would put that roll out of reach entirely.
const LEGEND_CAP = 12;

export function PanelLegend({
  entries,
  focusedId,
  pickedId,
  onPreview,
  onPick,
  dense = false,
}: PanelLegendProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries : entries.slice(0, LEGEND_CAP);
  const hidden = entries.length - shown.length;
  const total = entries.length;

  const chips = (
    <Wrap gap={3}>
      {shown.map((s) => {
        const dim = focusedId !== null && focusedId !== s.id;
        return (
          <WrapItem key={s.id}>
            <HStack
              gap={2}
              role="button"
              tabIndex={0}
              cursor="pointer"
              opacity={dim ? 0.4 : 1}
              transition="opacity 120ms ease-out"
              borderRadius="2px"
              // A finger needs a target even though the text is small; the row
              // stays its text height and the hit area is grown underneath it.
              position="relative"
              _after={{
                content: '""',
                position: 'absolute',
                insetInline: 0,
                insetBlock: '-11px',
              }}
              // Same pinned-blue ring as the pool chips: dimming the other
              // entries is not a visible focus indicator on the entry itself.
              _focusVisible={{
                outlineWidth: '2px',
                outlineStyle: 'solid',
                outlineColor: 'blue.solid',
                outlineOffset: '2px',
              }}
              // Row names repeat and eight hues repeat thirteen times over a
              // hundred rolls, so on a field the name alone does not say which
              // chip this is.
              aria-label={
                dense
                  ? `Focus ${s.name}, roll ${entries.indexOf(s) + 1} of ${total}, in chart`
                  : `Focus ${s.name} in chart`
              }
              aria-pressed={pickedId === s.id}
              onClick={() => onPick(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(s.id);
                }
              }}
              onMouseEnter={() => onPreview(s.id)}
              onMouseLeave={() => onPreview(null)}
              onFocus={() => onPreview(s.id)}
              onBlur={() => onPreview(null)}
            >
              <Box
                w="10px"
                h="10px"
                borderRadius="2px"
                bg={s.color}
                flexShrink={0}
              />
              <Text fontSize="xs" color="fg.muted">
                {s.name}
              </Text>
            </HStack>
          </WrapItem>
        );
      })}
    </Wrap>
  );

  const expander = (hidden > 0 || expanded) && (
    <Button
      size="xs"
      variant="ghost"
      h="auto"
      minW={0}
      px={1}
      alignSelf="flex-start"
      fontWeight="normal"
      color="fg.muted"
      onClick={() => setExpanded((v) => !v)}
    >
      {expanded ? 'Show fewer' : `+${hidden} more`}
    </Button>
  );

  // A hundred names expanded in place would push the chart off the card, so on
  // a field the list scrolls. The expander sits outside that box: below seven
  // rows of chips and a hundred tab stops is not where the way back belongs.
  //
  // maxH in lh rather than px so a raised default font size or a 200% zoom
  // still shows whole rows. The padding is for the chips' grown hit area and
  // focus ring, which a scroll container would otherwise clip, horizontally
  // too because overflow-y auto computes overflow-x auto with it.
  if (!dense) {
    return (
      <Stack gap={0}>
        {chips}
        {expander}
      </Stack>
    );
  }
  return (
    <Stack gap={1}>
      <Box
        role="group"
        aria-label="Rolls drawn on this chart"
        maxH="9lh"
        overflowY="auto"
        overscrollBehavior="contain"
        px="2px"
        py="14px"
        scrollPaddingBlock="14px"
      >
        {chips}
      </Box>
      {expander}
    </Stack>
  );
}

interface ChartPagerProps {
  panel: ChartPanelData;
  pageSize: number;
  onPage: (key: ChartPanelData['key'], page: number) => void;
}

/**
 * Which slice of the rolls this chart is drawing, and the way to the rest.
 *
 * The card used to say "showing the first N" and stop there, which is honest
 * but leaves every roll past the cut unreachable on this surface. There is no
 * reorder action either, so the roll you could never see was always the newest
 * one.
 */
function ChartPager({ panel, pageSize, onPage }: ChartPagerProps) {
  return (
    <RangePager
      from={panel.from}
      shown={panel.drawn}
      total={panel.total}
      page={panel.page}
      pages={pageCount(panel.total, pageSize)}
      what={`${panel.title} chart`}
      onPage={(page) => onPage(panel.key, page)}
      tip={tipForId('chartRowCap')}
    />
  );
}

interface ChartPanelProps {
  panel: ChartPanelData;
  dists: Map<string, Distribution>;
  slots: Map<string, number>;
  focusedId: string | null;
  pickedId: string | null;
  onPreview: (id: string | null) => void;
  onPick: (id: string) => void;
  onClear: () => void;
  /** How many curves a page holds, and where the page state lives. */
  pageSize: number;
  onPage?: ((key: ChartPanelData['key'], page: number) => void) | undefined;
  unit: ChartUnit;
  /** Set by the enlarged copy, which has more room than the rail. */
  height?: string;
  /** The rail's card offers it; the enlarged copy is already enlarged. */
  enlarge?: ReactNode;
}

export function ChartPanel({
  panel,
  dists,
  slots,
  focusedId: incomingFocus,
  pickedId,
  onPreview,
  onPick,
  onClear,
  pageSize,
  onPage,
  unit,
  height,
  enlarge,
}: ChartPanelProps) {
  // Focus stays panel-local: singling out a pool row highlights it among pool
  // series without dimming the other panel's rows.
  const owns = (id: string | null): boolean =>
    id !== null && panel.entries.some((e) => e.id === id);
  const focusedId = owns(incomingFocus) ? incomingFocus : null;
  const ownPick = owns(pickedId) ? pickedId : null;
  // Kept in step with OverlayChartImpl's own test by the same threshold over
  // the same count; the legend has to become an index at the moment the curves
  // stop being individually followable, not a render later.
  const dense = panel.drawn > CHART_FIELD_THRESHOLD;
  // Reading a mean is a cached WeakMap hit per row, so this costs nothing that
  // drawing the row did not already cost.
  const summary = useMemo(
    () =>
      dense
        ? litSummary(
            panel.expressions.map((expr, i) => ({
              id: expr.id,
              name: panel.entries[i]?.name ?? expr.name,
              mean: getRowData(expr).stats.mean,
            })),
            ownPick,
          )
        : '',
    [dense, panel.expressions, panel.entries, ownPick],
  );
  return (
    <Stack
      gap={2}
      minW={0}
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="8px"
      p={3}
      // Escape is the way out of an isolated view from the keyboard, and it has
      // to work from anywhere inside the card, not only while a chip has focus.
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClear();
      }}
    >
      <HStack justify="space-between" align="center" gap={2} wrap="wrap">
        <HelpTerm tip={tipForId(panel.titleTip)}>
          <Text
            as="span"
            fontSize="12px"
            fontWeight="600"
            letterSpacing="-0.005em"
            color={panel.titleColor}
          >
            {panel.title}
          </Text>
        </HelpTerm>
        <HStack gap={1}>
          <ChartViewChips
            surface={panel.key}
            active={panel.effectiveView}
            hasTarget={panel.hasTarget}
            groupLabel={`${panel.title} chart view`}
          />
          {enlarge}
        </HStack>
      </HStack>
      <PanelLegend
        entries={panel.entries}
        focusedId={focusedId}
        pickedId={ownPick}
        onPreview={onPreview}
        onPick={onPick}
        dense={dense}
      />
      {/* The slot under the legend never goes quiet: it says what was cut, or
          says nothing was. A card that silently drew everything would be the
          one card in the app that does not account for itself. */}
      {panel.drawn < panel.total && onPage !== undefined ? (
        <ChartPager panel={panel} pageSize={pageSize} onPage={onPage} />
      ) : dense ? (
        <HelpTerm tip={tipForId('chartFieldView')}>
          <Text as="span" fontSize="xs" color="fg.muted">
            Drawing all {panel.total} rolls. Pick a name to light one up.
          </Text>
        </HelpTerm>
      ) : null}
      {/* The field answers "where does my roll sit among all of them" by
          showing it, which is nothing without sight. Rank by average is the
          same answer in a sentence. Only a sticky pick announces; a preview
          changes too fast to read. */}
      {dense && (
        <VisuallyHidden role="status" aria-live="polite">
          {summary}
        </VisuallyHidden>
      )}
      {/* Empty chart ground clears the pick, so nobody is stranded isolated
          with no obvious way back. Panel-scoped: with both charts on screen,
          clicking one canvas has no business dropping a pick made on the
          other, which is the panel this one is dimming itself against. */}
      <Box
        onClick={() => {
          if (owns(incomingFocus) || owns(pickedId)) onClear();
        }}
      >
      <Suspense fallback={<ChartFallback variant="overlay" />}>
        <OverlayChartImpl
          expressions={panel.expressions}
          dists={dists}
          slots={slots}
          effectiveView={panel.effectiveView}
          target={panel.target}
          focusedId={focusedId}
          unit={unit}
          {...(height !== undefined ? { height } : {})}
        />
      </Suspense>
      </Box>
    </Stack>
  );
}
