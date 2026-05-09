import {
  Box,
  Checkbox,
  Field,
  HStack,
  IconButton,
  NativeSelect,
  NumberInput,
  Stack,
  Switch,
  Text,
  Wrap,
} from '@chakra-ui/react';
import { Trash2 } from 'lucide-react';
import type { DicePart, ExplodeRule, KeepRule, RerollRule } from '../../types';
import type { PartPatch } from '../../state/useApp';
import { HelpTerm } from '../ui/help-term';
import { tipForId } from '../../docs/glossary';
import { validatePart } from './validatePart';

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

const MAX_PICKER_FACES = 30;

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
        Face picker hidden for d{sides}. (Pick a smaller die or use d{MAX_PICKER_FACES}-).
      </Text>
    );
  }
  const faces = Array.from({ length: sides }, (_, i) => i + 1);
  return (
    <Wrap gap={1} role="group" aria-label={ariaLabel}>
      {faces.map((face) => {
        const checked = selected.includes(face);
        return (
          <Checkbox.Root
            key={face}
            size="sm"
            checked={checked}
            onCheckedChange={(e) =>
              onChange(
                e.checked === true
                  ? [...selected, face].sort((a, b) => a - b)
                  : selected.filter((v) => v !== face),
              )
            }
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label fontSize="xs">{face}</Checkbox.Label>
          </Checkbox.Root>
        );
      })}
    </Wrap>
  );
}

