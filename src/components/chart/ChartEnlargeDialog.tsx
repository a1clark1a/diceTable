import {
  Button,
  CloseButton,
  Dialog,
  HStack,
  IconButton,
  Portal,
  Stack,
} from '@chakra-ui/react';
import { ExternalLink } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { Distribution } from '../../types';
import { Tooltip } from '../ui/tooltip';
import { chipFocusRing } from '../editor/focusRings';
import { ChartPanel } from './ChartPanel';
import { useSeriesFocus } from './useSeriesFocus';
import { enlargedRowCap, pagePanels, type ChartPages } from './rowCap';
import { CHART_ROW_CAP_RAIL } from '../../types';
import { tipForId } from '../../docs/glossary';
import { panelDrawPoints } from './drawCost';
import { useFinePointer, useWideChart } from '../../hooks/useBreakpoint';
import type { ChartPanelData } from './useChartPanels';
import type { ChartUnit } from './OverlayChartImpl';

type Shown = ChartPanelData['key'] | 'both';

function unitFor(panel: ChartPanelData): ChartUnit {
  return panel.key === 'successes' ? 'successes' : 'totals';
}

interface ChartEnlargeDialogProps {
  /** The card this button belongs to, and what the dialog opens on. */
  panel: ChartPanelData;
  /** Every panel on screen, so the dialog can show the other one too. */
  panels: ChartPanelData[];
  dists: Map<string, Distribution>;
  slots: Map<string, number>;
}

/**
 * The rail is a glance; this is the same panel with room to read it. It renders
 * ChartPanel rather than a second chart surface, so the legend, the hover and
 * the view control come with it instead of having to be rebuilt here and then
 * kept in step.
 *
 * A mixed table splits into two panels too tall to read side by side on the
 * rail, which is the case this dialog exists for: it opens on the card you
 * clicked and lets you put both on screen without closing and reopening.
 */
