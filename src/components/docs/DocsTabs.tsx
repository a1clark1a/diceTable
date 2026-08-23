import { Button, HStack, chakra } from '@chakra-ui/react';
import { NavLink, useMatch } from 'react-router-dom';
import { docsSectionPath, type DocsTab } from './docs-tab';

const TabLink = chakra(NavLink);

interface TabDef {
  value: DocsTab;
  label: string;
}

const TABS: readonly TabDef[] = [
  { value: 'quickstart', label: 'Quickstart' },
  { value: 'glossary', label: 'Glossary' },
  { value: 'math', label: 'The Math' },
];

export function DocsTabs() {
  return (
    <>
      <HStack
        as="nav"
        aria-label="Docs sections"
        gap={1}
        borderBottomWidth="1px"
        borderColor="border.subtle"
        display={{ base: 'none', md: 'flex' }}
      >
        {TABS.map((tab) => (
          <TabLink
            key={tab.value}
            to={docsSectionPath(tab.value)}
            px={4}
            py={2.5}
            fontSize="sm"
            fontWeight="medium"
            color="fg.muted"
            textDecoration="none"
            bg="transparent"
            borderBottomWidth="2px"
            borderColor="transparent"
            colorPalette="blue"
            mb="-1px"
            cursor="pointer"
            transition="color 0.15s, border-color 0.15s, background 0.15s"
            _hover={{ color: 'fg', bg: 'bg.muted' }}
            _focusVisible={{
              outline: '2px solid',
              outlineColor: 'colorPalette.solid',
              outlineOffset: '2px',
            }}
            _currentPage={{ color: 'fg', borderColor: 'colorPalette.solid' }}
          >
            {tab.label}
          </TabLink>
        ))}
      </HStack>
      <HStack
        as="nav"
        aria-label="Docs sections"
        gap={0}
        bg="bg.subtle"
        borderRadius="md"
        p={1}
        display={{ base: 'flex', md: 'none' }}
      >
        {TABS.map((tab) => (
          <MobileTabLink key={tab.value} tab={tab} />
        ))}
      </HStack>
    </>
  );
}

function MobileTabLink({ tab }: { tab: TabDef }) {
  const active = useMatch(docsSectionPath(tab.value)) !== null;
  return (
    <Button
      asChild
      size="sm"
      variant={active ? 'solid' : 'ghost'}
      colorPalette={active ? 'blue' : 'gray'}
      flex="1"
      minH="40px"
    >
      <NavLink to={docsSectionPath(tab.value)}>{tab.label}</NavLink>
    </Button>
  );
}
