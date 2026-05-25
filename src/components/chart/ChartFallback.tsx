import { Box, Skeleton } from '@chakra-ui/react';

interface ChartFallbackProps {
  variant: 'overlay' | 'inspect';
}

const HEIGHTS: Record<ChartFallbackProps['variant'], { base: string; md: string }> = {
  overlay: { base: '260px', md: '320px' },
  inspect: { base: '280px', md: '360px' },
};

export function ChartFallback({ variant }: ChartFallbackProps) {
  return (
    <Box
      w="100%"
      h={HEIGHTS[variant]}
      role="status"
      aria-live="polite"
      aria-label="Loading chart"
    >
      <Skeleton height="100%" width="100%" borderRadius="md" />
    </Box>
  );
}
