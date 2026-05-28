import { Box, Flex, Text } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Toaster } from '../share/Toaster';
import { useShareLinkAutoload } from '../share/useShareLinkAutoload';

export function AppShell() {
  useShareLinkAutoload();
  return (
    <Flex direction="column" h="100dvh" bg="bg">
      <Navbar />
      <Box as="main" flex="1" minH={0} overflowY="auto">
        <Box
          maxW="1200px"
          mx="auto"
          w="100%"
          px={{ base: 3, md: 6 }}
          py={{ base: 3, md: 6 }}
        >
          <Outlet />
        </Box>
      </Box>
      <Box
        as="footer"
        px={{ base: 3, md: 6 }}
        py={2}
        borderTopWidth="1px"
        borderColor="border.subtle"
      >
        <Flex
          justify="space-between"
          align="center"
          gap={3}
          fontSize="xs"
        >
          <Text color="fg.muted">Made by DevZan</Text>
          <Text
            color="fg.subtle"
            fontFamily="mono"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            v{__APP_VERSION__} · {__COMMIT_SHA__}
          </Text>
        </Flex>
      </Box>
      <Toaster />
    </Flex>
  );
}
