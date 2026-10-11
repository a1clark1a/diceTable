import { Button, Text, type InputProps } from '@chakra-ui/react';
import { useCallback } from 'react';
import type { Expression } from '../../types';
import { useApp } from '../../state/useApp';
import { modsForModifier, singleModifier } from '../../state/modChain';
import { useBufferedValue } from '../../hooks/useBufferedValue';
import { modStepAria, modsCompact } from '../../share/notation';
import { tipForId } from '../../docs/glossary';
import { FlushedInput } from '../FlushedInput';
import { Tooltip } from '../ui/tooltip';
import { flushedFocusRing } from './focusRings';
import { tapTarget } from '../tapTarget';
import { focusModChain } from './modChainFocus';

function parseMod(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '+' || trimmed === '-') return 0;
  const n = Number.parseInt(trimmed.replace(/^\+/, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function formatMod(n: number): string {
  return String(n);
}

interface ModBoxProps {
  expr: Expression;
  size: InputProps['size'];
  h: InputProps['h'];
  /** Shown on the box itself; the cards put their tip on the label instead. */
  tip?: string | undefined;
  /** Brings the row's editor up, where a longer chain is changed step by step. */
  onOpenChain: () => void;
}

/**
 * The Mod cell. A check row's modifier, or a chain that is just one add or
 * subtract, is a number to type, as it always was. A chain that does more
 * cannot be typed without a notation to learn, so the cell reads it out and
 * opens the editor instead.
 */
export function ModBox({ expr, size, h, tip, onOpenChain }: ModBoxProps) {
  const { updateExpression } = useApp();
  const isCheck = expr.mode === 'check';
  const single = isCheck ? expr.flatModifier : singleModifier(expr.mods);

  const onCommit = useCallback(
    (value: number) =>
      updateExpression(
        expr.id,
        isCheck ? { flatModifier: value } : { mods: modsForModifier(value) },
      ),
    [updateExpression, expr.id, isCheck],
  );
  const buf = useBufferedValue<number>({
    committed: single ?? 0,
    commit: onCommit,
    parse: parseMod,
    format: formatMod,
  });

  if (single === null && expr.mods !== undefined) {
    const pool = expr.mode === 'pool';
    const spoken = expr.mods.map((s) => modStepAria(s, pool)).join(', then ');
    return (
      <Tooltip content={tipForId(pool ? 'modChainPoolCell' : 'modChainCell')}>
        <Button
          variant="ghost"
          size={size === 'xs' ? 'xs' : 'sm'}
          h={h}
          px={1}
          maxW="64px"
          minW={tapTarget('32px')}
          ml="auto"
          fontFamily="mono"
          fontWeight="normal"
          justifyContent="flex-end"
          // The flushed inputs around it carry this line, and without it a
          // chain reads as static text rather than a cell that opens.
          borderWidth="0"
          borderBottomWidth="1px"
          borderColor="border"
          borderRadius="4px"
          _hover={{ bg: 'bg.subtle' }}
          _focusVisible={flushedFocusRing}
          onClick={() => {
            focusModChain(expr.id);
            onOpenChain();
          }}
          aria-label={`Modifier steps: ${spoken}. Open the roll to change them.`}
        >
          <Text as="span" truncate>
            {modsCompact(expr.mods)}
          </Text>
        </Button>
      </Tooltip>
    );
  }

  const input = (
    <FlushedInput
      size={size}
      h={h}
      type="text"
      inputMode="numeric"
      value={buf.value}
      onChange={(e) => buf.setValue(e.target.value)}
      onBlur={buf.onBlur}
      onKeyDown={buf.onKeyDown}
      maxW="64px"
      textAlign="end"
      fontFamily="mono"
      aria-label="Modifier"
      ml="auto"
    />
  );
  return tip === undefined ? input : <Tooltip content={tip}>{input}</Tooltip>;
}
