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

export interface Expression {
  id: string;
  name: string;
  parts: DicePart[];
  flatModifier: number;
  rollMode: RollMode;
}

export type Distribution = Map<number, number>;

export type ChartView = 'pmf' | 'cdf' | 'ccdf' | 'target';

export type TargetRuling = 'gte' | 'gt' | 'lte' | 'lt' | 'eq';

export interface TargetState {
  value: number | null;
  ruling: TargetRuling;
}

export interface PersistedState {
  version: 2;
  expressions: Expression[];
  ui: {
    expandedId: string | null;
    chartView: ChartView;
    target: TargetState;
  };
}
