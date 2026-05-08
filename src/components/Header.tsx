import { Box, Heading, HStack, Image } from '@chakra-ui/react';
import { ColorModeButton } from './ui/color-mode';
import { ImportDialog } from './share/ImportDialog';
import { SharePopover } from './share/SharePopover';

export function Header() {
  return (
    <Box
      as="header"
      px={{ base: 3, md: 6 }}
      py={3}
      borderBottomWidth="1px"
      borderColor="border.subtle"
      bg="bg.subtle"
    >
      <HStack justify="space-between" gap={3}>
        <HStack gap={2}>
          <Image src="/favicon.svg" alt="" boxSize={{ base: 7, md: 8 }} />
          <Heading size={{ base: 'md', md: 'lg' }} letterSpacing="tight">
            DiceTable
          </Heading>
        </HStack>
        <HStack gap={1}>
          <ImportDialog />
          <SharePopover />
          <ColorModeButton />
        </HStack>
      </HStack>
    </Box>
  );
}
