import {
  Box,
  Grid,
  Popover,
  Portal,
  Stack,
  Text,
  chakra,
  type HTMLChakraProps,
} from '@chakra-ui/react';
import { Info } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { tipForId } from '../../docs/glossary';
import { chipFocusRing } from '../editor/focusRings';
import { deltaToneColor } from './deltaText';
import type { RowCompare } from './rowCompare';

const PANEL_WIDTH = { base: 'calc(100vw - 32px)', sm: '300px' } as const;

// The delta pair fills its 124px cell exactly, so the hit area has to come from
// outside the flow: padding would push the dotted rule off the numbers it
// belongs to, and the cell has no room to grow.
const INLINE_HIT_AREA = {
  content: '""',
  position: 'absolute',
  insetInline: 0,
  top: '-5px',
  bottom: '-5px',
} as const;

const MARK_HIT_AREA = {
  content: '""',
  position: 'absolute',
  inset: '-8px',
} as const;

type CompareVariant = 'inline' | 'mark' | 'surface';

interface ComparePopoverProps {
  compare: RowCompare;
  /**
   * 'inline' wraps the table's delta pair, 'mark' is the cross-scale icon, and
   * 'surface' takes over a card pill's own box.
   */
  variant: CompareVariant;
  triggerProps?: HTMLChakraProps<'button'>;
  children?: ReactNode;
}

function CompareGrid({ rows, baselineName }: Pick<RowCompare, 'rows' | 'baselineName'>) {
  return (
    <Grid
      templateColumns="1fr auto auto auto"
      columnGap={3}
      rowGap={1}
      fontSize="xs"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      <Box />
      <Text color="fg.muted" textAlign="end">
        This roll
      </Text>
      <Text color="fg.muted" textAlign="end" truncate maxW="90px">
        {baselineName}
      </Text>
      <Text color="fg.muted" textAlign="end">
        Diff
      </Text>
      {rows.map((row) => (
        <Fragment key={row.label}>
          <Text color="fg.muted">{row.label}</Text>
          <Text fontFamily="mono" textAlign="end">
            {row.value}
          </Text>
          <Text fontFamily="mono" textAlign="end" color="fg.muted">
            {row.base}
          </Text>
          <Text
            fontFamily="mono"
            textAlign="end"
            color={row.neutral === true ? 'fg.muted' : deltaToneColor(row.tone)}
          >
            {row.delta}
          </Text>
        </Fragment>
      ))}
    </Grid>
  );
}

/**
 * The verdict used to be a native title attribute, which no keyboard or screen
 * reader reaches, and it was dropped for cross-scale rows entirely. It cannot
 * be a tooltip either: Zag's tooltip returns early on a touch pointer, so the
 * card layout could never open one. A popover opens on click, which mouse,
 * touch and keyboard all produce, so one mechanism serves both layouts.
 *
 * Nothing here adds to the flow. The trigger wraps content that was already
 * rendered, the panel is portalled, and the hit area is an ::after box.
 */
export function ComparePopover({
  compare,
  variant,
  triggerProps,
  children,
}: ComparePopoverProps) {
  const shared = {
    type: 'button',
    cursor: 'pointer',
    bg: 'transparent',
    color: 'inherit',
    position: 'relative',
    title: tipForId('rowCompare'),
    'aria-label': `Compare with ${compare.baselineName}: ${compare.speech}`,
  } as const;

  const byVariant = {
    inline: {
      display: 'block',
      w: '100%',
      borderBottomWidth: '1px',
      borderBottomStyle: 'dotted',
      borderBottomColor: 'fg.muted',
      _hover: { borderBottomColor: 'colorPalette.solid' },
      _focusVisible: chipFocusRing,
      _after: INLINE_HIT_AREA,
    },
    mark: {
      display: 'inline-flex',
      alignItems: 'center',
      lineHeight: 0,
      color: 'fg.muted',
      borderRadius: 'sm',
      _focusVisible: chipFocusRing,
      _after: MARK_HIT_AREA,
    },
    // An explicit flex column rather than the default button box, so no
    // engine's content centring can move the label and value when the grid row
    // stretches. The outline is the only resting cue that the pill opens
    // something, and border.subtle on bg.subtle measures 1.08:1 in light and
    // 1.20:1 in dark, which is no cue at all. An outline paints outside the
    // border box, so raising it cannot shrink the label row.
    surface: {
      display: 'flex',
      flexDirection: 'column',
      w: '100%',
      outlineWidth: '1px',
      outlineStyle: 'solid',
      outlineColor: 'border.emphasized',
      _hover: { bg: 'bg.muted', outlineColor: 'colorPalette.solid' },
      _focusVisible: chipFocusRing,
    },
  } as const;

  return (
    <Popover.Root positioning={{ placement: 'top-end' }} lazyMount unmountOnExit>
      <Popover.Trigger asChild>
        <chakra.button {...shared} {...byVariant[variant]} {...triggerProps}>
          {variant === 'mark' ? <Info size={12} /> : children}
        </chakra.button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content maxW="300px" w={PANEL_WIDTH}>
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body p={3}>
              <Stack gap={2}>
                <Popover.Title
                  fontSize="2xs"
                  fontWeight="semibold"
                  color="fg.muted"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  Compared to {compare.baselineName}
                </Popover.Title>
                <Popover.Description
                  fontSize="sm"
                  color="fg"
                  css={{ textWrap: 'pretty' }}
                >
                  {compare.verdict}
                </Popover.Description>
                {compare.crossScale && (
                  <Text
                    fontSize="xs"
                    color="fg.muted"
                    css={{ textWrap: 'pretty' }}
                  >
                    {tipForId(compare.crossScaleTip)}
                  </Text>
                )}
                {compare.rows.length > 0 && (
                  <CompareGrid
                    rows={compare.rows}
                    baselineName={compare.baselineName}
                  />
                )}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
