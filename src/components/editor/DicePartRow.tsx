import {
  Box,
  Button,
  Field,
  HStack,
  IconButton,
  Input,
  NativeSelect,
  Stack,
  Text,
  Wrap,
} from '@chakra-ui/react';
import { Check, Minus, Plus, Trash2 } from 'lucide-react';
import { memo, useCallback, useState, type ReactNode } from 'react';
import type { DicePart, ExplodeRule, KeepRule, RerollRule } from '../../types';
import type { PartPatch } from '../../state/useApp';
import { Tooltip } from '../ui/tooltip';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import { useBufferedValue } from '../../hooks/useBufferedValue';
import { validatePart } from './validatePart';

function parseInteger(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function formatInteger(n: number): string {
  return String(n);
}

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

// The stepper sits inside an overflow:hidden pill, which clips an outer
// (positive-offset) focus ring down to a sliver. An inset ring stays inside the
// pill and visible; boxShadow:none drops the default ring so only this shows.
const focusRingInset = {
  outline: '2px solid',
  outlineColor: 'blue.solid',
  outlineOffset: '-2px',
  boxShadow: 'none',
};

// Chips track colorPalette, so an unselected (gray) chip would show a gray focus
// ring while a selected (blue) chip shows blue. Pin the ring to blue so the
// keyboard cue reads the same regardless of selection state.
const chipFocusRing = {
  outlineWidth: '2px',
  outlineStyle: 'solid',
  outlineColor: 'blue.solid',
  outlineOffset: '2px',
};

const MAX_PICKER_FACES = 30;

interface NumberStepperProps {
  value: number;
  onCommit: (next: number) => void;
  min: number;
  max?: number;
  ariaLabel: string;
  invalid?: boolean;
}

function NumberStepper({
  value,
  onCommit,
  min,
  max,
  ariaLabel,
  invalid,
}: NumberStepperProps) {
  const buf = useBufferedValue<number>({
    committed: value,
    commit: onCommit,
    parse: parseInteger,
    format: formatInteger,
  });
  const step = (delta: number) => {
    const next = value + delta;
    if (next < min || (max !== undefined && next > max)) return;
    onCommit(next);
  };
  return (
    <HStack
      gap={0}
      h="40px"
      w="fit-content"
      align="stretch"
      borderWidth="1px"
      borderColor={invalid ? 'red.solid' : 'border.subtle'}
      borderRadius="md"
      overflow="hidden"
    >
      <IconButton
        aria-label={`Decrease ${ariaLabel}`}
        size="sm"
        variant="ghost"
        color="fg"
        borderRadius="0"
        h="full"
        w="40px"
        disabled={value <= min}
        _disabled={{ opacity: 0.4, color: 'fg.muted', cursor: 'not-allowed' }}
        _focusVisible={focusRingInset}
        onClick={() => step(-1)}
      >
        <Minus size={16} />
      </IconButton>
      <Input
        aria-label={ariaLabel}
        value={buf.value}
        onChange={(e) => buf.setValue(e.target.value)}
        onBlur={buf.onBlur}
        onKeyDown={buf.onKeyDown}
        inputMode="numeric"
        textAlign="center"
        fontFamily="mono"
        h="full"
        w="52px"
        px={0}
        border="none"
        borderRadius="0"
        bg="transparent"
        _focusVisible={focusRingInset}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      />
      <IconButton
        aria-label={`Increase ${ariaLabel}`}
        size="sm"
        variant="ghost"
        color="fg"
        borderRadius="0"
        h="full"
        w="40px"
        disabled={max !== undefined && value >= max}
        _disabled={{ opacity: 0.4, color: 'fg.muted', cursor: 'not-allowed' }}
        _focusVisible={focusRingInset}
        onClick={() => step(1)}
      >
        <Plus size={16} />
      </IconButton>
    </HStack>
  );
}

interface FacePickerProps {
  sides: number;
  selected: number[];
  onChange: (next: number[]) => void;
  ariaLabel: string;
}

function FacePicker({ sides, selected, onChange, ariaLabel }: FacePickerProps) {
  if (!Number.isInteger(sides) || sides < 2) {
    return (
      <Text fontSize="xs" color="fg.muted">
        Set valid sides first.
      </Text>
    );
  }
  if (sides > MAX_PICKER_FACES) {
    return (
      <Text fontSize="xs" color="fg.muted">
        d{sides} has too many faces to list here. Pick a die with {MAX_PICKER_FACES}{' '}
        sides or fewer.
      </Text>
    );
  }
  const faces = Array.from({ length: sides }, (_, i) => i + 1);
  return (
    <Wrap gap={1.5} role="group" aria-label={ariaLabel}>
      {faces.map((face) => {
        const checked = selected.includes(face);
        return (
          <Button
            key={face}
            type="button"
            size="sm"
            h="40px"
            minW="40px"
            px={2}
            fontFamily="mono"
            variant={checked ? 'subtle' : 'outline'}
            colorPalette={checked ? 'blue' : 'gray'}
            aria-pressed={checked}
            aria-label={`Face ${face}`}
            _focusVisible={chipFocusRing}
            onClick={() =>
              onChange(
                checked
                  ? selected.filter((v) => v !== face)
                  : [...selected, face].sort((a, b) => a - b),
              )
            }
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {face}
          </Button>
        );
      })}
    </Wrap>
  );
}

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
          <Text fontSize="xs" color="red.solid">
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
          <Text fontSize="xs" color="red.solid" mt={1}>
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
          <Text fontSize="xs" color="red.solid">
            {errorExplodeDepth}
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

interface RuleChipProps {
  label: string;
  tip: string;
  active: boolean;
  onToggle: (on: boolean) => void;
}

function RuleChip({ label, tip, active, onToggle }: RuleChipProps) {
  return (
    <Tooltip content={tip}>
      <Button
        size="sm"
        h="40px"
        px={4}
        borderRadius="full"
        fontWeight="semibold"
        variant={active ? 'subtle' : 'outline'}
        colorPalette={active ? 'blue' : 'gray'}
        aria-pressed={active}
        _focusVisible={chipFocusRing}
        onClick={() => onToggle(!active)}
      >
        {active && <Check size={14} />}
        {label}
      </Button>
    </Tooltip>
  );
}

interface RuleCardProps {
  heading: string;
  children: ReactNode;
}

function RuleCard({ heading, children }: RuleCardProps) {
  return (
    <Box
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.emphasized"
      borderRadius="md"
      p={3}
    >
      <HStack gap={2}>
        <Box boxSize="7px" borderRadius="full" bg="blue.solid" flexShrink={0} />
        <Text fontSize="sm" fontWeight="semibold">
          {heading}
        </Text>
      </HStack>
      {children}
    </Box>
  );
}

interface DicePartRowProps {
  part: DicePart;
  onChange: (patch: PartPatch) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export const DicePartRow = memo(function DicePartRow({
  part,
  onChange,
  onRemove,
  canRemove,
}: DicePartRowProps) {
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
            ariaLabel="Count"
            invalid={errors.count !== undefined}
          />
        </HStack>

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
      </HStack>
      {errors.count !== undefined && (
        <Text fontSize="xs" color="red.solid" mt={1}>
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
        <Text fontSize="xs" color="red.solid" mt={1}>
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
                  <Text fontSize="xs" color="red.solid" mt={1}>
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
