import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import { NavLink, Outlet } from 'react-router-dom';
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
          <HStack gap={3}>
            <Text color="fg.muted">Made by DevZan</Text>
            <Text color="fg.subtle" aria-hidden>
              ·
            </Text>
            <NavLink
              to="/privacy"
              style={{ textDecoration: 'none' }}
            >
              {({ isActive }) => (
                <Text
                  color={isActive ? 'fg' : 'fg.muted'}
                  _hover={{ color: 'fg' }}
                  transition="color 0.15s"
                >
                  Privacy
                </Text>
              )}
            </NavLink>
          </HStack>
          <Text
            color="fg.subtle"
            fontFamily="mono"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            v{__APP_VERSION__}
            {import.meta.env.PROD ? '' : ` · ${__COMMIT_SHA__}`}
          </Text>
        </Flex>
      </Box>
      <Toaster />
    </Flex>
  );
}
