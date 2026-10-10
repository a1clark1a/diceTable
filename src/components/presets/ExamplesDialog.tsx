import { useState } from 'react';
import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  Input,
  InputGroup,
  Portal,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Search } from 'lucide-react';
import { useApp } from '../../state/useApp';
import { STARTER_ROWS, type RecipeFamily } from '../../presets/starterRolls';
import { RECIPES, filterRecipes } from '../../presets/recipes';
import { PresetCardGrid } from './PresetCardGrid';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';
import { chipFocusRing } from '../editor/focusRings';

interface ExamplesDialogProps {
  // Controlled when `open` is supplied, which also drops the built-in trigger:
  // the page owns one instance and opens it from several buttons and a menu
  // item, none of which can host a Dialog.Trigger.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ExamplesDialog({ open, onOpenChange }: ExamplesDialogProps) {
  const { addExpressions } = useApp();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => setOpen(e.open)}
      lazyMount
      unmountOnExit
      // Top-anchored from md: centred, the dialog re-centred on every keystroke
      // that changed the result count, moving the search field under the caret.
      placement={{ mdDown: 'center', md: 'top' }}
      scrollBehavior="inside"
      size={{ mdDown: 'full', md: 'lg' }}
    >
      {!controlled && (
        <Tooltip content={tipForId('examples')} disabled={isOpen}>
          <Dialog.Trigger asChild>
            <Button size="sm" variant="outline" minH="48px">
              <Search size={16} />
              Find a roll
            </Button>
          </Dialog.Trigger>
        </Tooltip>
      )}
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Find a roll</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <RecipeLibrary />
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                colorPalette="blue"
                minH={{ base: '48px', md: '44px' }}
                w={{ base: 'full', md: 'auto' }}
                onClick={() => {
                  addExpressions([...STARTER_ROWS]);
                  setOpen(false);
                }}
              >
                Load the starter set
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

const FAMILY_FILTERS: readonly { value: RecipeFamily | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'totals', label: 'Add it up' },
  { value: 'successes', label: 'Count successes' },
  { value: 'advantage', label: 'Best or worst of' },
  { value: 'opposed', label: 'Head to head' },
  { value: 'margin', label: 'Beat a number' },
];

// Lives inside the dialog body so the search resets each time the dialog
// closes (the content unmounts on exit), and so the cards, which compute their
// stats as they render, cost nothing until someone opens the library.
function RecipeLibrary() {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<RecipeFamily | null>(null);
  const shown = filterRecipes(RECIPES, query, family);
  const trimmed = query.trim();

  return (
    <Stack gap={4}>
      <Text fontSize="sm" color="fg.muted">
        Search by game, rule or dice. Adding one puts it at the bottom of your
        table, where you can rename it, change the dice, or delete it.
      </Text>
      {/* Pinned while the cards scroll, so narrowing the search never means
          scrolling back up. Only from md: on a phone three rows of chips would
          hold a third of the screen for good. */}
      <Stack
        gap={4}
        position={{ base: 'static', md: 'sticky' }}
        // Sticky measures from inside the body's 8px top padding, which left
        // a strip of scrolled cards showing above the search field.
        top={-2}
        zIndex={1}
        bg="bg.panel"
        pt={{ base: 0, md: 2 }}
        mt={{ base: 0, md: -2 }}
        pb={{ base: 0, md: 3 }}
        borderBottomWidth={{ base: '0', md: '1px' }}
        borderColor="border"
      >
        <InputGroup startElement={<Search size={16} />} w="full">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Blades, advantage, 4d6…"
            aria-label="Search rolls"
            minH="44px"
            // The gray palette's ring measures 2.5:1 on the panel; the chips
            // below ring in this blue too.
            focusRingColor="blue.solid"
          />
        </InputGroup>
        <Flex gap={2} wrap="wrap" role="group" aria-label="Filter by kind of roll">
          {FAMILY_FILTERS.map((f) => {
            const isActive = family === f.value;
            return (
              <Button
                key={f.label}
                size="sm"
                variant={isActive ? 'solid' : 'outline'}
                colorPalette={isActive ? 'blue' : 'gray'}
                aria-pressed={isActive}
                minH="40px"
                _focusVisible={chipFocusRing}
                onClick={() => setFamily(f.value)}
              >
                {f.label}
              </Button>
            );
          })}
        </Flex>
        <Text fontSize="xs" color="fg.muted" aria-live="polite">
          {shown.length === 1 ? '1 result' : `${shown.length} results`}
        </Text>
      </Stack>
      {shown.length > 0 ? (
        <PresetCardGrid presets={shown} />
      ) : (
        <Box py={6} textAlign="center">
          <Text fontSize="sm">
            {trimmed.length > 0
              ? `Nothing matches “${trimmed}”.`
              : 'Nothing in this group yet.'}
          </Text>
          <Text fontSize="xs" color="fg.muted" mt={1}>
            Try a game name, or a word like advantage or explode.
          </Text>
        </Box>
      )}
    </Stack>
  );
}
