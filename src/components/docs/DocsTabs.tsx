import { Button, HStack, chakra } from '@chakra-ui/react';
import type { DocsTab } from './docs-tab';

const TabButton = chakra('button');

interface TabDef {
  value: DocsTab;
  label: string;
}

const TABS: readonly TabDef[] = [
  { value: 'quickstart', label: 'Quickstart' },
  { value: 'glossary', label: 'Glossary' },
  { value: 'math', label: 'The Math' },
];

interface DocsTabsProps {
  value: DocsTab;
  onChange: (value: DocsTab) => void;
}

export function DocsTabs({ value, onChange }: DocsTabsProps) {
  return (
    <>
      <HStack
        as="nav"
        role="tablist"
        aria-label="Docs sections"
        gap={1}
        borderBottomWidth="1px"
        borderColor="border.subtle"
        display={{ base: 'none', md: 'flex' }}
      >
        {TABS.map((tab) => {
          const active = tab.value === value;
          return (
            <TabButton
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              px={4}
              py={2.5}
              fontSize="sm"
              fontWeight="medium"
              color={active ? 'fg' : 'fg.muted'}
              bg="transparent"
              borderBottomWidth="2px"
              borderColor={active ? 'colorPalette.solid' : 'transparent'}
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
            >
              {tab.label}
            </TabButton>
          );
        })}
      </HStack>
      <HStack
        role="tablist"
        aria-label="Docs sections"
        gap={0}
        bg="bg.subtle"
        borderRadius="md"
        p={1}
        display={{ base: 'flex', md: 'none' }}
      >
        {TABS.map((tab) => {
          const active = tab.value === value;
          return (
            <Button
              key={tab.value}
              role="tab"
              aria-selected={active}
              size="sm"
              variant={active ? 'solid' : 'ghost'}
              colorPalette={active ? 'blue' : 'gray'}
              onClick={() => onChange(tab.value)}
              flex="1"
              minH="40px"
            >
              {tab.label}
            </Button>
          );
        })}
      </HStack>
    </>
  );
}
