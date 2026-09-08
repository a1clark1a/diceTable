import { Badge, Box, Field, HStack, NativeSelect, Text, Wrap } from '@chakra-ui/react';
import { useCallback } from 'react';
import type { DicePart, Expression, KeepRule } from '../../types';
import type { ExpressionPatch } from '../../state/useApp';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import { NumberStepper, Panel, RuleChip } from './controls';

function countDice(parts: readonly DicePart[]): number {
  let total = 0;
  for (const part of parts) {
    if (Number.isInteger(part.count) && part.count > 0) total += part.count;
  }
  return total;
}

function defaultKeepAcross(dice: number): KeepRule {
  return { type: 'highest', n: Math.max(1, dice - 1) };
}

interface KeepAcrossFieldsProps {
  parts: DicePart[];
  keepAcross: KeepRule | undefined;
  onChange: (rule: KeepRule | undefined) => void;
  disabled?: boolean;
  disabledTip?: string;
}

export function KeepAcrossFields({
  parts,
  keepAcross,
  onChange,
  disabled = false,
  disabledTip = '',
}: KeepAcrossFieldsProps) {
  const dice = countDice(parts);

  const onToggle = useCallback(
    (on: boolean) => {
      onChange(on ? defaultKeepAcross(countDice(parts)) : undefined);
    },
    [onChange, parts],
  );

  const onTypeChange = useCallback(
    (type: KeepRule['type']) => {
      if (!keepAcross) return;
      onChange({ ...keepAcross, type });
    },
    [onChange, keepAcross],
  );

  const onCountChange = useCallback(
    (n: number) => {
      if (!keepAcross) return;
      onChange({ ...keepAcross, n });
    },
    [onChange, keepAcross],
  );

  return (
    <>
      <HStack gap={3} align="flex-start" flexWrap="wrap">
        <RuleChip
          label="Keep across parts"
          tip={tipForId('keepAcross')}
          active={keepAcross !== undefined}
          onToggle={onToggle}
          disabled={disabled}
          disabledTip={disabledTip}
        />

        {keepAcross && (
          <>
            <Field.Root maxW="140px">
              <Field.Label fontSize="xs" color="fg.muted">
                <HelpTerm tip={tipForId('keepAcrossDirection')}>Keep</HelpTerm>
              </Field.Label>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={keepAcross.type}
                  aria-label="Keep highest or lowest across parts"
                  onChange={(e) =>
                    onTypeChange(e.target.value === 'lowest' ? 'lowest' : 'highest')
                  }
                >
                  <option value="highest">highest</option>
                  <option value="lowest">lowest</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>

            <Box>
              <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap" mb={1}>
                <HelpTerm tip={tipForId('keepAcrossCount')}>How many (n)</HelpTerm>
              </Text>
              <HStack gap={2} align="center" flexWrap="wrap">
                <NumberStepper
                  value={keepAcross.n}
                  onCommit={onCountChange}
                  min={1}
                  max={Math.max(1, dice)}
                  ariaLabel="Dice to keep across parts"
                />
                <Text fontSize="sm" color="fg.muted">
                  of {dice === 1 ? '1 die' : `${dice} dice`}
                </Text>
              </HStack>
            </Box>
          </>
        )}
      </HStack>

      {keepAcross && (
        <HStack gap={2} align="center" flexWrap="wrap" mt={3}>
          <Text fontSize="xs" color="fg.muted">
            Dice in play
          </Text>
          <Wrap gap={1.5}>
            {parts.map((part) => (
              <Badge
                key={part.id}
                colorPalette="blue"
                variant="surface"
                fontFamily="mono"
              >
                {part.count > 1 ? `${part.count}d${part.sides}` : `d${part.sides}`}
              </Badge>
            ))}
          </Wrap>
        </HStack>
      )}
    </>
  );
}

interface KeepAcrossPanelProps {
  expression: Expression;
  updateExpression: (id: string, patch: ExpressionPatch) => void;
}

export function KeepAcrossPanel({
  expression,
  updateExpression,
}: KeepAcrossPanelProps) {
  const isPool = expression.mode === 'pool';

  const onChange = useCallback(
    (keepAcross: KeepRule | undefined) => {
      updateExpression(expression.id, { keepAcross });
    },
    [updateExpression, expression.id],
  );

  return (
    <Panel label="Keep across parts" tip={tipForId('keepAcross')}>
      <KeepAcrossFields
        parts={expression.parts}
        keepAcross={expression.keepAcross}
        onChange={onChange}
        disabled={isPool}
        disabledTip={tipForId('keepAcrossDisabledInPool')}
      />
    </Panel>
  );
}
