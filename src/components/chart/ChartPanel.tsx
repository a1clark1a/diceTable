import { lazy, Suspense, type ReactNode } from 'react';
import { Box, HStack, Stack, Text, Wrap, WrapItem } from '@chakra-ui/react';
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
  onHover: (id: string | null) => void;
}

export function PanelLegend({ entries, focusedId, onHover }: PanelLegendProps) {
  return (
    <Wrap gap={3}>
      {entries.map((s) => {
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
              // Same pinned-blue ring as the pool chips: dimming the other
              // entries is not a visible focus indicator on the entry itself.
              _focusVisible={{
                outlineWidth: '2px',
                outlineStyle: 'solid',
                outlineColor: 'blue.solid',
                outlineOffset: '2px',
              }}
              aria-label={`Focus ${s.name} in chart`}
              onMouseEnter={() => onHover(s.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(s.id)}
              onBlur={() => onHover(null)}
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
}

interface ChartPanelProps {
  panel: ChartPanelData;
  dists: Map<string, Distribution>;
  slots: Map<string, number>;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
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
  hoveredId,
  onHover,
  unit,
  height,
  enlarge,
}: ChartPanelProps) {
  // Focus stays panel-local: hovering a pool row highlights it among pool
  // series without dimming the other panel's rows.
  const focusedId =
    hoveredId !== null && panel.entries.some((e) => e.id === hoveredId)
      ? hoveredId
      : null;
  return (
    <Stack
      gap={2}
      minW={0}
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="8px"
      p={3}
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
        onHover={onHover}
      />
      {panel.drawn < panel.total && (
        <HelpTerm tip={tipForId('chartRowCap')}>
          <Text as="span" fontSize="xs" color="fg.muted">
            Showing the first {panel.drawn} of {panel.total} rolls.
          </Text>
        </HelpTerm>
      )}
      <Suspense fallback={<ChartFallback variant="overlay" />}>
        <OverlayChartImpl
          expressions={panel.expressions}
          dists={dists}
          slots={slots}
          effectiveView={panel.effectiveView}
          target={panel.target}
          hoveredId={hoveredId}
          unit={unit}
          {...(height !== undefined ? { height } : {})}
        />
      </Suspense>
    </Stack>
  );
}
