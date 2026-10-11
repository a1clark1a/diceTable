import {
  Box,
  Button,
  HStack,
  IconButton,
  NativeSelect,
  Stack,
  Text,
  VisuallyHidden,
  chakra,
} from '@chakra-ui/react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { MAX_MODS, type Expression, type ModOp, type ModStep } from '../../types';
import type { ExpressionPatch } from '../../state/useApp';
import {
  MOD_FACTOR_BOUNDS,
  NEW_MOD_STEP,
  modStepProblem,
  withOp,
  withStepMoved,
  type ModStepProblem,
} from '../../state/modChain';
import { tipForId } from '../../docs/glossary';
import { tapTarget } from '../tapTarget';
import { NumberStepper, Panel } from './controls';
import { modStepAria } from '../../share/notation';
import { onModChainFocus, takeModChainFocus } from './modChainFocus';
import { TapTip } from './TapTip';

const OPS: readonly ModOp[] = ['add', 'sub', 'mul', 'div'];

function opLabel(op: ModOp, pool: boolean): string {
  switch (op) {
    case 'add':
      return pool ? '+ Add successes' : '+ Add';
    case 'sub':
      return pool ? '− Remove successes' : '− Subtract';
    case 'mul':
      return '× Multiply by';
    case 'div':
      return '÷ Divide by';
  }
}

function amountWord(op: ModOp): string {
  if (op === 'mul') return 'multiplier';
  if (op === 'div') return 'divisor';
  return 'amount';
}

interface Refusal {
  problem: ModStepProblem;
  tried: number;
}

// The field goes back to the number the row is still using, so the message
// names both: what was refused, and what stayed.
function refusalMessage(step: ModStep, { problem, tried }: Refusal): string {
  const verb = step.op === 'div' ? 'divide' : 'multiply';
  const kept = `This step still ${verb === 'divide' ? 'divides' : 'multiplies'} by ${step.value}.`;
  switch (problem) {
    case 'belowOne':
      return `Can’t ${verb} by ${tried}. ${kept}`;
    case 'aboveMax':
      return `Up to ${MOD_FACTOR_BOUNDS.max}. ${kept}`;
    case 'notWhole':
      return `Use a whole number. ${kept}`;
    case 'notANumber':
      return `Type a number. ${kept}`;
  }
}

interface ModChainEditorProps {
  expression: Expression;
  updateExpression: (id: string, patch: ExpressionPatch) => void;
}

type FocusTarget = { index: number; which: 'op' | 'up' | 'down' } | 'add';

