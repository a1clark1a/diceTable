import { Text, chakra } from '@chakra-ui/react';
import { Fragment, type ReactNode } from 'react';
import type {
  CheckSpec,
  EffectScale,
  Expression,
  KeepRule,
  ModStep,
} from '../../types';
import { HelpTerm } from '../ui/help-term';
import { tipForKeep } from '../../docs/dynamicTips';
import { tipForId } from '../../docs/glossary';
import {
  CRIT_WORDS,
  SCALE_WORDS,
  chainLayout,
  formatFaceList,
  modStepAria,
  modStepText,
  modifierNotation,
  partsNotation,
  poolStepText,
} from '../../share/notation';

const KEEP_TOKEN = /(k[hl]\d+)/g;

function renderTokenized(text: string, key: string | number): ReactNode {
  const segments = text.split(KEEP_TOKEN);
  return (
    <Fragment key={key}>
      {segments.map((seg, i) => {
        const isToken = i % 2 === 1;
        if (isToken) {
          return (
            <HelpTerm key={i} tip={tipForKeep(seg)}>
              {seg}
            </HelpTerm>
          );
        }
        return <Fragment key={i}>{seg}</Fragment>;
      })}
    </Fragment>
  );
}

function Middot() {
  return (
    <Text as="span" color="fg.muted">
      {' · '}
    </Text>
  );
}

/** The glossary tip for a step, or null for a sum row's plain add or subtract. */
function modStepTip(step: ModStep, pool: boolean): string | null {
  switch (step.op) {
    case 'add':
    case 'sub':
      return pool ? tipForId('poolAutoSuccess') : null;
    case 'mul':
      return tipForId(pool ? 'poolMultiply' : 'modMultiply');
    case 'div':
      return tipForId(pool ? 'poolDivide' : 'modDivide');
  }
}

function SumStep({ step }: { step: ModStep }) {
  const tip = modStepTip(step, false);
  const text = modStepText(step);
  if (tip === null) return <>{` ${text}`}</>;
  return (
    <>
      {' '}
      <HelpTerm tip={tip} ariaLabel={modStepAria(step, false)}>
        <Text as="span" whiteSpace="nowrap">
          {text}
        </Text>
      </HelpTerm>
    </>
  );
}

function PoolSteps({ mods }: { mods: readonly ModStep[] }) {
  return (
    <>
      {mods.map((step, i) => (
        // Index keys: these spans hold no state, and a step has no id of its own.
        <Fragment key={i}>
          <Middot />
          <HelpTerm tip={modStepTip(step, true) ?? ''} ariaLabel={modStepAria(step, true)}>
            {/* nowrap keeps each pool segment intact when the notation wraps
                at narrow widths; the middots are the intended break points. */}
            <Text as="span" color="purple.fg" whiteSpace="nowrap">
              {poolStepText(step)}
            </Text>
          </HelpTerm>
        </Fragment>
      ))}
    </>
  );
}

function KeepAcrossSegment({ rule }: { rule: KeepRule }) {
  return (
    <>
      <Middot />
      <HelpTerm
        tip={tipForId('keepAcross')}
        ariaLabel={`keep the ${rule.n} ${rule.type} dice across every part`}
      >
        {/* nowrap keeps the rule intact when long notation wraps; the middot is
            the intended break point. */}
        <Text as="span" color="blue.fg" whiteSpace="nowrap">
          keep {rule.type} {rule.n}
        </Text>
      </HelpTerm>
    </>
  );
}

function ScaleSegment({
  scale,
  outcome,
}: {
  scale: EffectScale;
  outcome: 'success' | 'failure';
}) {
  return (
    <>
      <Middot />
      <HelpTerm tip={tipForId('effectScale')}>
        <Text as="span" color="orange.fg" whiteSpace="nowrap">
          {SCALE_WORDS[scale]} on a {outcome}
        </Text>
      </HelpTerm>
    </>
  );
}

