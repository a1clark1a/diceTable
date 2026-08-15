import { useMemo } from 'react';
import { Box, HStack, Table, Text } from '@chakra-ui/react';
import { useApp } from '../../state/useApp';
import { beatChance, type BeatChance } from '../../engine/compare';
import { EM_DASH, formatPercent } from '../chart/format';
import { hitColor } from '../chart/palette';
import { HelpTerm } from '../ui/help-term';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';
import {
  MIXED_SCALE_NOTE,
  hasMixedScales,
  toCompareRows,
} from './compareRows';

const TABULAR_NUMS = { fontVariantNumeric: 'tabular-nums' } as const;

export function HeadToHeadView() {
  const { expressions } = useApp();

  const rows = useMemo(() => toCompareRows(expressions), [expressions]);
  const matrix = useMemo<(BeatChance | null)[][]>(
    () =>
      rows.map((r, i) =>
        rows.map((o, j) => (i === j ? null : beatChance(r.dist, o.dist))),
      ),
    [rows],
  );

  const enough = rows.length >= 2;

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      p={{ base: 3, md: 4 }}
    >
      <HelpTerm tip={tipForId('head-to-head')}>
        <Text
          as="span"
          fontSize="2xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
        >
          Head-to-head. Row beats column
        </Text>
      </HelpTerm>
      {!enough ? (
        <Text fontSize="sm" color="fg.muted" mt={2}>
          Add at least two rolls with valid dice to compare head-to-head.
        </Text>
      ) : (
        <>
          <Text
            fontSize="2xs"
            color="fg.muted"
            mt={1}
            display={{ base: 'block', md: 'none' }}
          >
            Scroll sideways for more columns. Tap a cell for the full sentence.
          </Text>
          <Table.ScrollArea mt={2}>
            <Table.Root size="sm" variant="line" minW="420px">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader w={{ base: '90px', md: '150px' }} />
                  {rows.map((o) => (
                    <Table.ColumnHeader key={o.expr.id} textAlign="center">
                      <HStack gap={1} justify="center">
                        <Box
                          w="8px"
                          h="8px"
                          borderRadius="2px"
                          bg={o.color}
                          flexShrink={0}
                        />
                        <Text
                          as="span"
                          fontSize="xs"
                          fontWeight="normal"
                          color="fg.muted"
                          truncate
                        >
                          {o.expr.name}
                        </Text>
                      </HStack>
                    </Table.ColumnHeader>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((r, i) => (
                  <Table.Row key={r.expr.id}>
                    <Table.Cell py={1.5}>
                      <HStack gap={1}>
                        <Box
                          w="8px"
                          h="8px"
                          borderRadius="2px"
                          bg={r.color}
                          flexShrink={0}
                        />
                        <Text as="span" fontSize="xs" truncate>
                          {r.expr.name}
                        </Text>
                      </HStack>
                    </Table.Cell>
                    {rows.map((o, j) => {
                      const cell = matrix[i]?.[j];
                      if (!cell) {
                        return (
                          <Table.Cell
                            key={o.expr.id}
                            py={1.5}
                            textAlign="center"
                            fontFamily="mono"
                            color="fg.muted"
                          >
                            {EM_DASH}
                          </Table.Cell>
                        );
                      }
                      const sentence = `${r.expr.name} beats ${o.expr.name} ${formatPercent(cell.win)} of the time; they tie ${formatPercent(cell.tie)}.`;
                      return (
                        <Table.Cell
                          key={o.expr.id}
                          py={1.5}
                          textAlign="center"
                          fontFamily="mono"
                          style={TABULAR_NUMS}
                        >
                          <Tooltip content={sentence}>
                            <Text
                              as="span"
                              fontSize="xs"
                              color={hitColor(cell.win)}
                              fontWeight={cell.win >= 0.5 ? 'semibold' : undefined}
                              tabIndex={0}
                            >
                              {formatPercent(cell.win)}
                            </Text>
                          </Tooltip>
                        </Table.Cell>
                      );
                    })}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
          {hasMixedScales(rows) && (
            <Text fontSize="xs" color="fg.muted" mt={3}>
              {MIXED_SCALE_NOTE}
            </Text>
          )}
        </>
      )}
    </Box>
  );
}
