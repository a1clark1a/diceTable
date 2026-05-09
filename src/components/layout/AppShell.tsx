import { Box, Flex } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Toaster } from '../share/Toaster';
import { useShareLinkAutoload } from '../share/useShareLinkAutoload';

export function AppShell() {
  useShareLinkAutoload();
  return (
    <Flex direction="column" minH="100dvh" bg="bg">
      <Navbar />
      <Box
        as="main"
        flex="1"
        overflowY="auto"
        px={{ base: 3, md: 6 }}
        py={{ base: 3, md: 6 }}
      >
        <Box maxW="1200px" mx="auto" w="100%">
          <Outlet />
        </Box>
      </Box>
      <Toaster />
    </Flex>
  );
}
