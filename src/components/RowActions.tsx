import { useCallback, useState } from 'react';
import { Button, HStack, IconButton } from '@chakra-ui/react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useApp } from '../state/useApp';
import { MAX_EXPRESSIONS } from '../types';
import { Tooltip } from './ui/tooltip';
import { tipForId } from '../docs/glossary';
import { ExamplesDialog } from './presets/ExamplesDialog';
import { ClearAllDialog } from './ClearAllDialog';
import { useIsDesktop } from '../hooks/useBreakpoint';

/**
 * Adding, seeding and clearing act on the rows, so they sit with the data
 * rather than in the page chrome. Every view that can show rows renders this
 * same element. Phones reach Add roll and Clear through the sticky toolbar's
 * overflow menu, but Find a roll stays here as a labelled button: someone
 * hunting for their game's roll would never think to look behind a "more"
 * button, and the sticky bar has no room left for it on a phone.
 */
export function RowActions() {
  const isDesktop = useIsDesktop();
  const { expressions, addExpression } = useApp();
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const hasRows = expressions.length > 0;
  const atCap = expressions.length >= MAX_EXPRESSIONS;

  const onAdd = useCallback(() => {
    if (!atCap) addExpression();
  }, [addExpression, atCap]);

  if (!isDesktop && !hasRows) return null;

  return (
    <HStack gap={2} flexShrink={0}>
      {isDesktop && (
        <Tooltip
          content={`Up to ${MAX_EXPRESSIONS} rolls. Delete a row to add another.`}
          disabled={!atCap}
        >
          <Button
            size="sm"
            colorPalette="blue"
            h="32px"
            onClick={onAdd}
            disabled={atCap}
          >
            <Plus size={16} />
            Add roll
          </Button>
        </Tooltip>
      )}
      {hasRows && (
        <>
          <Tooltip content={tipForId('examples')}>
            <Button
              size="sm"
              variant="outline"
              h={{ base: '40px', md: '32px' }}
              onClick={() => setExamplesOpen(true)}
            >
              <Search size={16} />
              Find a roll
            </Button>
          </Tooltip>
          {isDesktop && (
            <Tooltip content={tipForId('clearAll')}>
              <IconButton
                size="sm"
                variant="ghost"
                h="32px"
                minW="32px"
                aria-label="Clear all rolls"
                onClick={() => setClearOpen(true)}
              >
                <Trash2 size={16} />
              </IconButton>
            </Tooltip>
          )}
        </>
      )}
      <ExamplesDialog open={examplesOpen} onOpenChange={setExamplesOpen} />
      <ClearAllDialog open={clearOpen} onOpenChange={setClearOpen} />
    </HStack>
  );
}
