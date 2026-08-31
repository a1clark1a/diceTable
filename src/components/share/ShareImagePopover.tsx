import { useCallback, useState } from 'react';
import { Box, Button, Field, Input, Popover, Portal, Stack, Text } from '@chakra-ui/react';
import { Clipboard, Download, Image as ImageIcon, Share2 } from 'lucide-react';
import { useShareImage } from '../../share/image/useShareImage';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';

export function ShareImagePopover() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const { busy, canShareSheet, hasRows, copyImage, savePng, shareSheet } =
    useShareImage();

  const runAndClose = useCallback(
    async (action: (t: string) => Promise<void>) => {
      await action(title);
      setOpen(false);
    },
    [title],
  );

  return (
    <Popover.Root
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      positioning={{ placement: 'bottom-end' }}
      lazyMount
      unmountOnExit
    >
      <Tooltip content={tipForId('shareImage')} disabled={open || !hasRows}>
        <Popover.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            colorPalette="gray"
            disabled={!hasRows}
            aria-label="Share the comparison as an image"
          >
            <ImageIcon size={16} />
            <Box as="span" display={{ base: 'none', md: 'inline' }}>
              Image
            </Box>
          </Button>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            w={{ base: 'calc(100vw - 32px)', sm: '300px' }}
            maxW="300px"
          >
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body p={3}>
              <Stack gap={3}>
                <Field.Root>
                  <Field.Label fontSize="xs" color="fg.muted">
                    Title
                  </Field.Label>
                  <Input
                    size="sm"
                    h="40px"
                    value={title}
                    placeholder="Optional"
                    maxLength={70}
                    onChange={(e) => setTitle(e.target.value)}
                    aria-label="Image title"
                  />
                </Field.Root>

                <Stack gap={1}>
                  <Button
                    variant="ghost"
                    h="40px"
                    justifyContent="flex-start"
                    loading={busy}
                    onClick={() => void runAndClose(copyImage)}
                  >
                    <Clipboard size={16} />
                    Copy image
                  </Button>
                  <Button
                    variant="ghost"
                    h="40px"
                    justifyContent="flex-start"
                    loading={busy}
                    onClick={() => void runAndClose(savePng)}
                  >
                    <Download size={16} />
                    Save PNG
                  </Button>
                  {canShareSheet && (
                    <Button
                      variant="ghost"
                      h="40px"
                      justifyContent="flex-start"
                      loading={busy}
                      onClick={() => void runAndClose(shareSheet)}
                    >
                      <Share2 size={16} />
                      Share
                    </Button>
                  )}
                </Stack>

                <Text fontSize="xs" color="fg.muted">
                  Copying puts the link on the clipboard too, so either one pastes.
                </Text>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
