import { lazy, Suspense, type ReactNode } from 'react';
import {
  Box,
  CloseButton,
  Dialog,
  HStack,
  Portal,
  chakra,
} from '@chakra-ui/react';
import type { Distribution } from '../../types';
import { ChartFallback } from '../chart/ChartFallback';

const InspectChartBody = lazy(() => import('./InspectChartBody'));

interface InspectChartProps {
  exprName: string;
  dist: Distribution;
  color: string;
  children: ReactNode;
}

export function InspectChart({
  exprName,
  dist,
  color,
  children,
}: InspectChartProps) {
  return (
    <Dialog.Root
      lazyMount
      unmountOnExit
      placement="center"
      size={{ mdDown: 'full', md: 'lg' }}
    >
      <Dialog.Trigger asChild>
        <chakra.button
          type="button"
          cursor="pointer"
          bg="transparent"
          borderWidth="0"
          p={0}
          m={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          width="100%"
          aria-label={`Inspect chart for ${exprName}`}
          borderRadius="sm"
          _focusVisible={{
            outline: '2px solid',
            outlineColor: 'colorPalette.solid',
            outlineOffset: '2px',
          }}
        >
          {children}
        </chakra.button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <HStack gap={3} align="center">
                <Box
                  w="10px"
                  h="10px"
                  borderRadius="2px"
                  bg={color}
                  flexShrink={0}
                />
                <Dialog.Title>{exprName}</Dialog.Title>
              </HStack>
            </Dialog.Header>
            <Dialog.Body>
              <Suspense fallback={<ChartFallback variant="inspect" />}>
                <InspectChartBody dist={dist} color={color} />
              </Suspense>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
