import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { useCallback } from 'react';
import { useApp } from '../state/useApp';
import { Tooltip } from './ui/tooltip';
import { HelpTerm } from './ui/help-term';
import { tipForId } from '../docs/glossary';
import {
  ROLL_MODES,
  isRollMode,
  rollModeSummary,
  type SegmentedOption,
} from './rollModes';

interface SegmentedProps {
  options: readonly SegmentedOption[];
  active: string | null;
  onSelect: (value: string) => void;
  groupLabel: string;
  grow: boolean;
}

function Segmented({
  options,
  active,
  onSelect,
  groupLabel,
  grow,
}: SegmentedProps) {
  return (
    <Box
      gap={1}
      role="group"
      aria-label={groupLabel}
      // Stretching is only worth it on a phone. Left on up to the 768px
      // desktop switch it produced 165px chips around a 40px word.
      flex={grow ? { base: '1 1 auto', sm: '0 0 auto' } : '0 0 auto'}
      display={grow ? { base: 'grid', sm: 'inline-flex' } : 'inline-flex'}
      gridTemplateColumns={
        grow
          ? { base: `repeat(${options.length}, minmax(2.5rem, auto))`, sm: 'none' }
          : 'none'
      }
    >
      {options.map((o) => {
        const isActive = active === o.value;
        return (
          <Tooltip key={o.value} content={o.tip}>
            <Button
              size="sm"
              variant={isActive ? 'solid' : 'plain'}
              colorPalette={isActive ? 'blue' : 'gray'}
              onClick={() => onSelect(o.value)}
              aria-pressed={isActive}
              aria-label={o.ariaLabel}
              // Height, not minH: the sm recipe pins h to 36px, which wins over
              // any smaller floor. Phones keep the 40px touch target.
              h={{ base: '40px', md: '24px' }}
              px={3}
              borderRadius="sm"
              fontSize="12px"
              fontWeight="500"
              // plain defines no hover of its own, so an unselected chip would
              // have no affordance at all.
              _hover={{ bg: isActive ? 'colorPalette.solid/90' : 'bg.subtle' }}
            >
              {o.label}
            </Button>
          </Tooltip>
        );
      })}
    </Box>
  );
}

/** The parameters bar's third group: one roll mode for every totals row. */
export function RollModeControl() {
  const { expressions, setAllRollModes } = useApp();
  const { activeMode, mixed } = rollModeSummary(expressions);

  const onSelect = useCallback(
    (value: string) => {
      if (isRollMode(value)) setAllRollModes(value);
    },
    [setAllRollModes],
  );

  if (expressions.length === 0) return null;

  return (
    <HStack gap={2} align="center" flexWrap="wrap">
      {/* Sentence case at the same size the parameter pills name themselves
          with. An uppercase eyebrow here would be the only one left on the
          bar. */}
      <Text as="span" fontSize="xs" color="fg.muted" whiteSpace="nowrap">
        <HelpTerm tip={tipForId('globalRollMode')}>Roll mode</HelpTerm>
        {mixed ? ' (mixed)' : ''}
      </Text>
      <Segmented
        options={ROLL_MODES}
        active={activeMode}
        onSelect={onSelect}
        groupLabel="Global roll mode"
        grow={false}
      />
    </HStack>
  );
}
