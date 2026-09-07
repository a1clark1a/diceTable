import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Popover,
  Portal,
  Separator,
  Stack,
} from '@chakra-ui/react';
import {
  Clipboard,
  Download,
  Image as ImageIcon,
  Link2,
  Share2,
} from 'lucide-react';
import { useApp } from '../../state/useApp';
import {
  encodeRollsToBlob,
  encodeRollsToJson,
  shareUrlFor,
} from '../../share/encode';
import { downloadBlob } from '../../share/download';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';
import { toaster } from './toaster-store';
import { useShareImage } from '../../share/image/useShareImage';

async function writeToClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to textarea fallback
    }
  }
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok: boolean;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function SharePopover() {
  const { expressions } = useApp();
  const [open, setOpen] = useState(false);
  const disabled = expressions.length === 0;
  const image = useShareImage();

  const close = useCallback(() => setOpen(false), []);

  // The chart panel's Image button is where a title can be typed; here the two
  // most common actions are mirrored untitled, so Share holds everything.
  const onCopyImage = useCallback(async () => {
    await image.copyImage('');
    close();
  }, [image, close]);

  const onSaveImage = useCallback(async () => {
    await image.savePng('');
    close();
  }, [image, close]);

  const onCopyLink = useCallback(async () => {
    const url = shareUrlFor(expressions);
    const ok = await writeToClipboard(url);
    if (ok) {
      toaster.create({ type: 'success', title: 'Link copied' });
    } else {
      toaster.create({
        type: 'error',
        title: "Couldn't copy",
        description: 'Your browser blocked clipboard access.',
      });
    }
    close();
  }, [expressions, close]);

  const onCopyJson = useCallback(async () => {
    const json = encodeRollsToJson(expressions);
    const ok = await writeToClipboard(json);
    if (ok) {
      toaster.create({ type: 'success', title: 'JSON copied' });
    } else {
      toaster.create({
        type: 'error',
        title: "Couldn't copy",
        description: 'Your browser blocked clipboard access.',
      });
    }
    close();
  }, [expressions, close]);

  const onDownload = useCallback(() => {
    const { blob, suggestedFilename } = encodeRollsToBlob(expressions);
    downloadBlob(blob, suggestedFilename);
    toaster.create({ type: 'success', title: 'Download started' });
    close();
  }, [expressions, close]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(e) => setOpen(e.open)}
      positioning={{ placement: 'bottom-end' }}
      lazyMount
      unmountOnExit
    >
      <Tooltip content={tipForId('share')} disabled={open || disabled}>
        <Popover.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            colorPalette="gray"
            disabled={disabled}
            aria-label="Share rolls"
          >
            <Share2 size={16} />
            <Box as="span" display={{ base: 'none', md: 'inline' }}>
              Share
            </Box>
          </Button>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            w={{ base: 'calc(100vw - 32px)', sm: '280px' }}
            maxW="280px"
          >
            <Popover.Arrow>
              <Popover.ArrowTip />
            </Popover.Arrow>
            <Popover.Body p={2}>
              <Stack gap={1}>
                <Button
                  variant="ghost"
                  justifyContent="flex-start"
                  onClick={onCopyLink}
                >
                  <Link2 size={16} />
                  Copy link
                </Button>
                <Button
                  variant="ghost"
                  justifyContent="flex-start"
                  onClick={onCopyJson}
                >
                  <Clipboard size={16} />
                  Copy JSON
                </Button>
                <Button
                  variant="ghost"
                  justifyContent="flex-start"
                  onClick={onDownload}
                >
                  <Download size={16} />
                  Download file
                </Button>
                {image.cardState === 'ready' && (
                  <>
                    <Separator my={1} />
                    <Button
                      variant="ghost"
                      justifyContent="flex-start"
                      loading={image.busy}
                      onClick={() => void onCopyImage()}
                    >
                      <ImageIcon size={16} />
                      Copy image
                    </Button>
                    <Button
                      variant="ghost"
                      justifyContent="flex-start"
                      loading={image.busy}
                      onClick={() => void onSaveImage()}
                    >
                      <Download size={16} />
                      Save PNG
                    </Button>
                  </>
                )}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
