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
import { useState } from 'react';
import type { Distribution } from '../../types';
import { Tooltip } from '../ui/tooltip';
import { chipFocusRing } from '../editor/focusRings';
import { ChartPanel } from './ChartPanel';
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
  colors: Map<string, string>;
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
  colors,
}: ChartEnlargeDialogProps) {
  const [open, setOpen] = useState(false);
  // Hover is local to the enlarged copy: the row it would highlight is behind
  // the dialog anyway.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // unmountOnExit resets this, so the dialog always opens on the card whose
  // button was pressed rather than on whatever was picked last time.
  const [shown, setShown] = useState<Shown>(panel.key);

  const canShowBoth = panels.length > 1;
  const visible = panels.filter((p) => shown === 'both' || p.key === shown);
  const title =
    shown === 'both'
      ? panels.map((p) => p.title).join(' and ')
      : (visible[0]?.title ?? panel.title);

  const options: { value: Shown; label: string }[] = [
    ...panels.map((p) => ({ value: p.key as Shown, label: p.title })),
    { value: 'both', label: 'Both' },
  ];

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
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
                    colors={colors}
                    hoveredId={hoveredId}
                    onHover={setHoveredId}
                    unit={unitFor(p)}
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