// Check notation reads left to right the way the roll happens: what you roll,
// what clears the bar, then what lands. The arrow is the only new symbol, and
// the threshold and the critical carry their own tooltips.
function CheckNotation({ check }: { check: CheckSpec }) {
  const { effect, threshold, crit } = check;
  const thresholdText = `${threshold.direction === 'gte' ? '≥' : '≤'}${threshold.value}`;

  return (
    <>
      {' '}
      <HelpTerm
        tip={tipForId('checkThreshold')}
        ariaLabel={`succeeds at ${
          threshold.direction === 'gte' ? 'or above' : 'or below'
        } ${threshold.value}`}
      >
        <Text as="span" color="orange.fg" whiteSpace="nowrap">
          {thresholdText}
        </Text>
      </HelpTerm>
      <Text as="span" color="fg.muted">
        {' → '}
      </Text>
      {renderTokenized(partsNotation(effect.parts, '(no effect)'), 'effect')}
      {modifierNotation(effect.flatModifier)}
      {effect.keepAcross && <KeepAcrossSegment rule={effect.keepAcross} />}
      {check.onSuccess !== 'full' && (
        <ScaleSegment scale={check.onSuccess} outcome="success" />
      )}
      {check.onFailure !== 'none' && (
        <ScaleSegment scale={check.onFailure} outcome="failure" />
      )}
      {crit && (
        <>
          <Middot />
          <HelpTerm
            tip={tipForId('crit')}
            ariaLabel={`critical on ${formatFaceList(crit.onFaces)}`}
          >
            <Text as="span" color="orange.fg" whiteSpace="nowrap">
              crit {formatFaceList(crit.onFaces)} {CRIT_WORDS[crit.effect]}
            </Text>
          </HelpTerm>
        </>
      )}
    </>
  );
}

interface ExpressionDiceTextProps {
  expr: Expression;
  showRollMode?: boolean;
}

export function ExpressionDiceText({ expr, showRollMode }: ExpressionDiceTextProps) {
  const body = partsNotation(expr.parts, '(no parts)');

  // Pool notation: `7d10 · count ≥8 · +2 auto`. The modifier reads as auto-
  // successes, and there is no roll-mode suffix because pool math ignores
  // rollMode (a suffix would be displayed-but-ignored).
  if (expr.mode === 'pool') {
    const threshold = expr.successThreshold;
    return (
      <chakra.span>
        {renderTokenized(body, 'body')}
        {threshold && (
          <>
            <Middot />
            <HelpTerm
              tip={tipForId('successThreshold')}
              ariaLabel={`count ${
                threshold.direction === 'gte' ? 'at least' : 'at most'
              } ${threshold.value}`}
            >
              {/* nowrap keeps each pool segment intact when the notation wraps
                  at narrow widths; the middots are the intended break points. */}
              <Text as="span" color="purple.fg" whiteSpace="nowrap">
                count {threshold.direction === 'gte' ? '≥' : '≤'}
                {threshold.value}
              </Text>
            </HelpTerm>
          </>
        )}
        {expr.mods && <PoolSteps mods={expr.mods} />}
      </chakra.span>
    );
  }

  const layout =
    expr.mode !== 'check' && expr.mods !== undefined ? chainLayout(body, expr.mods) : null;
  const rollSuffix =
    showRollMode && expr.rollMode !== 'normal'
      ? expr.rollMode === 'advantage'
        ? ' adv'
        : ' dis'
      : '';
  const check = expr.mode === 'check' ? expr.check : undefined;
  const keepAcross = expr.keepAcross;

  return (
    <chakra.span>
      {layout !== null && '('.repeat(layout.opens)}
      {renderTokenized(body, 'body')}
      {layout === null
        ? modifierNotation(expr.flatModifier)
        : layout.steps.map(({ step, closeBefore }, i) => (
            <Fragment key={i}>
              {closeBefore && ')'}
              <SumStep step={step} />
            </Fragment>
          ))}
      {/* On a check row the suffix describes the check roll, so it stays with
          the dice it belongs to instead of trailing the whole sentence. */}
      {rollSuffix && (
        <Text as="span" color="fg.muted" fontSize="xs" ml={1}>
          {rollSuffix}
        </Text>
      )}
      {check ? (
        <CheckNotation check={check} />
      ) : (
        keepAcross && <KeepAcrossSegment rule={keepAcross} />
      )}
    </chakra.span>
  );
}