interface DicePartRowProps {
  part: DicePart;
  onChange: (patch: PartPatch) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function DicePartRow({ part, onChange, onRemove, canRemove }: DicePartRowProps) {
  const errors = validatePart(part);

  const setCount = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    onChange({ count: Number.isFinite(n) ? n : 0 });
  };
  const setSides = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    const sides = Number.isFinite(n) ? n : 0;
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
  };

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
      borderColor="border.subtle"
      borderRadius="md"
      p={3}
      bg="bg.panel"
    >
      <HStack gap={2} align="flex-start" flexWrap="wrap">
        <Field.Root invalid={errors.count !== undefined} maxW="100px">
          <Field.Label fontSize="xs" color="fg.muted">
            Count
          </Field.Label>
          <NumberInput.Root
            size="sm"
            min={1}
            max={999}
            value={String(part.count)}
            onValueChange={(e) => setCount(e.value)}
          >
            <NumberInput.Control />
            <NumberInput.Input />
          </NumberInput.Root>
          {errors.count !== undefined && (
            <Field.ErrorText fontSize="xs">{errors.count}</Field.ErrorText>
          )}
        </Field.Root>

        <Text fontSize="lg" mt={6} color="fg.muted">
          d
        </Text>

        <Field.Root invalid={errors.sides !== undefined} maxW="120px">
          <Field.Label fontSize="xs" color="fg.muted">
            Sides
          </Field.Label>
          <NumberInput.Root
            size="sm"
            min={2}
            max={1000}
            value={String(part.sides)}
            onValueChange={(e) => setSides(e.value)}
          >
            <NumberInput.Control />
            <NumberInput.Input />
          </NumberInput.Root>
          {errors.sides !== undefined && (
            <Field.ErrorText fontSize="xs">{errors.sides}</Field.ErrorText>
          )}
        </Field.Root>

        <Box flex="1" />

        <IconButton
          aria-label="Remove part"
          size="sm"
          variant="ghost"
          colorPalette="red"
          mt={6}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </IconButton>
      </HStack>

      <Stack gap={3} mt={3}>
        <Box>
          <HStack justify="space-between">
            <Text fontSize="sm" fontWeight="medium">
              <HelpTerm tip={tipForId('keep')}>Keep</HelpTerm>
            </Text>
            <Switch.Root
              size="sm"
              checked={part.keep !== undefined}
              onCheckedChange={(e) => toggleKeep(e.checked === true)}
              aria-label="Toggle keep rule"
            >
              <Switch.HiddenInput />
              <Switch.Control />
            </Switch.Root>
          </HStack>
          {part.keep && (
            <HStack gap={2} mt={2} align="flex-start" flexWrap="wrap">
              <Field.Root maxW="140px">
                <Field.Label fontSize="xs" color="fg.muted">
                  Type
                </Field.Label>
                <NativeSelect.Root size="sm">
                  <NativeSelect.Field
                    value={part.keep.type}
                    onChange={(e) => {
                      const type = e.target.value === 'lowest' ? 'lowest' : 'highest';
                      onChange({ keep: { ...part.keep!, type } });
                    }}
                  >
                    <option value="highest">highest</option>
                    <option value="lowest">lowest</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
              <Field.Root invalid={errors.keepN !== undefined} maxW="100px">
                <Field.Label fontSize="xs" color="fg.muted">
                  n
                </Field.Label>
                <NumberInput.Root
                  size="sm"
                  min={1}
                  max={999}
                  value={String(part.keep.n)}
                  onValueChange={(e) => {
                    const n = Number.parseInt(e.value, 10);
                    onChange({
                      keep: { ...part.keep!, n: Number.isFinite(n) ? n : 0 },
                    });
                  }}
                >
                  <NumberInput.Control />
                  <NumberInput.Input />
                </NumberInput.Root>
                {errors.keepN !== undefined && (
                  <Field.ErrorText fontSize="xs">{errors.keepN}</Field.ErrorText>
                )}
              </Field.Root>
            </HStack>
          )}
        </Box>

        <Box>
          <HStack justify="space-between">
            <Text fontSize="sm" fontWeight="medium">
              <HelpTerm tip={tipForId('reroll')}>Reroll</HelpTerm>
            </Text>
            <Switch.Root
              size="sm"
              checked={part.reroll !== undefined}
              onCheckedChange={(e) => toggleReroll(e.checked === true)}
              aria-label="Toggle reroll rule"
            >
              <Switch.HiddenInput />
              <Switch.Control />
            </Switch.Root>
          </HStack>
          {part.reroll && (
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
          )}
        </Box>

        <Box>
          <HStack justify="space-between">
            <Text fontSize="sm" fontWeight="medium">
              <HelpTerm tip={tipForId('explode')}>Explode</HelpTerm>
            </Text>
            <Switch.Root
              size="sm"
              checked={part.explode !== undefined}
              onCheckedChange={(e) => toggleExplode(e.checked === true)}
              aria-label="Toggle explode rule"
            >
              <Switch.HiddenInput />
              <Switch.Control />
            </Switch.Root>
          </HStack>
          {part.explode && (
            <Stack gap={2} mt={2}>
              <Box>
                <Text fontSize="xs" color="fg.muted" mb={1}>
                  Faces
                </Text>
                <FacePicker
                  sides={part.sides}
                  selected={part.explode.onFaces}
                  onChange={(onFaces) =>
                    onChange({ explode: { ...part.explode!, onFaces } })
                  }
                  ariaLabel="Explode faces"
                />
                {errors.explodeFaces !== undefined && (
                  <Text fontSize="xs" color="red.solid" mt={1}>
                    {errors.explodeFaces}
                  </Text>
                )}
              </Box>
              <Field.Root invalid={errors.explodeDepth !== undefined} maxW="140px">
                <Field.Label fontSize="xs" color="fg.muted">
                  Depth cap
                </Field.Label>
                <NumberInput.Root
                  size="sm"
                  min={0}
                  max={50}
                  value={String(part.explode.depthCap)}
                  onValueChange={(e) => {
                    const n = Number.parseInt(e.value, 10);
                    onChange({
                      explode: {
                        ...part.explode!,
                        depthCap: Number.isFinite(n) ? n : 0,
                      },
                    });
                  }}
                >
                  <NumberInput.Control />
                  <NumberInput.Input />
                </NumberInput.Root>
                {errors.explodeDepth !== undefined && (
                  <Field.ErrorText fontSize="xs">
                    {errors.explodeDepth}
                  </Field.ErrorText>
                )}
              </Field.Root>
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
