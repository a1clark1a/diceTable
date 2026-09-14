import { useCallback, useMemo, useRef, useState } from 'react';
import { Box, HStack, Table, Text } from '@chakra-ui/react';
import { useApp } from '../../state/useApp';
import { MATRIX_ROW_CAP } from '../../types';
import { beatMatrix, type BeatChance } from '../../engine/compare';
import { EM_DASH, formatPercent } from '../chart/format';
import { hitColor } from '../chart/palette';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import {
  MIXED_SCALE_NOTE,
  hasMixedScales,
  toCompareRows,
} from './compareRows';

const TABULAR_NUMS = { fontVariantNumeric: 'tabular-nums' } as const;

interface CellTip {
  sentence: string;
  /** Centre-top of the cell, in the wrapper's coordinates. */
  x: number;
  y: number;
}

/** Widest the sentence box gets before it wraps. */
const TIP_MAX_W = 240;
/** Clearance from the panel edge, so the box never sits flush against it. */
const TIP_EDGE = 8;

export function HeadToHeadView() {
  const wrapRef = useRef<HTMLDivElement>(null);
  // The cell the sentence belongs to, so a scroll can move the box with it
  // rather than having to take it away.
  const anchorRef = useRef<HTMLElement | null>(null);
  const [tip, setTip] = useState<CellTip | null>(null);

  // One shared tooltip rather than one component per cell. A Chakra tooltip is
  // a state machine, a floating-ui subscription and an id apiece, and the grid
  // has row-count squared of them: at twenty-four rolls that was 552 of them
  // and 199ms of the 318ms this view took to appear, measured in a production
  // build. The sentence is on every cell as an accessible name either way, so
  // a screen reader reads it whether or not anything is hovered.
  const place = useCallback((el: HTMLElement, sentence: string) => {
    const wrap = wrapRef.current;
    if (wrap === null) return;
    const cell = el.getBoundingClientRect();
    const box = wrap.getBoundingClientRect();
    // Centred on the cell, then pulled back inside the panel. A cell in the
    // first column would otherwise hang the box off the left edge, which on a
    // phone is most of the sentence. Half the widest the box can get is the
    // bound, so the clamp does not need the rendered width to be measured.
    const half = Math.min(TIP_MAX_W, box.width - TIP_EDGE * 2) / 2;
    const centre = cell.left - box.left + cell.width / 2;
    setTip({
      sentence,
      x: Math.min(
        Math.max(centre, half + TIP_EDGE),
        box.width - half - TIP_EDGE,
      ),
      y: cell.top - box.top,
    });
  }, []);

  const show = useCallback(
    (sentence: string) => (e: { currentTarget: HTMLElement }) => {
      anchorRef.current = e.currentTarget;
      place(e.currentTarget, sentence);
    },
    [place],
  );

  const hide = useCallback(() => {
    anchorRef.current = null;
    setTip(null);
  }, []);

  // Tabbing to a cell that is off to the right scrolls it into view, so a
  // scroll handler that dismissed would take the sentence away the instant
  // focus asked for it. Following the cell keeps both paths working.
  const follow = useCallback(() => {
    const el = anchorRef.current;
    if (el === null) return;
    place(el, el.getAttribute('aria-label') ?? '');
  }, [place]);

  const { expressions } = useApp();

  const rows = useMemo(() => toCompareRows(expressions), [expressions]);
  // Cut before the matrix, not after. Every cell is a pairwise comparison and
  // every drawn cell is a tooltip and a tab stop, so capping only the render
  // would still score a hundred rolls into 9,900 pairs to throw most away.
  // Cut after toCompareRows so these are computable rolls rather than slots,
  // some of which had nothing to compare.
  const shown = useMemo(() => rows.slice(0, MATRIX_ROW_CAP), [rows]);
  const matrix = useMemo<(BeatChance | null)[][]>(
    () => beatMatrix(shown.map((r) => r.dist)),
    [shown],
  );

  const enough = shown.length >= 2;

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      p={{ base: 3, md: 4 }}
      // This panel is as wide as its content, which on a wide screen leaves it
      // stranded against the left edge. Auto margins beat the column's
      // flex-start, so it centres when there is room and fills when there is not.
      mx="auto"
      maxW="100%"
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
      {rows.length > shown.length && (
        <Text fontSize="xs" color="fg.muted" mt={1}>
          Showing the first {MATRIX_ROW_CAP} of {rows.length} rolls. Roll-off
          ranks every roll at once.
        </Text>
      )}
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
          <Box position="relative" ref={wrapRef}>
          {tip !== null && (
            <Box
              position="absolute"
              left={`${tip.x}px`}
              top={`${tip.y}px`}
              transform="translate(-50%, calc(-100% - 6px))"
              // The pointer must reach the cell underneath, or moving onto the
              // tooltip would dismiss the tooltip.
              pointerEvents="none"
              zIndex={3}
              maxW={`min(${TIP_MAX_W}px, 100% - ${TIP_EDGE * 2}px)`}
              w="max-content"
              bg="bg.inverted"
              color="fg.inverted"
              borderRadius="sm"
              px="8px"
              py="4px"
              fontSize="xs"
              lineHeight="1.4"
              fontFamily="body"
              boxShadow="md"
            >
              {tip.sentence}
            </Box>
          )}
          <Table.ScrollArea mt={2} onScroll={follow}>
            <Table.Root size="sm" variant="line" minW="420px">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader w={{ base: '90px', md: '150px' }} />
                  {shown.map((o) => (
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
                {shown.map((r, i) => (
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
                    {shown.map((o, j) => {
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
                            <Text
                              as="span"
                              fontSize="xs"
                              color={hitColor(cell.win)}
                              fontWeight={cell.win >= 0.5 ? 'semibold' : undefined}
                              tabIndex={0}
                              aria-label={sentence}
                              onMouseEnter={show(sentence)}
                              onMouseLeave={hide}
                              onFocus={show(sentence)}
                              onBlur={hide}
                              _focusVisible={{
                                outline: '2px solid',
                                outlineColor: 'blue.solid',
                                outlineOffset: '2px',
                                borderRadius: 'sm',
                              }}
                            >
                              {formatPercent(cell.win)}
                            </Text>
                        </Table.Cell>
                      );
                    })}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
          </Box>
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
