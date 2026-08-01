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

export type ExpressionMode = 'sum' | 'pool';

export interface SuccessThreshold {
  direction: 'gte' | 'lte';
  value: number;
}

export interface Expression {
  id: string;
  name: string;
  parts: DicePart[];
  flatModifier: number;
  rollMode: RollMode;
  mode: ExpressionMode;
  successThreshold?: SuccessThreshold;
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
  version: 3;
  expressions: Expression[];
  ui: {
    expandedId: string | null;
    chartView: ChartView;
    target: TargetState;
    view: WorkshopView;
    poolTarget: number;
  };
}
