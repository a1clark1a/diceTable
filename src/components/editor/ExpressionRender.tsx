import { Text, chakra } from '@chakra-ui/react';
import { Fragment, type ReactNode } from 'react';
import type { DicePart, Expression } from '../../types';
import { HelpTerm } from '../ui/help-term';
import { tipForKeep } from '../../docs/dynamicTips';
import { tipForId } from '../../docs/glossary';

function formatFaceList(values: number[]): string {
  return [...values].sort((a, b) => a - b).join(',');
}

function renderPartText(part: DicePart): string {
  let s = `${part.count}d${part.sides}`;
  if (part.keep) {
    const tag = part.keep.type === 'highest' ? 'kh' : 'kl';
    s += `${tag}${part.keep.n}`;
  }
  if (part.reroll && part.reroll.values.length > 0) {
    s += ` reroll ${formatFaceList(part.reroll.values)}s ${part.reroll.mode}`;
  }
  if (part.explode && part.explode.onFaces.length > 0) {
    s += ` explode ${formatFaceList(part.explode.onFaces)}`;
    if (part.explode.depthCap !== 10) {
      s += `(cap ${part.explode.depthCap})`;
    }
  }
  return s;
}

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

interface ExpressionDiceTextProps {
  expr: Expression;
  showRollMode?: boolean;
}

export function ExpressionDiceText({ expr, showRollMode }: ExpressionDiceTextProps) {
  const parts = expr.parts.map(renderPartText).filter((s) => s.length > 0);
  const body = parts.length > 0 ? parts.join(' + ') : '(no parts)';

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
            <Text as="span" color="fg.muted">
              {' · '}
            </Text>
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
        {expr.flatModifier !== 0 && (
          <>
            <Text as="span" color="fg.muted">
              {' · '}
            </Text>
            <HelpTerm
              tip={tipForId('poolAutoSuccess')}
              ariaLabel={`${expr.flatModifier > 0 ? 'plus' : 'minus'} ${Math.abs(
                expr.flatModifier,
              )} automatic successes`}
            >
              <Text as="span" color="purple.fg" whiteSpace="nowrap">
                {expr.flatModifier > 0
                  ? `+${expr.flatModifier}`
                  : `−${Math.abs(expr.flatModifier)}`}
                {' auto'}
              </Text>
            </HelpTerm>
          </>
        )}
      </chakra.span>
    );
  }

  let mod = '';
  if (expr.flatModifier > 0) mod = ` + ${expr.flatModifier}`;
  else if (expr.flatModifier < 0) mod = ` − ${Math.abs(expr.flatModifier)}`;
  const rollSuffix =
    showRollMode && expr.rollMode !== 'normal'
      ? expr.rollMode === 'advantage'
        ? ' adv'
        : ' dis'
      : '';
  return (
    <chakra.span>
      {renderTokenized(body, 'body')}
      {mod}
      {rollSuffix && (
        <Text as="span" color="fg.muted" fontSize="xs" ml={1}>
          {rollSuffix}
        </Text>
      )}
    </chakra.span>
  );
}

