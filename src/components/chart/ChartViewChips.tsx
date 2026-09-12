import { Button, HStack } from '@chakra-ui/react';
import { useApp } from '../../state/useApp';
import type { ChartSurface, ChartView } from '../../types';
import { tipForId } from '../../docs/glossary';
import { Tooltip } from '../ui/tooltip';
import { chipFocusRing } from '../editor/focusRings';

const PANEL_VIEWS: readonly { value: ChartView; label: string; tip: string }[] = [
  { value: 'pmf', label: 'PMF', tip: tipForId('pmf') },
  { value: 'cdf', label: 'CDF', tip: tipForId('cdf') },
  { value: 'ccdf', label: 'CCDF', tip: tipForId('ccdf') },
  { value: 'target', label: 'TARGET', tip: tipForId('targetView') },
];

interface ChartViewChipsProps {
  surface: ChartSurface;
  active: ChartView;
  hasTarget: boolean;
  groupLabel: string;
  /**
   * Desktop height. The chart rail is denser than the parameters bar, so the
   * two callers differ here and nowhere else. Mobile is always a real touch
   * target.
   */
  density?: '20px' | '24px';
}

/**
 * Each surface owns its view. A surface whose own scale has no target hides the
 * TARGET chip rather than offering a view it would fall back out of.
 */
export function ChartViewChips({
  surface,
  active,
  hasTarget,
  groupLabel,
  density = '20px',
}: ChartViewChipsProps) {
  const { setChartView } = useApp();
  const options = PANEL_VIEWS.filter((v) => v.value !== 'target' || hasTarget);
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
              h={{ base: '40px', md: density }}
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
