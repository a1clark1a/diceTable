import { useRef, type RefObject } from 'react';
import {
  Button,
  CloseButton,
  Dialog,
  Heading,
  Link,
  List,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react';
import { ExternalLink } from 'lucide-react';
import type { Release } from '../../whatsNew/releases';
import type { WhatsNewMode } from './useWhatsNew';

const RELEASE_URL = 'https://github.com/a1clark1a/diceTable/releases/tag/v';

// Release dates are calendar days, not instants: read as UTC midnight and
// formatted in UTC, or a reader west of Greenwich sees the day before.
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

function formatReleaseDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : DATE_FORMAT.format(d);
}

interface WhatsNewDialogProps {
  open: boolean;
  mode: WhatsNewMode;
  releases: readonly Release[];
  sinceVersion: string | null;
  current: string;
  onClose: () => void;
  /** Where focus goes back to after a close the footer button started. */
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function WhatsNewDialog({
  open,
  mode,
  releases,
  sinceVersion,
  current,
  onClose,
  returnFocusRef,
}: WhatsNewDialogProps) {
  const gotItRef = useRef<HTMLButtonElement>(null);
  const subtitle =
    mode === 'all'
      ? 'Every version of DiceTable, newest first.'
      : sinceVersion === null
        ? `New in v${current}.`
        : `Since your last visit (v${sinceVersion}).`;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      lazyMount
      unmountOnExit
      placement="center"
      scrollBehavior="inside"
      size={{ mdDown: 'full', md: 'lg' }}
      // The first tabbable element would otherwise be a release-notes link, so
      // Enter on an auto-opened dialog would leave the app for GitHub.
      initialFocusEl={() => gotItRef.current}
      // The footer button is not a Dialog.Trigger, and Safari does not focus a
      // button on click, so without this focus falls to <body> on close.
      finalFocusEl={() => (mode === 'all' ? returnFocusRef.current : null)}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header flexDirection="column" alignItems="flex-start" gap={1}>
              <Dialog.Title>What&apos;s new</Dialog.Title>
              <Dialog.Description fontSize="sm" color="fg.muted">
                {subtitle}
              </Dialog.Description>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={6}>
                {releases.map((r) => (
                  <Stack key={r.version} as="section" gap={2}>
                    <Stack gap={0.5}>
                      <Heading as="h3" size="sm">
                        v{r.version} · {r.title}
                      </Heading>
                      <Text fontSize="xs" color="fg.subtle">
                        {formatReleaseDate(r.date)}
                      </Text>
                    </Stack>
                    <List.Root gap={1.5} ps={5} fontSize="sm">
                      {r.highlights.map((h) => (
                        <List.Item key={h}>{h}</List.Item>
                      ))}
                    </List.Root>
                    <Link
                      href={`${RELEASE_URL}${r.version}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      fontSize="xs"
                      color="fg.muted"
                      alignSelf="flex-start"
                    >
                      Full release notes
                      <ExternalLink size={12} aria-hidden />
                    </Link>
                  </Stack>
                ))}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button
                  ref={gotItRef}
                  colorPalette="blue"
                  minH={{ base: '48px', md: '44px' }}
                  w={{ base: 'full', md: 'auto' }}
                >
                  Got it
                </Button>
              </Dialog.ActionTrigger>
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
