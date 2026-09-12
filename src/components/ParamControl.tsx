import type { ReactNode } from 'react';
import {
  Box,
  Button,
  CloseButton,
  Dialog,
  HStack,
  Popover,
  Portal,
  Text,
} from '@chakra-ui/react';
import { ChevronDown } from 'lucide-react';
import { tapTarget } from './tapTarget';
import { useIsDesktop } from '../hooks/useBreakpoint';

/** Fixed gutter so every group's summary row starts at the same offset. */
const LABEL_GUTTER = '74px';

interface ParamControlProps {
  /** Sentence case, not an uppercase eyebrow: it is part of the control. */
  label: string;
  /** What the group is set to. Rendered inside the trigger. */
  summary: ReactNode;
  title: string;
  editLabel: string;
  /**
   * The glossary line for this parameter. Carried as a native title rather
   * than a HelpTerm: the trigger is already a button, and nesting a focusable
   * term inside one is a worse trade than losing the dotted underline.
   */
  tip?: string;
  /** The group's identity colour, used on the label only. */
  accent?: string;
  children: ReactNode;
}

/**
 * One parameter group as a single control that states its own value and opens
 * its editor.
 *
 * The layout this replaces put a fixed 74px label column beside a horizontal
 * run of controls, which produced two problems it could not solve from the
 * inside: a label shorter than the column left dead space before the first
 * control, and a unit like "successes" had nowhere to sit except between the
 * values and the add box. Naming the group inside the trigger removes the
 * column, and the unit becomes part of the summary sentence.
 *
 * It also stops the bar growing with content: five targets read the same height
 * as one.
 */
export function ParamControl({
  label,
  summary,
  title,
  editLabel,
  tip,
  accent = 'fg.muted',
  children,
}: ParamControlProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Popover.Root positioning={{ placement: 'bottom-start' }} lazyMount unmountOnExit>
        <Popover.Trigger asChild>
          <Button
            size="sm"
            variant="outline"
            borderColor="border.subtle"
            fontWeight="normal"
            px={3}
            gap={2}
            title={tip}
            aria-label={editLabel}
          >
            <Text as="span" fontSize="xs" color={accent}>
              {label}
            </Text>
            <HStack as="span" gap={1} fontSize="xs">
              {summary}
            </HStack>
            <Box as="span" color="fg.subtle" lineHeight={0}>
              <ChevronDown size={14} />
            </Box>
          </Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            {/* The trigger beside it already carries the name on screen, so
                the panel is named rather than given a second heading. An
                aria-label rather than a Popover.Title: the title part wires
                itself to the content through the machine, and a second open
                popover does not always get wired. */}
            <Popover.Content maxW="340px" aria-label={title}>
              <Popover.Arrow>
                <Popover.ArrowTip />
              </Popover.Arrow>
              <Popover.Body>{children}</Popover.Body>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    );
  }

  // Touch gets a sheet rather than a popover: a popover anchored to a
  // full-width row has nowhere useful to sit, and the thumb is at the bottom.
  return (
    <Dialog.Root
      lazyMount
      unmountOnExit
      placement="bottom"
      size="lg"
      motionPreset="slide-in-bottom"
    >
      <HStack gap={2} minH="44px" w="100%">
        <Box w={LABEL_GUTTER} flexShrink={0}>
          <Text fontSize="xs" color={accent}>
            {label}
          </Text>
        </Box>
        <HStack
          gap={1}
          flex="1"
          minW={0}
          overflow="hidden"
          whiteSpace="nowrap"
          align="center"
          fontSize="xs"
        >
          {summary}
        </HStack>
        <Dialog.Trigger asChild>
          <Button
            size="xs"
            variant="outline"
            flexShrink={0}
            h={tapTarget('32px')}
            title={tip}
            aria-label={editLabel}
          >
            Edit
          </Button>
        </Dialog.Trigger>
      </HStack>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxH="80vh" borderTopRadius="lg">
            <Dialog.Header py={3}>
              <Dialog.Title fontSize="sm">{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pb={6}>{children}</Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
