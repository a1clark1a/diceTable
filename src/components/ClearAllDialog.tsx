import { Button, CloseButton, Dialog, Portal, Text } from '@chakra-ui/react';
import { useApp } from '../state/useApp';

interface ClearAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClearAllDialog({ open, onOpenChange }: ClearAllDialogProps) {
  const { expressions, replaceExpressions } = useApp();
  const count = expressions.length;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      lazyMount
      unmountOnExit
      placement="center"
      role="alertdialog"
      size="xs"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Clear the table?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>
                This removes{' '}
                {count === 1 ? 'the only roll' : `all ${count} rolls`} and
                can't be undone.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="red"
                onClick={() => {
                  replaceExpressions([]);
                  onOpenChange(false);
                }}
              >
                {count === 1 ? 'Clear 1 roll' : `Clear ${count} rolls`}
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
