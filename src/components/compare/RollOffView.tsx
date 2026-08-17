import { useMemo, useState } from 'react';
import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { useApp } from '../../state/useApp';
import { winChances } from '../../engine/compare';
import { formatPercent } from '../chart/format';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import { ExpressionDiceText } from '../editor/ExpressionRender';
import { useIsDesktop } from '../../hooks/useBreakpoint';
import {
  MIXED_SCALE_NOTE,
  hasMixedScales,
  toCompareRows,
  type CompareRow,
} from './compareRows';

type SortOrder = 'win' | 'table';

const SORT_ORDERS: { value: SortOrder; label: string }[] = [
  { value: 'win', label: 'Win chance' },
  { value: 'table', label: 'Table order' },
];

const TABULAR_NUMS = { fontVariantNumeric: 'tabular-nums' } as const;

interface ScoredRow {
  row: CompareRow;
  win: number;
  tie: number;
}

export function RollOffView() {
  const { expressions } = useApp();
  const isDesktop = useIsDesktop();
  const [sortOrder, setSortOrder] = useState<SortOrder>('win');

  const rows = useMemo(() => toCompareRows(expressions), [expressions]);
  const scored = useMemo<ScoredRow[]>(() => {
    const chances = winChances(rows.map((r) => r.dist));
    return rows.map((row, i) => ({
      row,
      win: chances[i]?.win ?? 0,
      tie: chances[i]?.tie ?? 0,
    }));
  }, [rows]);
  const byWin = useMemo(
    () => [...scored].sort((a, b) => b.win - a.win),
    [scored],
  );

  const enough = rows.length >= 2;
  const shown = sortOrder === 'win' ? byWin : scored;
  const top = byWin[0];
  const second = byWin[1];
  const maxWin = Math.max(top?.win ?? 0, 1e-9);
  const anyTies = scored.some((s) => s.tie >= 0.005);

  // The gap between the top two decides the phrasing; below one percentage
  // point the race reads as even.
  const headline =
    top && second
      ? top.win - second.win < 0.01
        ? `It’s nearly a coin flip between ${top.row.expr.name} and ${second.row.expr.name}.`
        : `${top.row.expr.name} is most likely to come out on top.`
      : '';

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      p={{ base: 3, md: 4 }}
    >
      <Flex align="center" justify="space-between" gap={3} wrap="wrap">
        <HelpTerm tip={tipForId('roll-off')}>
          <Text
            as="span"
            fontSize="2xs"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Chance to win the roll-off
          </Text>
        </HelpTerm>
        {enough && (
          <HStack
            gap={1}
            p={1}
            bg="bg.subtle"
            borderRadius="md"
            display="inline-flex"
            role="group"
            aria-label="Sort rolls"
          >
            {SORT_ORDERS.map((s) => {
              const isActive = sortOrder === s.value;
              return (
                <Button
                  key={s.value}
                  size="sm"
                  variant={isActive ? 'solid' : 'ghost'}
                  colorPalette={isActive ? 'blue' : 'gray'}
                  onClick={() => setSortOrder(s.value)}
                  aria-pressed={isActive}
                  minH="40px"
                >
                  {s.label}
                </Button>
              );
            })}
          </HStack>
        )}
      </Flex>
      {!enough ? (
        <Text fontSize="sm" color="fg.muted" mt={2}>
          Add at least two rolls with valid dice to start the roll-off.
        </Text>
      ) : (
        <>
          <Text fontSize="sm" mt={2}>
            {headline}
          </Text>
          <Stack gap={3} mt={{ base: 3, md: 4 }}>
            {shown.map(({ row, win, tie }) => {
              const isWinner = row.expr.id === top?.row.expr.id;
              // Tiny-but-real chances keep a visible sliver; an exact zero
              // shows an empty track so it never suggests a chance that
              // does not exist.
              const barWidth =
                win > 0 ? `${Math.max(1, (win / maxWin) * 100)}%` : '0';
              const tieText = tie >= 0.005 ? `ties ${formatPercent(tie)}` : '';
              return isDesktop ? (
                <HStack key={row.expr.id} gap={3} align="center">
                  <Box
                    w="10px"
                    h="10px"
                    borderRadius="2px"
                    bg={row.color}
                    flexShrink={0}
                  />
                  <Box w="180px" flexShrink={0} minW={0}>
                    <Text
                      fontSize="sm"
                      fontWeight={isWinner ? 'semibold' : undefined}
                      truncate
                    >
                      {row.expr.name}
                    </Text>
                    <Text fontFamily="mono" fontSize="xs" color="fg.muted">
                      <ExpressionDiceText expr={row.expr} />
                    </Text>
                  </Box>
                  <Box
                    flex="1"
                    position="relative"
                    h="18px"
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
                      w={barWidth}
                      bg={row.color}
                    />
                  </Box>
                  <Box
                    w="110px"
                    flexShrink={0}
                    textAlign="end"
                    fontFamily="mono"
                    style={TABULAR_NUMS}
                  >
                    <Text fontSize="md" fontWeight="semibold">
                      {formatPercent(win)}
                    </Text>
                    {tieText && (
                      <Text fontSize="2xs" color="fg.muted">
                        {tieText}
                      </Text>
                    )}
                  </Box>
                </HStack>
              ) : (
                <Stack key={row.expr.id} gap={1}>
                  <HStack gap={2} align="center">
                    <Box
                      w="8px"
                      h="8px"
                      borderRadius="2px"
                      bg={row.color}
                      flexShrink={0}
                    />
                    <Text
                      fontSize="xs"
                      fontWeight={isWinner ? 'semibold' : undefined}
                      minW={0}
                      // A runaway name truncates instead of starving the dice
                      // notation or pushing the win percent off the row.
                      maxW="60%"
                      truncate
                    >
                      {row.expr.name}
                    </Text>
                    <Text
                      fontFamily="mono"
                      fontSize="2xs"
                      color="fg.muted"
                      flex="1"
                      minW={0}
                      truncate
                    >
                      <ExpressionDiceText expr={row.expr} />
                    </Text>
                    <Text
                      fontFamily="mono"
                      fontSize="sm"
                      fontWeight="semibold"
                      flexShrink={0}
                      style={TABULAR_NUMS}
                    >
                      {formatPercent(win)}
                    </Text>
                  </HStack>
                  <HStack gap={2} align="center">
                    <Box
                      flex="1"
                      position="relative"
                      h="12px"
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
                        w={barWidth}
                        bg={row.color}
                      />
                    </Box>
                    {tieText && (
                      <Text
                        fontSize="2xs"
                        color="fg.muted"
                        fontFamily="mono"
                        flexShrink={0}
                        style={TABULAR_NUMS}
                      >
                        {tieText}
                      </Text>
                    )}
                  </HStack>
                </Stack>
              );
            })}
          </Stack>
          {anyTies && (
            <Text fontSize="xs" color="fg.muted" mt={3}>
              Ties happen when two or more rolls land the same top number.
              Nobody wins those outright.
            </Text>
          )}
          {hasMixedScales(rows) && (
            <Text fontSize="xs" color="fg.muted" mt={anyTies ? 1 : 3}>
              {MIXED_SCALE_NOTE}
            </Text>
          )}
        </>
      )}
    </Box>
  );
}