export function ModChainEditor({ expression, updateExpression }: ModChainEditorProps) {
  const { id: exprId, mods } = expression;
  const pool = expression.mode === 'pool';
  const steps = mods ?? [];
  const full = steps.length >= MAX_MODS;

  // A refused value never reaches the row, so the reason lives here, by step.
  // Any change to the chain's shape clears them all rather than letting a
  // reason drift onto the step that moved into its place.
  const [refusals, setRefusals] = useState<Partial<Record<number, Refusal>>>({});
  // Remounting a step's stepper puts its field back on the row's own number.
  // Per step, so a refusal on blur cannot steal focus from the field the user
  // just moved into.
  const [resets, setResets] = useState<Partial<Record<number, number>>>({});
  // The counter keys the message's node, so saying the same thing twice
  // replaces it and is read again.
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 });
  const say = (text: string) => setAnnouncement((prev) => ({ text, n: prev.n + 1 }));
  const messageId = useId();
  const focusAfter = useRef<FocusTarget | null>(null);
  const opRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const upRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const downRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const addRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === null) return;
    if (target === 'add') {
      addRef.current?.focus();
      return;
    }
    const refs = target.which === 'op' ? opRefs : target.which === 'up' ? upRefs : downRefs;
    refs.current[target.index]?.focus();
  }, [mods]);

  useEffect(() => {
    const take = () => {
      if (takeModChainFocus(exprId)) (opRefs.current[0] ?? addRef.current)?.focus();
    };
    take();
    return onModChainFocus(take);
  }, [exprId]);

  const commit = (next: ModStep[], focus: FocusTarget, said: string) => {
    focusAfter.current = focus;
    setRefusals({});
    say(said);
    updateExpression(exprId, { mods: next });
  };

  const add = () => {
    if (full) return;
    commit([...steps, NEW_MOD_STEP], { index: steps.length, which: 'op' }, 'Step added');
  };

  const remove = (index: number) => {
    commit(
      steps.filter((_, i) => i !== index),
      'add',
      `Step ${index + 1} removed`,
    );
  };

  const move = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= steps.length) return;
    commit(
      withStepMoved(steps, index, delta),
      { index: to, which: delta === -1 ? 'up' : 'down' },
      `Step moved to ${to + 1} of ${steps.length}`,
    );
  };

  const changeOp = (index: number, op: ModOp) => {
    const step = steps[index];
    if (step === undefined || step.op === op) return;
    setRefusals({});
    updateExpression(exprId, {
      mods: steps.map((s, i) => (i === index ? withOp(s, op) : s)),
    });
  };

  const changeValue = (index: number, value: number) => {
    const step = steps[index];
    if (step === undefined) return;
    const problem = modStepProblem(step.op, value);
    if (problem !== null) {
      const refusal = { problem, tried: value };
      setRefusals((prev) => ({ ...prev, [index]: refusal }));
      setResets((prev) => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }));
      // Enter blurs the field, so the message tied to it is not read until
      // focus comes back; the status line says it now.
      say(refusalMessage(step, refusal));
      return;
    }
    setRefusals((prev) => ({ ...prev, [index]: undefined }));
    if (value === step.value) return;
    updateExpression(exprId, {
      mods: steps.map((s, i) => (i === index ? { op: s.op, value } : s)),
    });
  };

  return (
    <Panel label="Modifier steps" tip={tipForId(pool ? 'modChainPool' : 'modChain')}>
      <Stack gap={3}>
        {steps.map((step, index) => {
          const scales = step.op === 'mul' || step.op === 'div';
          const refusal = refusals[index];
          const refusalId = `${messageId}-${index}`;
          const first = index === 0;
          const last = index === steps.length - 1;
          const n = index + 1;
          return (
            // Index keys: a step has no id, and each position's controls are
            // what focus returns to after a move, so the position is the
            // identity that matters here.
            <Box
              key={index}
              role="group"
              aria-label={`Step ${n} of ${steps.length}: ${modStepAria(step, pool)}`}
            >
              <HStack gap={2} align="center" flexWrap="wrap">
                <NativeSelect.Root size="sm" w="auto">
                  <NativeSelect.Field
                    ref={(el: HTMLSelectElement | null) => {
                      opRefs.current[index] = el;
                    }}
                    aria-label={`Step ${n} operation`}
                    value={step.op}
                    h="40px"
                    minW="9.5rem"
                    onChange={(e) => {
                      const op = OPS.find((o) => o === e.target.value);
                      if (op) changeOp(index, op);
                    }}
                  >
                    {OPS.map((op) => (
                      <option key={op} value={op}>
                        {opLabel(op, pool)}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <NumberStepper
                  key={resets[index] ?? 0}
                  value={step.value}
                  min={scales ? MOD_FACTOR_BOUNDS.min : 0}
                  // Adding has no ceiling: the Mod box and every saved table
                  // can already hold more, and an add never widens a row.
                  max={scales ? MOD_FACTOR_BOUNDS.max : undefined}
                  passBelowMin={scales}
                  invalid={refusal !== undefined}
                  describedBy={refusal !== undefined ? refusalId : undefined}
                  ariaLabel={`Step ${n} ${amountWord(step.op)}`}
                  onCommit={(value) => changeValue(index, value)}
                />
                {step.op === 'div' && (
                  <Text fontSize="xs" color="fg.muted">
                    rounds down
                  </Text>
                )}
                <HStack gap={1} ms="auto">
                  <StepButton
                    ref={(el) => {
                      upRefs.current[index] = el;
                    }}
                    label={`Move step ${n} earlier`}
                    tip={tipForId(first ? 'modStepUpFirst' : 'modStepUp')}
                    blocked={first}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={14} />
                  </StepButton>
                  <StepButton
                    ref={(el) => {
                      downRefs.current[index] = el;
                    }}
                    label={`Move step ${n} later`}
                    tip={tipForId(last ? 'modStepDownLast' : 'modStepDown')}
                    blocked={last}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={14} />
                  </StepButton>
                  <StepButton
                    label={`Remove step ${n}`}
                    tip={tipForId('modStepRemove')}
                    blocked={false}
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={14} />
                  </StepButton>
                </HStack>
              </HStack>
              {refusal !== undefined && (
                <Text id={refusalId} fontSize="xs" color="red.fg" mt={1}>
                  {refusalMessage(step, refusal)}
                </Text>
              )}
            </Box>
          );
        })}
        <Box>
          <TapTip tip={tipForId(full ? 'modChainFull' : 'modChainAdd')} hold={full}>
            <Button
              ref={addRef}
              size="sm"
              variant="outline"
              h={tapTarget('32px')}
              aria-disabled={full || undefined}
              data-disabled={full ? '' : undefined}
              onClick={add}
            >
              <Plus size={14} />
              Add a step
            </Button>
          </TapTip>
        </Box>
      </Stack>
      <VisuallyHidden role="status" aria-live="polite">
        <chakra.span key={announcement.n}>{announcement.text}</chakra.span>
      </VisuallyHidden>
    </Panel>
  );
}

/**
 * Where the chain editor sits on a check row: present, so someone looking for
 * multiply finds it, and blocked with the reason, as Keep and Explode are on a
 * pool row.
 */
export function ModChainBlocked() {
  return (
    <Panel label="Modifier steps" tip={tipForId('modChain')}>
      <TapTip tip={tipForId('modChainCheckRow')}>
        <Button
          size="sm"
          variant="outline"
          h={tapTarget('32px')}
          aria-disabled
          data-disabled=""
        >
          <Plus size={14} />
          Add a step
        </Button>
      </TapTip>
    </Panel>
  );
}

interface StepButtonProps {
  ref?: Ref<HTMLButtonElement>;
  label: string;
  tip: string;
  blocked: boolean;
  onClick: () => void;
  children: ReactNode;
}

// aria-disabled rather than the native attribute, so a step moved to the top
// keeps focus on the arrow that moved it, and a tap still learns why it stopped.
function StepButton({ ref, label, tip, blocked, onClick, children }: StepButtonProps) {
  return (
    <TapTip tip={tip} hold={blocked}>
      <IconButton
        ref={ref}
        aria-label={label}
        size="sm"
        variant="ghost"
        h={tapTarget('32px')}
        minW={tapTarget('32px')}
        aria-disabled={blocked || undefined}
        data-disabled={blocked ? '' : undefined}
        onClick={() => {
          if (!blocked) onClick();
        }}
      >
        {children}
      </IconButton>
    </TapTip>
  );
}
