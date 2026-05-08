import { Box, Flex } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { Header } from '../Header';
import { Toaster } from '../share/Toaster';
import { useShareLinkAutoload } from '../share/useShareLinkAutoload';

export function AppShell({ children }: { children: ReactNode }) {
  useShareLinkAutoload();
  return (
    <Flex direction="column" minH="100dvh" bg="bg">
      <Header />
      <Box
        as="main"
        flex="1"
        overflowY="auto"
        px={{ base: 3, md: 6 }}
        py={{ base: 3, md: 6 }}
      >
        <Box maxW="1200px" mx="auto" w="100%">
          {children}
        </Box>
      </Box>
      <Toaster />
    </Flex>
  );
}
