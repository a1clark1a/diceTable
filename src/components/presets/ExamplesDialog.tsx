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

export function ExamplesDialog() {
  const { addExpressions } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      lazyMount
      unmountOnExit
      placement="center"
      scrollBehavior="inside"
      size={{ mdDown: 'full', md: 'lg' }}
    >
      <Tooltip content={tipForId('examples')} disabled={open}>
        <Dialog.Trigger asChild>
          <Button size="sm" variant="outline" minH="48px">
            <Dices size={16} />
            Examples
          </Button>
        </Dialog.Trigger>
      </Tooltip>
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
