import type { ReactNode } from 'react';
import {
  Box,
  Button,
  CloseButton,
  Dialog,
  HStack,
  Portal,
} from '@chakra-ui/react';
import { PARAM_LABEL_GUTTER } from './ParamLabel';
import { tapTarget } from './tapTarget';

interface ParamSheetProps {
  /** The same label the inline row uses, so the two layouts read alike. */
  label: ReactNode;
  /** What the group is set to, shown at rest. */
  summary: ReactNode;
  title: string;
  editLabel: string;
  children: ReactNode;
}

/**
 * A parameter group as one fixed-height line on a phone, with its editor behind
 * a sheet.
 *
 * Five targets and five pool targets wrap to four rows of chips at 360px and
 * push the first roll 553px down the page, and that cost grows with every
 * target added. Targets are set once and then read, so the resting state is
 * what to optimise: the line never changes height, and editing gets a full
 * screen rather than the last 250px of a cramped bar.
 */
export function ParamSheet({
  label,
  summary,
  title,
  editLabel,
  children,
}: ParamSheetProps) {
  return (
    <Dialog.Root
      lazyMount
      unmountOnExit
      // Bottom-anchored and content-height on a phone: a full-screen sheet for
      // five chips is mostly empty, and the thumb is already down there.
      placement={{ base: 'bottom', md: 'center' }}
      size="lg"
      motionPreset="slide-in-bottom"
    >
      <HStack gap={2} minH="44px" w="100%">
        <Box w={PARAM_LABEL_GUTTER} flexShrink={0}>
          {label}
        </Box>
        {/* The values are a summary, not a control: they never wrap, and a long
            list runs out of room rather than growing the line. */}
        <HStack
          gap={1}
          flex="1"
          minW={0}
          overflow="hidden"
          whiteSpace="nowrap"
          align="center"
        >
          {summary}
        </HStack>
        <Dialog.Trigger asChild>
          <Button
            size="xs"
            variant="outline"
            flexShrink={0}
            h={tapTarget('32px')}
            aria-label={editLabel}
          >
            Edit
          </Button>
        </Dialog.Trigger>
      </HStack>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            // The editor is short; the sheet should be too.
            maxH={{ base: '80vh', md: 'none' }}
            borderTopRadius={{ base: 'lg', md: undefined }}
          >
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
