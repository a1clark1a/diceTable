import { Button, HStack } from '@chakra-ui/react';
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
    <HStack
      gap={1}
      p={1}
      bg="bg.subtle"
      borderRadius="lg"
      display="inline-flex"
      alignSelf="flex-start"
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
            variant={isActive ? 'subtle' : 'ghost'}
            colorPalette={isActive ? 'blue' : 'gray'}
            onClick={() => onSelect(v.id)}
            aria-pressed={isActive}
            minH="40px"
          >
            {label}
          </Button>
        );
      })}
    </HStack>
  );
}
