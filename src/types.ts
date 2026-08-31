export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export interface KeepRule {
  type: 'highest' | 'lowest';
  n: number;
}

export interface RerollRule {
  values: number[];
  mode: 'once' | 'always';
}

export interface ExplodeRule {
  onFaces: number[];
  depthCap: number;
}

export interface DicePart {
  id: string;
  count: number;
  sides: number;
  keep?: KeepRule;
  reroll?: RerollRule;
  explode?: ExplodeRule;
}

export type ExpressionMode = 'sum' | 'pool' | 'check';

export interface SuccessThreshold {
  direction: 'gte' | 'lte';
  value: number;
}

/** How much of the effect lands on a given outcome. Half rounds down. */
export type EffectScale = 'none' | 'half' | 'full';

export type CritEffect = 'doubleDice' | 'extraDie' | 'maxPlusRoll';

export interface CritRule {
  onFaces: number[];
  effect: CritEffect;
}

export interface CheckEffect {
  parts: DicePart[];
  flatModifier: number;
  keepAcross?: KeepRule;
}

export interface CheckSpec {
  threshold: SuccessThreshold;
  effect: CheckEffect;
  onSuccess: EffectScale;
  onFailure: EffectScale;
  crit?: CritRule;
}

export interface Expression {
  id: string;
  name: string;
  parts: DicePart[];
  flatModifier: number;
  rollMode: RollMode;
  mode: ExpressionMode;
  successThreshold?: SuccessThreshold;
  /**
   * Keeps the best or worst n dice across every part instead of adding the parts
   * together. Mutually exclusive with the per-part `keep` rule.
   */
  keepAcross?: KeepRule;
  /**
   * Turns the row into "roll a check, then apply an effect". On a check row
   * `parts`, `flatModifier` and `rollMode` describe the check roll; the effect
   * carries its own dice and modifier.
   */
  check?: CheckSpec;
}

export type Distribution = Map<number, number>;

export type ChartView = 'pmf' | 'cdf' | 'ccdf' | 'target';

export type WorkshopView = 'table' | 'target' | 'rolloff' | 'matrix';

export type TargetRuling = 'gte' | 'gt' | 'lte' | 'lt' | 'eq';

export const MAX_TARGETS = 5;
export const MAX_EXPRESSIONS = 100;

export interface TargetState {
  values: number[];
  ruling: TargetRuling;
}

export interface PersistedState {
  version: 4;
  expressions: Expression[];
  ui: {
    expandedId: string | null;
    chartView: ChartView;
    target: TargetState;
    view: WorkshopView;
    poolTarget: number;
    baselineId: string | null;
  };
}
