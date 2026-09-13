import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Box, Button, HStack, Stack, Text, Wrap, WrapItem } from '@chakra-ui/react';
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
}: PanelLegendProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries : entries.slice(0, LEGEND_CAP);
  const hidden = entries.length - shown.length;

  return (
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
              aria-label={`Focus ${s.name} in chart`}
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
      {(hidden > 0 || expanded) && (
        <WrapItem>
          <Button
            size="xs"
            variant="ghost"
            h="auto"
            minW={0}
            px={1}
            fontWeight="normal"
            color="fg.muted"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show fewer' : `+${hidden} more`}
          </Button>
        </WrapItem>
      )}
    </Wrap>
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
  unit,
  height,
  enlarge,
}: ChartPanelProps) {
  // Focus stays panel-local: singling out a pool row highlights it among pool
  // series without dimming the other panel's rows.
  const owns = (id: string | null): boolean =>
    id !== null && panel.entries.some((e) => e.id === id);
  const focusedId = owns(incomingFocus) ? incomingFocus : null;
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
        pickedId={owns(pickedId) ? pickedId : null}
        onPreview={onPreview}
        onPick={onPick}
      />
      {panel.drawn < panel.total && (
        <HelpTerm tip={tipForId('chartRowCap')}>
          <Text as="span" fontSize="xs" color="fg.muted">
            Showing the first {panel.drawn} of {panel.total} rolls.
          </Text>
        </HelpTerm>
      )}
      {/* Empty chart ground clears the pick, so nobody is stranded isolated
          with no obvious way back. */}
      <Box onClick={() => onClear()}>
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
