import {
  Box,
  Button,
  Field,
  HStack,
  IconButton,
  NativeSelect,
  Stack,
  Text,
  Wrap,
} from '@chakra-ui/react';
import { Trash2 } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import type {
  DicePart,
  ExplodeRule,
  ExpressionMode,
  KeepRule,
  RerollRule,
} from '../../types';
import type { PartPatch } from '../../state/useApp';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import { validatePart } from './validatePart';
import { FacePicker, NumberStepper, RuleCard, RuleChip } from './controls';
import { chipFocusRing } from './focusRings';

function defaultKeep(part: DicePart): KeepRule {
  const safeCount = Math.max(1, part.count);
  return { type: 'highest', n: Math.max(1, safeCount - 1) };
}

function defaultReroll(): RerollRule {
  return { values: [1], mode: 'once' };
}

function defaultExplode(part: DicePart): ExplodeRule {
  const safeSides = Math.max(2, part.sides);
  return { onFaces: [safeSides], depthCap: 10 };
}

function clampFacesToSides(faces: number[], sides: number): number[] {
  const limit = Number.isInteger(sides) && sides >= 2 ? sides : 0;
  return faces.filter((f) => f >= 1 && f <= limit);
}

const STANDARD_DICE: readonly number[] = [4, 6, 8, 10, 12, 20, 100];

interface KeepRuleEditorProps {
  keep: KeepRule;
  errorKeepN: string | undefined;
  onChange: (patch: PartPatch) => void;
}

function KeepRuleEditor({ keep, errorKeepN, onChange }: KeepRuleEditorProps) {
  return (
    <HStack gap={3} mt={2} align="flex-start" flexWrap="wrap">
      <Field.Root maxW="140px">
        <Field.Label fontSize="xs" color="fg.muted">
          Type
        </Field.Label>
        <NativeSelect.Root size="sm">
          <NativeSelect.Field
            value={keep.type}
            onChange={(e) => {
              const type = e.target.value === 'lowest' ? 'lowest' : 'highest';
              onChange({ keep: { ...keep, type } });
            }}
          >
            <option value="highest">highest</option>
            <option value="lowest">lowest</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>
      <Stack gap={1}>
        <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
          How many (n)
        </Text>
        <NumberStepper
          value={keep.n}
          onCommit={(n) => onChange({ keep: { ...keep, n } })}
          min={1}
          max={999}
          ariaLabel="How many (n)"
          invalid={errorKeepN !== undefined}
        />
        {errorKeepN !== undefined && (
          <Text fontSize="xs" color="red.fg">
            {errorKeepN}
          </Text>
        )}
      </Stack>
    </HStack>
  );
}

interface ExplodeRuleEditorProps {
  explode: ExplodeRule;
  partSides: number;
  errorExplodeFaces: string | undefined;
  errorExplodeDepth: string | undefined;
  onChange: (patch: PartPatch) => void;
}

