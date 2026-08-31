import {
  Box,
  Button,
  HStack,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Plus } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useApp, type PartPatch } from '../state/useApp';
import type { DicePart, Expression, ExpressionMode, RollMode } from '../types';
import { CheckEditor } from './editor/CheckEditor';
import { DicePartRow } from './editor/DicePartRow';
import { KeepAcrossPanel } from './editor/KeepAcrossPanel';
import { Panel } from './editor/controls';
import { ExpressionDiceText } from './editor/ExpressionRender';
import { Tooltip } from './ui/tooltip';
import { tipForId } from '../docs/glossary';

const ROLL_MODES: { value: RollMode; label: string; tip: string }[] = [
  { value: 'normal', label: 'Normal', tip: tipForId('rollModeNormal') },
  { value: 'advantage', label: 'Advantage', tip: tipForId('rollModeAdvantage') },
  { value: 'disadvantage', label: 'Disadvantage', tip: tipForId('rollModeDisadvantage') },
];

interface RollExpandProps {
  expression: Expression;
}

interface PartRowProps {
  exprId: string;
  part: DicePart;
  mode: ExpressionMode;
  keepAcrossActive: boolean;
  canRemove: boolean;
  updatePart: (exprId: string, partId: string, patch: PartPatch) => void;
  removePart: (exprId: string, partId: string) => void;
}

// memo(DicePartRow) can only bail for unedited parts if its onChange/onRemove
// are referentially stable across commits. Binding them per-part inside the
// .map would create fresh closures every render; lifting each part into its
// own memoized component lets useCallback hold them stable (one hook per
// instance, not a hook in a loop).
const PartRow = memo(function PartRow({
  exprId,
  part,
  mode,
  keepAcrossActive,
  canRemove,
  updatePart,
  removePart,
}: PartRowProps) {
  const partId = part.id;
  const onChange = useCallback(
    (patch: PartPatch) => updatePart(exprId, partId, patch),
    [updatePart, exprId, partId],
  );
  const onRemove = useCallback(
    () => removePart(exprId, partId),
    [removePart, exprId, partId],
  );
  return (
    <DicePartRow
      part={part}
      mode={mode}
      keepAcrossActive={keepAcrossActive}
      onChange={onChange}
      onRemove={onRemove}
      canRemove={canRemove}
    />
  );
});

export function RollExpand({ expression }: RollExpandProps) {
  const { addPart, removePart, updatePart, updateExpression } = useApp();
  const isPool = expression.mode === 'pool';
  const check = expression.mode === 'check' ? expression.check : undefined;

  return (
    <Box bg="bg.subtle" p={{ base: 3, md: 4 }}>
      {/* On the desktop table the editor sits in a full-width colSpan row; a
          centered 640px block reads as an orphaned island, so on lg we widen it
          and left-align it under the row's first columns to tie it to its row. */}
      <Stack
        gap={3}
        w="full"
        maxW={{ base: '640px', lg: '52rem' }}
        mx={{ base: 'auto', lg: '0' }}
      >
        <Box pb={3} borderBottomWidth="1px" borderColor="border.subtle">
          <Box px={3}>
            <Text
              fontSize="xs"
              fontWeight="semibold"
              color="fg.muted"
              textTransform="uppercase"
              letterSpacing="wider"
              mb={1}
            >
              Formula
            </Text>
            <Box
              fontFamily="mono"
              fontSize="lg"
              color="fg"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              <ExpressionDiceText expr={expression} showRollMode />
            </Box>
          </Box>
        </Box>

        {check ? (
          <CheckEditor
            expression={expression}
            check={check}
            updateExpression={updateExpression}
            updatePart={updatePart}
            addPart={addPart}
            removePart={removePart}
          />
        ) : (
          <>
          <Panel label="Dice parts">
            <Stack gap={2}>
              {expression.parts.map((part) => (
                <PartRow
                  key={part.id}
                  exprId={expression.id}
                  part={part}
                  mode={expression.mode}
                  keepAcrossActive={expression.keepAcross !== undefined}
                  canRemove={expression.parts.length > 1}
                  updatePart={updatePart}
                  removePart={removePart}
                />
              ))}
            </Stack>
            <Button
              size="sm"
              variant="outline"
              mt={3}
              onClick={() => addPart(expression.id)}
            >
              <Plus size={14} />
              Add part
            </Button>
          </Panel>

          <KeepAcrossPanel
            expression={expression}
            updateExpression={updateExpression}
          />
          </>
        )}

        <Panel label="Roll mode" tip={tipForId('rollMode')}>
          <HStack
            gap={0}
            bg="bg.subtle"
            borderRadius="md"
            p={1}
            display="inline-flex"
            role="group"
            aria-label="Roll mode"
          >
            {/* aria-disabled + data-disabled instead of the native attribute so
                pool rows keep the chips hoverable and focusable and the "why"
                tooltip stays discoverable; data-disabled applies the recipe's
                disabled styling and suppresses hover feedback. */}
            {ROLL_MODES.map((m) => {
              const active = expression.rollMode === m.value;
              return (
                <Tooltip
                  key={m.value}
                  content={isPool ? tipForId('rollModeIgnoredInPool') : m.tip}
                >
                  <Button
                    size="sm"
                    variant={active ? 'solid' : 'ghost'}
                    colorPalette={active ? 'blue' : 'gray'}
                    onClick={() => {
                      if (!isPool) {
                        updateExpression(expression.id, { rollMode: m.value });
                      }
                    }}
                    aria-pressed={active}
                    aria-label={m.label}
                    aria-disabled={isPool || undefined}
                    data-disabled={isPool ? '' : undefined}
                  >
                    {m.label}
                  </Button>
                </Tooltip>
              );
            })}
          </HStack>
        </Panel>
      </Stack>
    </Box>
  );
}
