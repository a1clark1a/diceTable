import type {
  CheckSpec,
  CritEffect,
  DicePart,
  EffectScale,
  Expression,
  KeepRule,
  ModOp,
  ModStep,
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

export const MOD_SYMBOLS: Record<ModOp, string> = {
  add: '+',
  sub: '−',
  mul: '×',
  div: '÷',
};

/** One step as it reads after a total: "+ 3", "× 2". */
export function modStepText(step: ModStep): string {
  return `${MOD_SYMBOLS[step.op]} ${step.value}`;
}

/** How a screen reader says one step: "times 2", "plus 3 automatic successes". */
export function modStepAria(step: ModStep, pool: boolean): string {
  switch (step.op) {
    case 'add':
      return pool ? `plus ${step.value} automatic successes` : `plus ${step.value}`;
    case 'sub':
      return pool ? `minus ${step.value} automatic successes` : `minus ${step.value}`;
    case 'mul':
      return `times ${step.value}`;
    case 'div':
      return `divided by ${step.value}, rounded down`;
  }
}

/** The chain as the narrow Mod cell shows it: "+3 ×2 ÷3". */
export function modsCompact(mods: readonly ModStep[]): string {
  return mods.map((s) => `${MOD_SYMBOLS[s.op]}${s.value}`).join(' ');
}

export interface ChainLayout {
  /** How many "(" go in front of the dice. */
  opens: number;
  /** Each step in order, and whether a ")" closes the group just before it. */
  steps: { step: ModStep; closeBefore: boolean }[];
}

/**
 * Where a sum row's chain needs brackets to read as it computes, left to
 * right. Anyone reading `2d6 + 3 × 2` multiplies first, so a multiply or divide
 * that follows anything added gets the total so far in brackets:
 * `(2d6 + 3) × 2`. A body with words in it (`1d6 explode 6`) counts as added.
 */
export function chainLayout(body: string, mods: readonly ModStep[]): ChainLayout {
  let opens = 0;
  let added = /\s/.test(body);
  const steps = mods.map((step) => {
    const scales = step.op === 'mul' || step.op === 'div';
    const closeBefore = scales && added;
    if (closeBefore) opens++;
    added = !scales;
    return { step, closeBefore };
  });
  return { opens, steps };
}

/** A sum row's dice and chain as one line: `(2d6 + 3) × 2`. */
export function sumChainNotation(body: string, mods: readonly ModStep[] | undefined): string {
  if (mods === undefined || mods.length === 0) return body;
  const { opens, steps } = chainLayout(body, mods);
  let s = '('.repeat(opens) + body;
  for (const { step, closeBefore } of steps) {
    if (closeBefore) s += ')';
    s += ` ${modStepText(step)}`;
  }
  return s;
}

/**
 * A pool chain step as its own segment. Adding and subtracting change the
 * success count directly, which the table has always called automatic
 * successes; multiplying is not more successes rolled, so it says only × 2.
 */
export function poolStepText(step: ModStep): string {
  if (step.op === 'add' || step.op === 'sub') {
    return `${step.op === 'add' ? '+' : '−'}${step.value} auto`;
  }
  return modStepText(step);
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
    for (const step of expr.mods ?? []) s += ` · ${poolStepText(step)}`;
    return s;
  }

  let s =
    expr.mode === 'check'
      ? body + modifierNotation(expr.flatModifier)
      : sumChainNotation(body, expr.mods);
  if (expr.rollMode !== 'normal') {
    s += expr.rollMode === 'advantage' ? ' adv' : ' dis';
  }
  if (expr.mode === 'check' && expr.check) return s + checkNotation(expr.check);
  if (expr.keepAcross) s += keepAcrossNotation(expr.keepAcross);
  return s;
}
