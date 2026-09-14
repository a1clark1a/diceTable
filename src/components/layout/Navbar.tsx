import { Box, HStack, Image, Text } from '@chakra-ui/react';
import { NavLink } from 'react-router-dom';
import { ColorModeButton } from '../ui/color-mode';
import { ShareImagePopover } from '../share/ShareImagePopover';
import { ImportDialog } from '../share/ImportDialog';
import { SharePopover } from '../share/SharePopover';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Table', end: true },
  { to: '/docs', label: 'Docs' },
];

export function Navbar() {
  return (
    <Box
      as="header"
      px={{ base: 3, md: 6 }}
      minH="52px"
      display="flex"
      alignItems="center"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      bg="bg.panel"
    >
      <HStack justify="space-between" gap={3} w="100%">
        <HStack gap={{ base: 2, md: 3 }} minW={0}>
          <HStack gap={2} flexShrink={0}>
            <Image src="/favicon.svg" alt="" boxSize={{ base: 7, md: 8 }} />
            {/* A wordmark, not a heading: TablePage owns the page's only h1. */}
            <Text
              as="span"
              fontSize="14px"
              fontWeight="600"
              letterSpacing="-0.01em"
              display={{ base: 'none', sm: 'block' }}
            >
              DiceTable
            </Text>
          </HStack>
          <Box
            w="1px"
            h="24px"
            bg="border.subtle"
            flexShrink={0}
            display={{ base: 'none', sm: 'block' }}
          />
          <HStack as="nav" gap={1} aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? false}
                style={{ textDecoration: 'none' }}
              >
                {({ isActive }) => (
                  <Box
                    px={3}
                    minH="40px"
                    minW="40px"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="13px"
                    fontWeight="500"
                    color={isActive ? 'fg' : 'fg.muted'}
                    borderBottomWidth="2px"
                    borderColor={
                      isActive ? 'colorPalette.solid' : 'transparent'
                    }
                    colorPalette="blue"
                    transition="color 0.15s, border-color 0.15s, background 0.15s"
                    _hover={{ bg: 'bg.muted', color: 'fg' }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </Box>
                )}
              </NavLink>
            ))}
          </HStack>
        </HStack>
        <HStack gap={1} flexShrink={0}>
          <ShareImagePopover />
          <ImportDialog />
          <SharePopover />
          <ColorModeButton />
        </HStack>
      </HStack>
    </Box>
  );
}
