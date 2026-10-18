import { Box, HStack, Image, Text } from '@chakra-ui/react';
import { Link as RouterLink, matchPath, useLocation } from 'react-router-dom';
import { ColorModeButton } from '../ui/color-mode';
import { ShareImagePopover } from '../share/ShareImagePopover';
import { ImportDialog } from '../share/ImportDialog';
import { SharePopover } from '../share/SharePopover';
import { docsSectionPath } from '../docs/docs-tab';

interface NavItem {
  to: string;
  label: string;
  /** Route patterns the item stands for; it reads as current on any of them. */
  sections: readonly string[];
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Table', sections: ['/'] },
  {
    // /docs only redirects here, which costs a crawler or a new tab a hop.
    to: docsSectionPath('quickstart'),
    label: 'Docs',
    sections: ['/docs/*'],
  },
];

export function Navbar() {
  const { pathname } = useLocation();
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
            {NAV_ITEMS.map((item) => {
              const current = item.sections.some(
                (pattern) => matchPath(pattern, pathname) !== null,
              );
              const here = matchPath(item.to, pathname) !== null;
              return (
                <RouterLink
                  key={item.to}
                  to={item.to}
                  // "page" only where the link leads to the page on screen.
                  // Elsewhere in its section the item is current but the page
                  // is not, and the docs bar's own link already claims "page".
                  aria-current={here ? 'page' : current ? 'true' : undefined}
                  style={{ textDecoration: 'none' }}
                >
                  <Box
                    px={3}
                    minH="40px"
                    minW="40px"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="13px"
                    fontWeight="500"
                    color={current ? 'fg' : 'fg.muted'}
                    borderBottomWidth="2px"
                    borderColor={
                      current ? 'colorPalette.solid' : 'transparent'
                    }
                    colorPalette="blue"
                    transition="color 0.15s, border-color 0.15s, background 0.15s"
                    _hover={{ bg: 'bg.muted', color: 'fg' }}
                  >
                    {item.label}
                  </Box>
                </RouterLink>
              );
            })}
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
