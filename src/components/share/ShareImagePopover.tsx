import { useCallback, useState } from 'react';
import { Box, Button, Field, Input, Popover, Portal, Stack, Text } from '@chakra-ui/react';
import { Clipboard, Download, Image as ImageIcon, Share2 } from 'lucide-react';
import {
  useShareImage,
  type ShareCardState,
} from '../../share/image/useShareImage';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';

const BLOCKED_TIP: Record<Exclude<ShareCardState, 'ready'>, string> = {
  noRows: 'shareImageNoRows',
  needsTwo: 'shareImageNeedsTwo',
  overLimit: 'shareImageOverLimit',
  noTargets: 'shareImageNoTargets',
  noSumRows: 'shareImageNoSumRows',
};

export function ShareImagePopover() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const { busy, canShareSheet, cardState, copyImage, savePng, shareSheet } =
    useShareImage();
  const ready = cardState === 'ready';

  // A natively disabled <button> fires no pointer or focus events, so the tip
  // that explains why it is blocked could never open. Marked disabled to
  // assistive tech instead, it stays hoverable and tabbable, and it is simply
  // not a popover trigger while blocked, so there is nothing to click through.
  const trigger = (
    <Button
      // Ghost, not outline: it sits beside Import and Share in the identity
      // bar, and an outline made it read as the only boxed control up there.
      variant="ghost"
      size="sm"
      colorPalette="gray"
      aria-disabled={!ready}
      data-disabled={ready ? undefined : ''}
      minW="40px"
      minH="40px"
      aria-label="Share this view as an image"
    >
      <ImageIcon size={16} />
      <Box as="span" display={{ base: 'none', md: 'inline' }}>
        Image
      </Box>
    </Button>
  );

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
      {/* The tip is what explains a blocked button, so it is suppressed only
          while the popover itself is open. */}
      <Tooltip
        content={tipForId(ready ? 'shareImage' : BLOCKED_TIP[cardState])}
        disabled={open}
      >
        {ready ? <Popover.Trigger asChild>{trigger}</Popover.Trigger> : trigger}
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
