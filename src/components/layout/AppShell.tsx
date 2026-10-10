import { useRef } from 'react';
import { Box, Button, Flex, HStack, Text } from '@chakra-ui/react';
import { NavLink, Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Toaster } from '../share/Toaster';
import { useShareLinkAutoload } from '../share/useShareLinkAutoload';
import { tapTarget } from '../tapTarget';
import { useWhatsNew } from '../whatsNew/useWhatsNew';
import { WhatsNewDialog } from '../whatsNew/WhatsNewDialog';

export function AppShell() {
  const whatsNew = useWhatsNew();
  const whatsNewButtonRef = useRef<HTMLButtonElement>(null);
  useShareLinkAutoload();
  return (
    <Flex direction="column" h="100dvh" bg="bg">
      <Navbar />
      <Box as="main" flex="1" minH={0} overflowY="auto">
        <Box
          w="100%"
          minH="100%"
          // A definite height only where a view divides it and scrolls inside
          // itself, which is the two-column table layout at 2xl. Below that
          // nothing scrolls internally, so a fixed height would clip the page
          // and leave its sections painting over each other.
          h={{ base: 'auto', '2xl': '100%' }}
          display="flex"
          flexDirection="column"
          px={3}
          py={{ base: 3, md: 4 }}
        >
          <Outlet />
        </Box>
      </Box>
      <Box
        as="footer"
        px={{ base: 3, md: 6 }}
        // Below lg the What's new button is finger-sized and already sets the
        // footer's height, so padding there would only add an empty band.
        py={{ base: 0, lg: 1 }}
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
          <Button
            ref={whatsNewButtonRef}
            onClick={whatsNew.openAll}
            variant="ghost"
            size="xs"
            h="auto"
            minH={tapTarget('24px')}
            px={1.5}
            // Optical alignment with the padded edge on desktop only: at phone
            // width the pull would put the focus ring against the screen edge.
            me={{ base: 0, lg: -1.5 }}
            gap={1.5}
            fontSize="xs"
            fontWeight="normal"
            color="fg.muted"
            _hover={{ color: 'fg', bg: 'bg.muted' }}
          >
            What&apos;s new
            <Text
              as="span"
              color="fg.subtle"
              fontFamily="mono"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              v{__APP_VERSION__}
              {import.meta.env.PROD ? '' : ` · ${__COMMIT_SHA__}`}
            </Text>
          </Button>
        </Flex>
      </Box>
      <WhatsNewDialog
        open={whatsNew.open}
        mode={whatsNew.mode}
        releases={whatsNew.releases}
        sinceVersion={whatsNew.sinceVersion}
        current={whatsNew.current}
        onClose={whatsNew.close}
        returnFocusRef={whatsNewButtonRef}
      />
      <Toaster />
    </Flex>
  );
}
