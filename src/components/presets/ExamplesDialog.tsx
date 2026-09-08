import { useState } from 'react';
import {
  Button,
  CloseButton,
  Dialog,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Dices } from 'lucide-react';
import { useApp } from '../../state/useApp';
import { STARTER_PRESETS } from '../../presets/starterRolls';
import { PresetCardGrid } from './PresetCardGrid';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';

interface ExamplesDialogProps {
  // Controlled when `open` is supplied, which also drops the built-in trigger:
  // the toolbar opens this from a menu item that cannot host a Dialog.Trigger.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ExamplesDialog({ open, onOpenChange }: ExamplesDialogProps) {
  const { addExpressions } = useApp();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => setOpen(e.open)}
      lazyMount
      unmountOnExit
      placement="center"
      scrollBehavior="inside"
      size={{ mdDown: 'full', md: 'lg' }}
    >
      {!controlled && (
        <Tooltip content={tipForId('examples')} disabled={isOpen}>
          <Dialog.Trigger asChild>
            <Button size="sm" variant="outline" minH="48px">
              <Dices size={16} />
              Examples
            </Button>
          </Dialog.Trigger>
        </Tooltip>
      )}
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Example rolls</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={4}>
                <Text fontSize="sm" color="fg.muted">
                  Adding one appends it to your table. Rename it, change the
                  dice, or delete it afterwards.
                </Text>
                <PresetCardGrid />
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                colorPalette="blue"
                minH={{ base: '48px', md: '44px' }}
                w={{ base: 'full', md: 'auto' }}
                onClick={() => {
                  addExpressions(STARTER_PRESETS.map((p) => p.expr));
                  setOpen(false);
                }}
              >
                Load every example
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
