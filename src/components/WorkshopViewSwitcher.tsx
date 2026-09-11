import { Box, Button } from '@chakra-ui/react';
import type { WorkshopView } from '../types';
import { useIsDesktop } from '../hooks/useBreakpoint';

export interface WorkshopViewChip {
  id: WorkshopView;
  label: string;
  mobileLabel?: string;
}

interface WorkshopViewSwitcherProps {
  views: readonly WorkshopViewChip[];
  active: WorkshopView;
  onSelect: (view: WorkshopView) => void;
}

export function WorkshopViewSwitcher({
  views,
  active,
  onSelect,
}: WorkshopViewSwitcherProps) {
  const isDesktop = useIsDesktop();
  return (
    <Box
      // Four tabs outgrow a 360px viewport. A fixed column per tab keeps the
      // bar one row high at every width, where wrapping made the header jump
      // between one and two rows as labels changed.
      display={{ base: 'grid', sm: 'inline-flex' }}
      gridTemplateColumns={{
        base: `repeat(${views.length}, minmax(0, 1fr))`,
        sm: 'none',
      }}
      alignSelf={{ base: 'stretch', sm: 'flex-start' }}
      borderBottomWidth="1px"
      borderColor="border.subtle"
      role="group"
      aria-label="Workshop view"
    >
      {views.map((v) => {
        const isActive = v.id === active;
        const label = isDesktop ? v.label : v.mobileLabel ?? v.label;
        return (
          <Button
            key={v.id}
            size="sm"
            variant="plain"
            onClick={() => onSelect(v.id)}
            aria-pressed={isActive}
            minH="44px"
            minW={0}
            px={{ base: 2, md: 3 }}
            borderRadius="0"
            fontSize={{ base: '14px', md: '13px' }}
            fontWeight="500"
            color={isActive ? 'fg' : 'fg.muted'}
            borderBottomWidth="2px"
            borderBottomColor={isActive ? 'blue.solid' : 'transparent'}
            // The bar's own 1px rule and this 2px one would otherwise stack
            // and read as a double edge.
            mb="-1px"
            _hover={{ color: 'fg' }}
          >
            {label}
          </Button>
        );
      })}
    </Box>
  );
}
