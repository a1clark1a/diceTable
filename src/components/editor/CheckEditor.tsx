import {
  Box,
  Button,
  Field,
  HStack,
  NativeSelect,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Plus } from 'lucide-react';
import { memo, useCallback } from 'react';
import type {
  CheckSpec,
  CritEffect,
  DicePart,
  EffectScale,
  Expression,
  KeepRule,
} from '../../types';
import type { ExpressionPatch, PartPatch } from '../../state/useApp';
import { isSingleDieCheck } from '../../engine/critEffect';
import { getRowData } from '../../state/useDistributions';
import { applyPartPatch, newId } from '../../state/defaultPart';
import { formatWholePercent } from '../chart/format';
import { hitColor } from '../chart/palette';
import { HelpTerm } from '../ui/help-term';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';
import { DicePartRow } from './DicePartRow';
import { KeepAcrossFields } from './KeepAcrossPanel';
import { FacePicker, NumberStepper, Panel, RuleCard, RuleChip } from './controls';
import { chipFocusRing } from './focusRings';

const SCALE_OPTIONS: { value: EffectScale; label: string }[] = [
  { value: 'none', label: 'Nothing' },
  { value: 'half', label: 'Half' },
  { value: 'full', label: 'Full' },
];

const CRIT_EFFECT_OPTIONS: { value: CritEffect; label: string }[] = [
  { value: 'doubleDice', label: 'Roll double the dice' },
  { value: 'extraDie', label: 'Roll one extra die' },
  { value: 'maxPlusRoll', label: 'Add the highest the dice can show' },
];

function defaultEffectPart(): DicePart {
  return { id: newId('part'), count: 1, sides: 6 };
}

interface CheckPartRowProps {
  exprId: string;
  part: DicePart;
  canRemove: boolean;
  updatePart: (exprId: string, partId: string, patch: PartPatch) => void;
  removePart: (exprId: string, partId: string) => void;
}

// Same reason RollExpand lifts its rows out of the .map: memo(DicePartRow) can
// only bail when its callbacks keep the same identity across commits.
const CheckPartRow = memo(function CheckPartRow({
  exprId,
  part,
  canRemove,
  updatePart,
  removePart,
}: CheckPartRowProps) {
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
      mode="check"
      keepAcrossActive={false}
      onChange={onChange}
      onRemove={onRemove}
      canRemove={canRemove}
    />
  );
});

interface EffectPartRowProps {
  part: DicePart;
  keepAcrossActive: boolean;
  canRemove: boolean;
  onPartChange: (partId: string, patch: PartPatch) => void;
  onPartRemove: (partId: string) => void;
}

// Same reason RollExpand lifts its rows out of the .map: memo(DicePartRow) can
// only bail when its callbacks keep the same identity across commits.
const EffectPartRow = memo(function EffectPartRow({
  part,
  keepAcrossActive,
  canRemove,
  onPartChange,
  onPartRemove,
}: EffectPartRowProps) {
  const partId = part.id;
  const onChange = useCallback(
    (patch: PartPatch) => onPartChange(partId, patch),
    [onPartChange, partId],
  );
  const onRemove = useCallback(() => onPartRemove(partId), [onPartRemove, partId]);
  return (
    <DicePartRow
      part={part}
      mode="sum"
      keepAcrossActive={keepAcrossActive}
      onChange={onChange}
      onRemove={onRemove}
      canRemove={canRemove}
    />
  );
});

interface ScaleChipsProps {
  value: EffectScale;
  onSelect: (scale: EffectScale) => void;
  ariaLabel: string;
}

