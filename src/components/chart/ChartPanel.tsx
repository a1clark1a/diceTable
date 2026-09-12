import { lazy, Suspense, type ReactNode } from 'react';
import { Box, Button, HStack, Stack, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { useApp } from '../../state/useApp';
import type { ChartSurface, ChartView, Distribution } from '../../types';
import { ChartFallback } from './ChartFallback';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import { Tooltip } from '../ui/tooltip';
import { chipFocusRing } from '../editor/focusRings';
import type { ChartUnit } from './OverlayChartImpl';
import type { ChartPanelData } from './useChartPanels';

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

const PANEL_VIEWS: readonly { value: ChartView; label: string; tip: string }[] = [
  { value: 'pmf', label: 'PMF', tip: tipForId('pmf') },
  { value: 'cdf', label: 'CDF', tip: tipForId('cdf') },
  { value: 'ccdf', label: 'CCDF', tip: tipForId('ccdf') },
  { value: 'target', label: 'TARGET', tip: tipForId('targetView') },
];

interface PanelViewChipsProps {
  surface: ChartSurface;
  active: ChartView;
  hasTarget: boolean;
  groupLabel: string;
}

/**
 * Each card owns its view. A card whose own scale has no target hides the
 * TARGET chip rather than offering a view it would fall back out of.
 */
function PanelViewChips({
  surface,
  active,
  hasTarget,
  groupLabel,
}: PanelViewChipsProps) {
  const { setChartView } = useApp();
  const options = PANEL_VIEWS.filter(
    (v) => v.value !== 'target' || hasTarget,
  );
  return (
    <HStack
      gap="2px"
      p="2px"
      bg="bg.subtle"
      borderRadius="4px"
      flexWrap="wrap"
      role="group"
      aria-label={groupLabel}
    >
      {options.map((v) => {
        const isActive = active === v.value;
        return (
          <Tooltip key={v.value} content={v.tip}>
          <Button
            size="xs"
            variant={isActive ? 'solid' : 'plain'}
            colorPalette={isActive ? 'blue' : 'gray'}
            onClick={() => setChartView(surface, v.value)}
            aria-pressed={isActive}
            // 20px is the rail's density; a phone stacks the cards and has the
            // room for a real touch target.
            h={{ base: '40px', md: '20px' }}
            minW={0}
            px={2}
            borderRadius="3px"
            fontFamily="mono"
            fontSize="10px"
            fontWeight="500"
            _hover={{ bg: isActive ? 'colorPalette.solid/90' : 'bg.muted' }}
            _focusVisible={chipFocusRing}
          >
            {v.label}
          </Button>
          </Tooltip>
        );
      })}
    </HStack>
  );
}

interface ChartPanelProps {
  panel: ChartPanelData;
  dists: Map<string, Distribution>;
  colors: Map<string, string>;
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
  colors,
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
          <PanelViewChips
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
      <Suspense fallback={<ChartFallback variant="overlay" />}>
        <OverlayChartImpl
          expressions={panel.expressions}
          dists={dists}
          colors={colors}
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
