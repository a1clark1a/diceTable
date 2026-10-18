import { Box, HStack, Text } from '@chakra-ui/react';
import { StickyNote } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useBufferedValue } from '../../hooks/useBufferedValue';
import type { ExpressionPatch } from '../../state/useApp';
import { MAX_NOTE_LENGTH } from '../../types';
import { tipForId } from '../../docs/glossary';
import { FlushedInput } from '../FlushedInput';
import { HelpTerm } from '../ui/help-term';
import { TapTip } from './TapTip';
import { tapTarget } from '../tapTarget';

// The count only appears once it is worth reading, so a short note never
// carries a number beside it.
const COUNT_FROM = MAX_NOTE_LENGTH - 40;

function trimNote(raw: string): string {
  return raw.trim();
}

function asIs(text: string): string {
  return text;
}

interface NoteFieldProps {
  exprId: string;
  note: string | undefined;
  updateExpression: (id: string, patch: ExpressionPatch) => void;
}

export function NoteField({ exprId, note, updateExpression }: NoteFieldProps) {
  const committed = note ?? '';
  // A blur with nothing changed would still rebuild the row, and a new row
  // object is a recomputed distribution, so an unchanged note is not committed.
  const commit = useCallback(
    (raw: string) => {
      if (raw === committed) return;
      updateExpression(exprId, { note: raw });
    },
    [committed, exprId, updateExpression],
  );
  const buf = useBufferedValue<string>({
    committed,
    commit,
    parse: trimNote,
    format: asIs,
  });
  const length = buf.value.length;
  const countId = useId();
  const showCount = length >= COUNT_FROM;

  return (
    <Box mt={3}>
      <HStack justify="space-between" mb={1}>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
        >
          <HelpTerm tip={tipForId('note')}>Note</HelpTerm>
        </Text>
        {showCount && (
          <Text
            id={countId}
            fontSize="2xs"
            fontFamily="mono"
            color={length >= MAX_NOTE_LENGTH ? 'fg' : 'fg.muted'}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {length}/{MAX_NOTE_LENGTH}
          </Text>
        )}
      </HStack>
      <FlushedInput
        size="sm"
        h={tapTarget('32px')}
        value={buf.value}
        onChange={(e) => buf.setValue(e.target.value)}
        onBlur={buf.onBlur}
        onKeyDown={buf.onKeyDown}
        maxLength={MAX_NOTE_LENGTH}
        placeholder="Why this roll exists"
        aria-label="Roll note"
        aria-describedby={showCount ? countId : undefined}
      />
    </Box>
  );
}

/**
 * Marks a row that carries a note. The note itself is the tooltip, so it is a
 * tab stop: a tooltip only keyboard users could never open would hide the text.
 * A tap holds it open too, since the table also shows on touch tablets. An
 * img role is what lets the span carry a name at all.
 */
export function NoteMarker({ note }: { note: string }) {
  return (
    <TapTip tip={note}>
      <Box
        as="span"
        role="img"
        tabIndex={0}
        aria-label={`Note: ${note}`}
        color="fg.muted"
        lineHeight={0}
        flexShrink={0}
        borderRadius="sm"
        cursor="help"
        _focusVisible={{ outline: '2px solid', outlineColor: 'colorPalette.solid' }}
      >
        <StickyNote size={14} aria-hidden />
      </Box>
    </TapTip>
  );
}
