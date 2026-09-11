import { Dialog, IconButton, Portal, CloseButton } from '@chakra-ui/react';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { Distribution } from '../../types';
import { Tooltip } from '../ui/tooltip';
import { ChartPanel } from './ChartPanel';
import type { ChartPanelData } from './useChartPanels';
import type { ChartUnit } from './OverlayChartImpl';

interface ChartEnlargeDialogProps {
  panel: ChartPanelData;
  dists: Map<string, Distribution>;
  colors: Map<string, string>;
  unit: ChartUnit;
}

/**
 * The rail is a glance; this is the same panel with room to read it. It renders
 * ChartPanel rather than a second chart surface, so the legend, the hover and
 * the view control come with it instead of having to be rebuilt here and then
 * kept in step.
 */
export function ChartEnlargeDialog({
  panel,
  dists,
  colors,
  unit,
}: ChartEnlargeDialogProps) {
  const [open, setOpen] = useState(false);
  // Hover is local to the enlarged copy: the row it would highlight is behind
  // the dialog anyway.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
              <Dialog.Title fontSize="sm">{panel.title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pb={6}>
              <ChartPanel
                panel={panel}
                dists={dists}
                colors={colors}
                hoveredId={hoveredId}
                onHover={setHoveredId}
                unit={unit}
                height="min(60vh, 520px)"
              />
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