function ExplodeRuleEditor({
  explode,
  partSides,
  errorExplodeFaces,
  errorExplodeDepth,
  onChange,
}: ExplodeRuleEditorProps) {
  return (
    <Stack gap={2} mt={2}>
      <Box>
        <Text fontSize="xs" color="fg.muted" mb={1}>
          Faces
        </Text>
        <FacePicker
          sides={partSides}
          selected={explode.onFaces}
          onChange={(onFaces) =>
            onChange({ explode: { ...explode, onFaces } })
          }
          ariaLabel="Explode faces"
        />
        {errorExplodeFaces !== undefined && (
          <Text fontSize="xs" color="red.fg" mt={1}>
            {errorExplodeFaces}
          </Text>
        )}
      </Box>
      <Stack gap={1}>
        <Text fontSize="xs" color="fg.muted" w="fit-content">
          <HelpTerm tip={tipForId('explodeDepthCap')}>Depth cap</HelpTerm>
        </Text>
        <NumberStepper
          value={explode.depthCap}
          onCommit={(depthCap) => onChange({ explode: { ...explode, depthCap } })}
          min={0}
          max={50}
          ariaLabel="Depth cap"
          invalid={errorExplodeDepth !== undefined}
        />
        {errorExplodeDepth !== undefined && (
          <Text fontSize="xs" color="red.fg">
            {errorExplodeDepth}
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

interface DicePartRowProps {
  part: DicePart;
  mode: ExpressionMode;
  keepAcrossActive: boolean;
  onChange: (patch: PartPatch) => void;
  /** Omitted where a part cannot belong to a list at all, such as a check die. */
  onRemove?: () => void;
  canRemove: boolean;
}

export const DicePartRow = memo(function DicePartRow({
  part,
  mode,
  keepAcrossActive,
  onChange,
  onRemove,
  canRemove,
}: DicePartRowProps) {
  const isPool = mode === 'pool';
  const keepBlocked = isPool || keepAcrossActive;
  const errors = validatePart(part);

  const commitCount = useCallback(
    (count: number) => onChange({ count }),
    [onChange],
  );
  const commitSides = useCallback(
    (sides: number) => {
      const patch: PartPatch = { sides };
      if (part.reroll) {
        const cleaned = clampFacesToSides(part.reroll.values, sides);
        patch.reroll = { ...part.reroll, values: cleaned };
      }
      if (part.explode) {
        const cleaned = clampFacesToSides(part.explode.onFaces, sides);
        patch.explode = { ...part.explode, onFaces: cleaned };
      }
      onChange(patch);
    },
    [onChange, part.reroll, part.explode],
  );
  const [customOpen, setCustomOpen] = useState(false);
  const sidesIsCustom = !STANDARD_DICE.includes(part.sides);
  const showCustomSides = customOpen || sidesIsCustom;

  const selectStandardDie = useCallback(
    (sides: number) => {
      commitSides(sides);
      setCustomOpen(false);
    },
    [commitSides],
  );

  const toggleKeep = (on: boolean) => {
    onChange({ keep: on ? defaultKeep(part) : undefined });
  };
  const toggleReroll = (on: boolean) => {
    onChange({ reroll: on ? defaultReroll() : undefined });
  };
  const toggleExplode = (on: boolean) => {
    onChange({ explode: on ? defaultExplode(part) : undefined });
  };

  return (
    <Box
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="md"
      p={3}
      bg="bg.panel"
    >
      <HStack justify="space-between" align="center">
        <HStack gap={3} align="center">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
            minW="44px"
          >
            Count
          </Text>
          <NumberStepper
            value={part.count}
            onCommit={commitCount}
            min={1}
            // Sides is capped at 1000 and keep-n at 999; count had no ceiling at
            // all, and NumberStepper skips every clamp when max is undefined, so
            // a pasted 100000 committed verbatim. The complexity guard refuses
            // the rows that would actually hurt; this just stops the field being
            // the one number in the editor with no bound.
            max={999}
            ariaLabel="Count"
            invalid={errors.count !== undefined}
          />
        </HStack>

        {onRemove && (
          <IconButton
            aria-label="Remove part"
            size="sm"
            variant="ghost"
            colorPalette="red"
            disabled={!canRemove}
            _disabled={{ opacity: 0.4, color: 'fg.muted', cursor: 'not-allowed' }}
            onClick={onRemove}
          >
            <Trash2 size={16} />
          </IconButton>
        )}
      </HStack>
      {errors.count !== undefined && (
        <Text fontSize="xs" color="red.fg" mt={1}>
          {errors.count}
        </Text>
      )}

      <HStack gap={3} align="flex-start" mt={4}>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
          minW="44px"
          mt={2}
        >
          Die
        </Text>
        <Box flex="1">
          <Wrap gap={2}>
            {STANDARD_DICE.map((d) => {
              const active = part.sides === d;
              return (
                <Button
                  key={d}
                  size="sm"
                  h="40px"
                  minW="52px"
                  fontFamily="mono"
                  variant={active ? 'subtle' : 'outline'}
                  colorPalette={active ? 'blue' : 'gray'}
                  aria-pressed={active}
                  _focusVisible={chipFocusRing}
                  onClick={() => selectStandardDie(d)}
                >
                  d{d}
                </Button>
              );
            })}
            <Button
              size="sm"
              h="40px"
              minW="52px"
              fontFamily="mono"
              variant={sidesIsCustom ? 'subtle' : 'outline'}
              colorPalette={sidesIsCustom ? 'blue' : 'gray'}
              aria-pressed={sidesIsCustom}
              _focusVisible={chipFocusRing}
              onClick={() => setCustomOpen(true)}
            >
              {sidesIsCustom ? `d${part.sides}` : 'd…'}
            </Button>
          </Wrap>
          {showCustomSides && (
            <Stack gap={1} mt={2}>
              <Text fontSize="xs" color="fg.muted" w="fit-content">
                Sides
              </Text>
              <NumberStepper
                value={part.sides}
                onCommit={commitSides}
                min={2}
                max={1000}
                ariaLabel="Sides"
                invalid={errors.sides !== undefined}
              />
            </Stack>
          )}
        </Box>
      </HStack>
      {errors.sides !== undefined && (
        <Text fontSize="xs" color="red.fg" mt={1}>
          {errors.sides}
        </Text>
      )}

      <Stack gap={2} mt={4}>
        <HStack gap={3} align="flex-start">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="fg.muted"
            textTransform="uppercase"
            letterSpacing="wider"
            minW="44px"
            mt={2}
          >
            Rules
          </Text>
          <Box flex="1">
            <Wrap gap={2}>
              <RuleChip
                label="Keep"
                tip={tipForId('keep')}
                active={part.keep !== undefined}
                onToggle={toggleKeep}
                disabled={keepBlocked}
                disabledTip={tipForId(
                  isPool ? 'keepDisabledInPool' : 'keepDisabledByKeepAcross',
                )}
              />
              <RuleChip
                label="Reroll"
                tip={tipForId('reroll')}
                active={part.reroll !== undefined}
                onToggle={toggleReroll}
              />
              <RuleChip
                label="Explode"
                tip={tipForId('explode')}
                active={part.explode !== undefined}
                onToggle={toggleExplode}
                disabled={isPool}
                disabledTip={tipForId('explodeDisabledInPool')}
              />
            </Wrap>
          </Box>
        </HStack>

        {part.keep && (
          <RuleCard heading="Keep">
            <KeepRuleEditor
              keep={part.keep}
              errorKeepN={errors.keepN}
              onChange={onChange}
            />
          </RuleCard>
        )}

        {part.reroll && (
          <RuleCard heading="Reroll">
            <Stack gap={2} mt={2}>
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>
                  Faces
                </Text>
                <FacePicker
                  sides={part.sides}
                  selected={part.reroll.values}
                  onChange={(values) =>
                    onChange({ reroll: { ...part.reroll!, values } })
                  }
                  ariaLabel="Reroll faces"
                />
                {errors.rerollValues !== undefined && (
                  <Text fontSize="xs" color="red.fg" mt={1}>
                    {errors.rerollValues}
                  </Text>
                )}
              </Box>
              <Field.Root maxW="140px">
                <Field.Label fontSize="xs" color="fg.muted">
                  Mode
                </Field.Label>
                <NativeSelect.Root size="sm">
                  <NativeSelect.Field
                    value={part.reroll.mode}
                    onChange={(e) => {
                      const mode = e.target.value === 'always' ? 'always' : 'once';
                      onChange({ reroll: { ...part.reroll!, mode } });
                    }}
                  >
                    <option value="once">once</option>
                    <option value="always">always</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
            </Stack>
          </RuleCard>
        )}

        {part.explode && (
          <RuleCard heading="Explode">
            <ExplodeRuleEditor
              explode={part.explode}
              partSides={part.sides}
              errorExplodeFaces={errors.explodeFaces}
              errorExplodeDepth={errors.explodeDepth}
              onChange={onChange}
            />
          </RuleCard>
        )}
      </Stack>
    </Box>
  );
});
