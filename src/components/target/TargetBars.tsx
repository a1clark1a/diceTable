import { useMemo } from 'react';
import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import { RulingSymbol } from '../targetRuling';
import { formatPercent } from '../chart/format';
import { hitColor } from '../chart/palette';
import type { TargetState } from '../../types';
import {
  rowHitChance,
  rowShowsUnderTarget,
  type TargetRow,
} from './targetHitRows';

interface TargetBarsProps {
  rows: TargetRow[];
  target: TargetState;
  poolTarget: number;
}

export function TargetBars({ rows, target, poolTarget }: TargetBarsProps) {
  const sections = useMemo(
    () =>
      target.values.map((tv, index) => {
        const bars = rows
          .filter((row) => rowShowsUnderTarget(row, index))
          .map((row) => ({
            row,
            p: rowHitChance(row, tv, target.ruling, poolTarget),
          }));
        bars.sort((a, b) => b.p - a.p);
        return { tv, hasPools: bars.some((b) => b.row.isPool), bars };
      }),
    [rows, target, poolTarget],
  );

  return (
    <Stack gap={3}>
      {sections.map(({ tv, hasPools, bars }) => (
        <Box
          key={tv}
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="md"
          p={4}
        >
          <HStack gap={1}>
            <HelpTerm tip={tipForId('targetBars')}>
              <Text
                as="span"
                fontSize="2xs"
                fontWeight="semibold"
                color="fg.muted"
                textTransform="uppercase"
                letterSpacing="wider"
              >
                Target {tv}
                {hasPools ? ` (pools: ≥${poolTarget} successes)` : ''}
              </Text>
            </HelpTerm>
            <RulingSymbol ruling={target.ruling} color="fg.muted" />
          </HStack>
          <Stack gap={2.5} mt={3}>
            {bars.map(({ row, p }) => (
              <HStack key={row.id} gap={3} align="center">
                <Box
                  w="10px"
                  h="10px"
                  borderRadius="2px"
                  bg={row.color}
                  flexShrink={0}
                />
                <Box w={{ base: '96px', md: '180px' }} flexShrink={0}>
                  <Text fontSize="sm" truncate>
                    {row.name}
                  </Text>
                </Box>
                <Box
                  flex="1"
                  position="relative"
                  h="14px"
                  bg="bg.muted"
                  borderRadius="full"
                  overflow="hidden"
                >
                  <Box
                    position="absolute"
                    top="0"
                    bottom="0"
                    left="0"
                    borderRadius="full"
                    width={`${Math.max(0.5, p * 100)}%`}
                    bg={hitColor(p)}
                  />
                </Box>
                <Box w="56px" flexShrink={0} textAlign="end">
                  <Text
                    as="span"
                    fontFamily="mono"
                    fontSize="sm"
                    fontWeight="semibold"
                    color={hitColor(p)}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatPercent(p)}
                  </Text>
                </Box>
              </HStack>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
