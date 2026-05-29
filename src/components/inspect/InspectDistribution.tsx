import {
  Box,
  Popover,
  Portal,
  Stack,
  Text,
  chakra,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';
import type { Distribution } from '../../types';
import { DistributionTable } from './DistributionTable';
import { tipForId } from '../../docs/glossary';

interface InspectDistributionProps {
  exprName: string;
  dist: Distribution;
  mean: number;
  modes: number[];
  hasDist: boolean;
  children: ReactNode;
}

export function InspectDistribution({
  exprName,
  dist,
  mean,
  modes,
  hasDist,
  children,
}: InspectDistributionProps) {
  if (!hasDist) {
    return <>{children}</>;
  }

  return (
    <Popover.Root positioning={{ placement: 'top-start' }} lazyMount unmountOnExit>
      <Popover.Trigger asChild>
        <chakra.button
          type="button"
          cursor="pointer"
          display="inline-flex"
          alignItems="baseline"
          gap={1}
          bg="transparent"
          color="inherit"
          fontFamily="inherit"
          fontSize="inherit"
          fontWeight="inherit"
          px={0}
          py={0}
          borderBottomWidth="1px"
          borderBottomStyle="dotted"
          borderBottomColor="fg.muted"
          _hover={{ borderBottomColor: 'colorPalette.solid' }}
          _focusVisible={{
            outline: '2px solid',
            outlineColor: 'colorPalette.solid',
            outlineOffset: '2px',
            borderRadius: 'sm',
          }}
          aria-label={`Inspect distribution for ${exprName}`}
          title={tipForId('inspectDistribution')}
        >
          {children}
        </chakra.button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            maxW="320px"
            w={{ base: 'calc(100vw - 32px)', sm: '320px' }}
          >
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body p={3}>
              <Stack gap={2}>
                <Box>
                  <Text
                    fontSize="2xs"
                    textTransform="uppercase"
                    color="fg.muted"
                    fontWeight="semibold"
                    letterSpacing="wider"
                  >
                    Distribution
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {dist.size} possible {dist.size === 1 ? 'result' : 'results'}
                  </Text>
                </Box>
                <DistributionTable
                  dist={dist}
                  mean={mean}
                  modes={modes}
                  maxHeight="320px"
                />
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