export function ChartEnlargeDialog({
  panel,
  panels,
  dists,
  slots,
}: ChartEnlargeDialogProps) {
  const [open, setOpen] = useState(false);
  // Hover is local to the enlarged copy: the row it would highlight is behind
  // the dialog anyway.
  const focus = useSeriesFocus();
  // This component is the trigger, so it stays mounted while unmountOnExit
  // discards the dialog: the pick has to be put back on open or the button
  // reopens on whatever was chosen last time.
  const [shown, setShown] = useState<Shown>(panel.key);

  // A cover dialog on a 360px phone is a 360px canvas, narrower than the
  // desktop rail, so the budget follows the canvas rather than the frame.
  const wideCanvas = useWideChart();
  const finePointer = useFinePointer();
  // The enlarged copy pages on its own: opening it should not move the rail,
  // and closing it should not leave the rail somewhere the user did not put it.
  const [pages, setPages] = useState<ChartPages>({});
  const onPage = useCallback((key: ChartPanelData['key'], page: number) => {
    setPages((prev) => ({ ...prev, [key]: Math.max(0, page) }));
  }, []);
  // Which panels are on screen has to be settled before the budget, because
  // the budget depends on there being exactly one of them. The empty-set
  // fallback is the same one `visible` applies below, and it has to be: the
  // two disagreeing would size the page against a panel nobody is looking at.
  const showing = panels.filter((p) => shown === 'both' || p.key === shown);
  const onScreen = showing.length > 0 ? showing : panels;
  const solo = onScreen.length === 1 ? onScreen[0] : undefined;
  const drawPoints = useMemo(
    () => (solo === undefined ? 0 : panelDrawPoints(solo.expressions)),
    [solo],
  );
  // Whether the field is on offer at all, before asking whether it is wanted.
  const fieldCap = enlargedRowCap({
    wideCanvas,
    finePointer,
    solo,
    drawPoints,
  });
  // Offered only where the choice changes something: a table that fits one page
  // has nothing to page through, and a surface already paging has no field to
  // leave.
  const canField =
    fieldCap > CHART_ROW_CAP_RAIL &&
    (solo?.entries.length ?? 0) > CHART_ROW_CAP_RAIL;
  // Transient, like the page itself. The field stays the default because it is
  // the reason this surface has its own budget at all, but reading twenty rolls
  // in their own pens is a different and equally real way to use the same
  // table, so it is a choice rather than a consequence of the viewport.
  const [paged, setPaged] = useState(false);
  const usePage = paged && canField;
  const pageSize = usePage ? CHART_ROW_CAP_RAIL : fieldCap;
  const budgeted = useMemo(
    () => pagePanels(panels, pageSize, pages),
    [panels, pageSize, pages],
  );

  const canShowBoth = budgeted.length > 1;
  const picked = budgeted.filter((p) => shown === 'both' || p.key === shown);
  // Deleting the last pool row takes its panel with it while the dialog is
  // open, and an empty body has no switcher left to recover through.
  const visible = picked.length > 0 ? picked : budgeted;
  const title =
    shown === 'both'
      ? budgeted.map((p) => p.title).join(' and ')
      : (visible[0]?.title ?? panel.title);

  const options: { value: Shown; label: string }[] = [
    ...budgeted.map((p) => ({ value: p.key, label: p.title })),
    { value: 'both', label: 'Both' },
  ];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        setOpen(e.open);
        if (e.open) setShown(panel.key);
      }}
      size="cover"
      placement="center"
      lazyMount
      unmountOnExit
    >
      <Tooltip content={`Enlarge the ${panel.title} chart`}>
        <Dialog.Trigger asChild>
          <IconButton
            size="xs"
            variant="ghost"
            h={{ base: '40px', md: '20px' }}
            minW={{ base: '40px', md: '20px' }}
            aria-label={`Enlarge the ${panel.title} chart`}
          >
            <ExternalLink size={13} />
          </IconButton>
        </Dialog.Trigger>
      </Tooltip>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="1200px" mx="auto">
            <Dialog.Header py={3}>
              <HStack justify="space-between" align="center" gap={3} wrap="wrap">
                <Dialog.Title fontSize="sm">{title}</Dialog.Title>
                {canShowBoth && (
                  <HStack
                    gap="2px"
                    p="2px"
                    bg="bg.subtle"
                    borderRadius="4px"
                    flexWrap="wrap"
                    role="group"
                    aria-label="Charts to show"
                    me={8}
                  >
                    {options.map((o) => {
                      const isActive = shown === o.value;
                      return (
                        <Button
                          key={o.value}
                          size="xs"
                          variant={isActive ? 'solid' : 'plain'}
                          colorPalette={isActive ? 'blue' : 'gray'}
                          onClick={() => setShown(o.value)}
                          aria-pressed={isActive}
                          h={{ base: '40px', md: '24px' }}
                          minW={0}
                          px={2}
                          borderRadius="3px"
                          fontFamily="mono"
                          fontSize="10px"
                          fontWeight="500"
                          _hover={{
                            bg: isActive ? 'colorPalette.solid/90' : 'bg.muted',
                          }}
                          _focusVisible={chipFocusRing}
                        >
                          {o.label}
                        </Button>
                      );
                    })}
                  </HStack>
                )}
              </HStack>
            </Dialog.Header>
            <Dialog.Body pb={6}>
              <Stack gap={4}>
                {visible.map((p) => (
                  <ChartPanel
                    key={p.key}
                    panel={p}
                    dists={dists}
                    slots={slots}
                    focusedId={focus.focusedId}
                    pickedId={focus.pickedId}
                    onPreview={focus.preview}
                    onPick={focus.toggle}
                    onClear={focus.clear}
                    pageSize={pageSize}
                    onPage={onPage}
                    unit={unitFor(p)}
                    {...(canField && solo !== undefined && p.key === solo.key
                      ? {
                          fieldToggle: (
                            <Tooltip content={tipForId('chartPageTwenty')}>
                              <Button
                                size="xs"
                                variant={usePage ? 'solid' : 'ghost'}
                                colorPalette={usePage ? 'blue' : 'gray'}
                                aria-pressed={usePage}
                                h={{ base: '40px', md: '20px' }}
                                minW={0}
                                px={2}
                                borderRadius="3px"
                                fontFamily="mono"
                                fontSize="10px"
                                fontWeight="500"
                                _focusVisible={chipFocusRing}
                                onClick={() => setPaged(!usePage)}
                              >
                                {CHART_ROW_CAP_RAIL} at a time
                              </Button>
                            </Tooltip>
                          ),
                        }
                      : {})}
                    // Two panels share the dialog's height, so each takes
                    // roughly half rather than one being pushed off-screen.
                    height={
                      visible.length > 1
                        ? 'min(32vh, 280px)'
                        : 'min(60vh, 520px)'
                    }
                  />
                ))}
              </Stack>
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
