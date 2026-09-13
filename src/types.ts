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

/**
 * The three places a view is chosen independently: the two comparison chart
 * panels, and the table's shape column (which the expanded inspect chart
 * follows, since it is opened from a row).
 */
export type ChartSurface = 'totals' | 'successes' | 'shape';

export type WorkshopView = 'table' | 'target' | 'rolloff' | 'matrix';

/** Which shape the Target hit view is drawing its numbers in. */
export type TargetSubView = 'grid' | 'curves' | 'bars';

/** Which kinds of roll the Target hit view is showing. */
export type TargetKindFilter = 'all' | 'sum' | 'pool';

/** How the Roll-off view orders its rows. */
export type RollOffSort = 'win' | 'table';

export interface GridSort {
  /** columnKey, not a position: the two axes shift as targets and filters change. */
  key: string;
  dir: 'desc' | 'asc';
}

export type TargetRuling = 'gte' | 'gt' | 'lte' | 'lt' | 'eq';

export const MAX_TARGETS = 5;
export const MAX_EXPRESSIONS = 100;
/**
 * How many curves a comparison card draws before it says it cut some. Two
 * budgets because the readable ceiling is a property of the canvas: twenty
 * curves are followable in the enlarged copy's 1200x520 and are not in a
 * 340x320 rail. They are equal for now; only the enlarged one can rise, and
 * only once something other than the pen carries a curve's identity.
 */
export const CHART_ROW_CAP_RAIL = 20;
export const CHART_ROW_CAP_ENLARGED = 20;
/**
 * Past this the chart card stops picturing. Separate from what the screen
 * draws: the card grows 46px per row and is rasterized at 2x, so its ceiling is
 * a canvas budget rather than a legibility one.
 */
export const SHARE_CARD_ROW_LIMIT = 20;

export interface TargetState {
  values: number[];
  ruling: TargetRuling;
}

export interface PersistedState {
  version: 6;
  expressions: Expression[];
  ui: {
    expandedId: string | null;
    chartViews: Record<ChartSurface, ChartView>;
    target: TargetState;
    view: WorkshopView;
    poolTargets: number[];
    baselineId: string | null;
    /**
     * The Target hit and Roll-off views' own controls. They live here rather
     * than in component state because the share image has to picture the view
     * the user actually selected, and the share hook cannot reach into a
     * component's useState.
     */
    targetSubView: TargetSubView;
    targetFilter: TargetKindFilter;
    targetSort: GridSort | null;
    rollOffSort: RollOffSort;
  };
}