function ScaleChips({ value, onSelect, ariaLabel }: ScaleChipsProps) {
  return (
    <HStack
      gap={0}
      mt={2}
      p={1}
      bg="bg.subtle"
      // The card underneath is already bg.subtle, so the track needs an outline
      // to read as one control rather than three loose buttons.
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      display="inline-flex"
      role="group"
      aria-label={ariaLabel}
    >
      {SCALE_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <Button
            key={option.value}
            size="sm"
            h="40px"
            px={4}
            fontWeight="semibold"
            variant={active ? 'solid' : 'ghost'}
            colorPalette={active ? 'blue' : 'gray'}
            aria-pressed={active}
            aria-label={`${ariaLabel}: ${option.label}`}
            _focusVisible={chipFocusRing}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </HStack>
  );
}

interface CheckEditorProps {
  expression: Expression;
  check: CheckSpec;
  updateExpression: (id: string, patch: ExpressionPatch) => void;
  updatePart: (exprId: string, partId: string, patch: PartPatch) => void;
  addPart: (exprId: string) => void;
  removePart: (exprId: string, partId: string) => void;
}

export function CheckEditor({
  expression,
  check,
  updateExpression,
  updatePart,
  addPart,
  removePart,
}: CheckEditorProps) {
  const exprId = expression.id;
  const effect = check.effect;
  const checkDie = expression.parts[0];
  const critAvailable = isSingleDieCheck(expression.parts);
  // The row-data cache already holds the odds for the table's chip; reading the
  // same entry here means an effect edit never re-runs the check convolution.
  // Null means the odds are not computable (too complex), and the readouts say
  // so instead of claiming a confident 0%.
  const chances = getRowData(expression).checkChances;
  const succeeds = chances === null ? null : chances.success + chances.crit;

  const patchCheck = useCallback(
    (next: CheckSpec) => updateExpression(exprId, { check: next }),
    [updateExpression, exprId],
  );

  const onCheckPartAdd = useCallback(() => addPart(exprId), [addPart, exprId]);

  const onModifierChange = useCallback(
    (flatModifier: number) => updateExpression(exprId, { flatModifier }),
    [updateExpression, exprId],
  );

  const onDirectionChange = useCallback(
    (direction: 'gte' | 'lte') => {
      patchCheck({ ...check, threshold: { ...check.threshold, direction } });
    },
    [patchCheck, check],
  );

  const onThresholdChange = useCallback(
    (value: number) => {
      patchCheck({ ...check, threshold: { ...check.threshold, value } });
    },
    [patchCheck, check],
  );

  const onEffectPartChange = useCallback(
    (partId: string, patch: PartPatch) => {
      const parts = effect.parts.map((p) => (p.id === partId ? applyPartPatch(p, patch) : p));
      patchCheck({ ...check, effect: { ...effect, parts } });
    },
    [patchCheck, check, effect],
  );

  const onEffectPartRemove = useCallback(
    (partId: string) => {
      patchCheck({
        ...check,
        effect: { ...effect, parts: effect.parts.filter((p) => p.id !== partId) },
      });
    },
    [patchCheck, check, effect],
  );

  const onEffectPartAdd = useCallback(() => {
    patchCheck({
      ...check,
      effect: { ...effect, parts: [...effect.parts, defaultEffectPart()] },
    });
  }, [patchCheck, check, effect]);

  const onEffectModifierChange = useCallback(
    (flatModifier: number) => {
      patchCheck({ ...check, effect: { ...effect, flatModifier } });
    },
    [patchCheck, check, effect],
  );

  const onEffectKeepAcrossChange = useCallback(
    (keepAcross: KeepRule | undefined) => {
      const nextEffect = { ...effect };
      if (keepAcross) nextEffect.keepAcross = keepAcross;
      else delete nextEffect.keepAcross;
      patchCheck({ ...check, effect: nextEffect });
    },
    [patchCheck, check, effect],
  );

  const onSuccessChange = useCallback(
    (onSuccess: EffectScale) => patchCheck({ ...check, onSuccess }),
    [patchCheck, check],
  );

  const onFailureChange = useCallback(
    (onFailure: EffectScale) => patchCheck({ ...check, onFailure }),
    [patchCheck, check],
  );

  const onCritToggle = useCallback(
    (on: boolean) => {
      const next: CheckSpec = { ...check };
      if (on) {
        const sides = checkDie?.sides ?? 20;
        next.crit = { onFaces: [sides], effect: 'doubleDice' };
      } else {
        delete next.crit;
      }
      patchCheck(next);
    },
    [patchCheck, check, checkDie],
  );

  const onCritFacesChange = useCallback(
    (onFaces: number[]) => {
      const crit = check.crit;
      if (!crit) return;
      const next: CheckSpec = { ...check };
      // A critical with no faces can never happen, so clearing the last face
      // turns the rule off rather than storing something inert.
      if (onFaces.length === 0) delete next.crit;
      else next.crit = { ...crit, onFaces };
      patchCheck(next);
    },
    [patchCheck, check],
  );

  const onCritEffectChange = useCallback(
    (critEffect: CritEffect) => {
      const crit = check.crit;
      if (!crit) return;
      patchCheck({ ...check, crit: { ...crit, effect: critEffect } });
    },
    [patchCheck, check],
  );

  return (
    <Stack gap={3}>
      <Panel label="Check" tip={tipForId('checkMode')}>
        <Stack gap={3}>
          {/* Every part of the row rolls in the check, so every part is
              editable here; hiding all but the first would leave dice rolling
              in the math with no control that can reach them. */}
          <Stack gap={2}>
            {expression.parts.map((part) => (
              <CheckPartRow
                key={part.id}
                exprId={exprId}
                part={part}
                canRemove={expression.parts.length > 1}
                updatePart={updatePart}
                removePart={removePart}
              />
            ))}
          </Stack>

          <Button
            size="sm"
            variant="outline"
            alignSelf="flex-start"
            onClick={onCheckPartAdd}
          >
            <Plus size={14} />
            Add part
          </Button>

          <HStack gap={3} align="flex-end" flexWrap="wrap">
            <Box>
              <Text fontSize="xs" color="fg.muted" mb={1}>
                <HelpTerm tip={tipForId('checkModifier')}>Modifier</HelpTerm>
              </Text>
              <NumberStepper
                value={expression.flatModifier}
                onCommit={onModifierChange}
                min={-99}
                max={99}
                ariaLabel="Check modifier"
              />
            </Box>

            <Box>
              <Text fontSize="xs" color="fg.muted" mb={1}>
                <HelpTerm tip={tipForId('checkThreshold')}>Succeeds when</HelpTerm>
              </Text>
              <HStack gap={2} align="center" flexWrap="wrap">
                <NativeSelect.Root size="md" w="130px">
                  <NativeSelect.Field
                    value={check.threshold.direction}
                    aria-label="Success direction"
                    onChange={(e) =>
                      onDirectionChange(e.target.value === 'lte' ? 'lte' : 'gte')
                    }
                  >
                    <option value="gte">at least</option>
                    <option value="lte">at most</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <NumberStepper
                  value={check.threshold.value}
                  onCommit={onThresholdChange}
                  min={1}
                  max={999}
                  ariaLabel="Success threshold"
                />
              </HStack>
            </Box>

            {succeeds === null ? (
              <HStack gap={1} align="baseline" h="40px">
                <Text fontSize="xs" color="fg.muted">
                  (too complex)
                </Text>
              </HStack>
            ) : (
              <Tooltip content={tipForId('checkSucceeds')}>
                <HStack gap={1} align="baseline" h="40px" tabIndex={0} cursor="help">
                  <Text
                    fontSize="lg"
                    fontWeight="semibold"
                    fontFamily="mono"
                    color={hitColor(succeeds)}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatWholePercent(succeeds)}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    succeed
                  </Text>
                </HStack>
              </Tooltip>
            )}
          </HStack>

          <Text fontSize="xs" color="fg.muted">
            Advantage and disadvantage apply to this roll, not to the effect.
          </Text>
        </Stack>
      </Panel>

      <Panel label="Effect" tip={tipForId('checkEffect')}>
        <Stack gap={2}>
          {effect.parts.map((part) => (
            <EffectPartRow
              key={part.id}
              part={part}
              keepAcrossActive={effect.keepAcross !== undefined}
              canRemove={effect.parts.length > 1}
              onPartChange={onEffectPartChange}
              onPartRemove={onEffectPartRemove}
            />
          ))}
        </Stack>

        <Button size="sm" variant="outline" mt={3} onClick={onEffectPartAdd}>
          <Plus size={14} />
          Add part
        </Button>

        <Box mt={3}>
          <Text fontSize="xs" color="fg.muted" mb={1}>
            Modifier
          </Text>
          <NumberStepper
            value={effect.flatModifier}
            onCommit={onEffectModifierChange}
            min={-99}
            max={99}
            ariaLabel="Effect modifier"
          />
        </Box>

        {/* Ruled off so the rule reads as its own sub-section rather than a chip
            loose under the modifier. */}
        <Box mt={3} pt={3} borderTopWidth="1px" borderColor="border.subtle">
          <KeepAcrossFields
            parts={effect.parts}
            keepAcross={effect.keepAcross}
            onChange={onEffectKeepAcrossChange}
          />
        </Box>
      </Panel>

      <Panel label="Outcomes" tip={tipForId('effectScale')}>
        <Stack gap={3}>
          <RuleCard heading="On a success" accent="orange.solid">
            <ScaleChips
              value={check.onSuccess}
              onSelect={onSuccessChange}
              ariaLabel="Effect on a success"
            />
          </RuleCard>

          <RuleCard heading="On a failure" accent="orange.solid">
            <ScaleChips
              value={check.onFailure}
              onSelect={onFailureChange}
              ariaLabel="Effect on a failure"
            />
          </RuleCard>

          <RuleCard heading="Critical" accent="orange.solid">
            {/* A critical needs a face to read, so on a multi-die check the
                control gives way to the reason instead of sitting switched off
                with no explanation. */}
            {!critAvailable ? (
              <Text fontSize="xs" color="fg.muted" mt={2}>
                {tipForId('critNeedsOneDie')}
              </Text>
            ) : (
              <Stack gap={3} mt={2} align="flex-start">
                <RuleChip
                  label="Critical"
                  tip={tipForId('crit')}
                  active={check.crit !== undefined}
                  onToggle={onCritToggle}
                />
                {check.crit && checkDie && (
                  <>
                    <Box>
                      <Text fontSize="xs" color="fg.muted" mb={1}>
                        Faces
                      </Text>
                      <FacePicker
                        sides={checkDie.sides}
                        selected={check.crit.onFaces}
                        onChange={onCritFacesChange}
                        ariaLabel="Critical faces"
                      />
                    </Box>
                    <Field.Root maxW="280px">
                      <Field.Label fontSize="xs" color="fg.muted">
                        <HelpTerm tip={tipForId('critEffect')}>
                          What a critical does
                        </HelpTerm>
                      </Field.Label>
                      <NativeSelect.Root size="md">
                        <NativeSelect.Field
                          value={check.crit.effect}
                          aria-label="What a critical does"
                          onChange={(e) => {
                            const value = e.target.value;
                            onCritEffectChange(
                              value === 'extraDie' || value === 'maxPlusRoll'
                                ? value
                                : 'doubleDice',
                            );
                          }}
                        >
                          {CRIT_EFFECT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Field.Root>
                    {chances !== null && (
                      <Text fontSize="xs" color="fg.muted">
                        Crits on {formatWholePercent(chances.crit)} of rolls.
                      </Text>
                    )}
                  </>
                )}
              </Stack>
            )}
          </RuleCard>
        </Stack>
      </Panel>

      <Box
        bg="orange.subtle"
        borderWidth="1px"
        borderColor="orange.muted"
        borderRadius="md"
        px={3}
        py={2}
      >
        <Text fontSize="sm" color="fg" css={{ textWrap: 'pretty' }}>
          {chances === null
            ? 'Too complex to compute the odds'
            : `Succeeds ${formatWholePercent(chances.success + chances.crit)} of the time${
                check.crit ? `, crits ${formatWholePercent(chances.crit)}` : ''
              }`}
          . On a success:{' '}
          {SCALE_OPTIONS.find((o) => o.value === check.onSuccess)?.label.toLowerCase()}.
          On a failure:{' '}
          {SCALE_OPTIONS.find((o) => o.value === check.onFailure)?.label.toLowerCase()}.
        </Text>
      </Box>
    </Stack>
  );
}
