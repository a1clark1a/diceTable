import type {
  CheckSpec,
  CritEffect,
  DicePart,
  EffectScale,
  Expression,
  KeepRule,
} from '../types';

// Shared with the JSX renderer so the plain-text and tooltip-carrying notations
// can never drift apart on vocabulary.
export const SCALE_WORDS: Record<EffectScale, string> = {
  none: 'nothing',
  half: 'half',
  full: 'full',
};

export const CRIT_WORDS: Record<CritEffect, string> = {
  doubleDice: '×dice',
  extraDie: '+1 die',
  maxPlusRoll: 'max+roll',
};

export function formatFaceList(values: number[]): string {
  return [...values].sort((a, b) => a - b).join(',');
}

export function partNotation(part: DicePart): string {
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

export function partsNotation(parts: DicePart[], fallback: string): string {
  const rendered = parts.map(partNotation).filter((s) => s.length > 0);
  return rendered.length > 0 ? rendered.join(' + ') : fallback;
}

export function modifierNotation(value: number): string {
  if (value > 0) return ` + ${value}`;
  if (value < 0) return ` − ${Math.abs(value)}`;
  return '';
}

function keepAcrossNotation(rule: KeepRule): string {
  return ` · keep ${rule.type} ${rule.n}`;
}

function checkNotation(check: CheckSpec): string {
  const { threshold, effect, crit } = check;
  let s = ` ${threshold.direction === 'gte' ? '≥' : '≤'}${threshold.value} → `;
  s += partsNotation(effect.parts, '(no effect)');
  s += modifierNotation(effect.flatModifier);
  if (effect.keepAcross) s += keepAcrossNotation(effect.keepAcross);
  if (check.onSuccess !== 'full') {
    s += ` · ${SCALE_WORDS[check.onSuccess]} on a success`;
  }
  if (check.onFailure !== 'none') {
    s += ` · ${SCALE_WORDS[check.onFailure]} on a failure`;
  }
  if (crit) {
    s += ` · crit ${formatFaceList(crit.onFaces)} ${CRIT_WORDS[crit.effect]}`;
  }
  return s;
}

/**
 * The row's notation as one line of plain text. The table renders the same
 * sentence as tooltip-carrying spans; this is the version for anywhere markup
 * cannot go, such as the exported image.
 */
export function expressionNotation(expr: Expression): string {
  const body = partsNotation(expr.parts, '(no parts)');

  if (expr.mode === 'pool') {
    let s = body;
    const threshold = expr.successThreshold;
    if (threshold) {
      s += ` · count ${threshold.direction === 'gte' ? '≥' : '≤'}${threshold.value}`;
    }
    if (expr.flatModifier !== 0) {
      const sign = expr.flatModifier > 0 ? '+' : '−';
      s += ` · ${sign}${Math.abs(expr.flatModifier)} auto`;
    }
    return s;
  }

  let s = body + modifierNotation(expr.flatModifier);
  if (expr.rollMode !== 'normal') {
    s += expr.rollMode === 'advantage' ? ' adv' : ' dis';
  }
  if (expr.mode === 'check' && expr.check) return s + checkNotation(expr.check);
  if (expr.keepAcross) s += keepAcrossNotation(expr.keepAcross);
  return s;
}
