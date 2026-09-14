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
 * How many curves a comparison card draws at once. Two budgets because the
 * readable ceiling is a property of the canvas: twenty curves are followable in
 * the enlarged copy's 1200x520 and are not in a 340x320 rail.
 *
 * The enlarged number is the whole table because on that canvas identity no
 * longer comes from the pen. Eight hues and eight dashes give eight
 * distinguishable pens, so at a hundred rolls thirteen share each one and no
 * cap value fixes that. What the wide canvas draws instead is a field: every
 * roll at once and faint, with one lit on demand, which answers where a roll
 * sits among the rest rather than asking anyone to tell a hundred apart.
 *
 * The rail keeps twenty and pages. So does the enlarged copy on anything that
 * is not a genuinely wide canvas with a pointer, which includes a phone, where
 * the cover dialog is a 360px canvas narrower than the desktop rail.
 */
export const CHART_ROW_CAP_RAIL = 20;
export const CHART_ROW_CAP_ENLARGED = MAX_EXPRESSIONS;
/**
 * How many plotted points one wide-canvas panel may draw before it gives up the
 * field and pages instead. A hundred rows of 20d100 is on the order of 200,000
 * points, which is already heavy at twenty curves; the surface refuses that
 * draw rather than raising a cap it cannot honour, and says so the way it
 * already says it cut rows.
 */
export const CHART_DRAW_POINT_BUDGET = 20000;
/**
 * Past this the chart card stops picturing. Separate from what the screen
 * draws: the card grows 46px per row and is rasterized at 2x, so its ceiling is
 * a canvas budget rather than a legibility one.
 */
export const SHARE_CARD_ROW_LIMIT = 20;
/**
 * Rows in the head-to-head lattice on screen.
 *
 * Twelve was never what the maths could afford. A hundred rolls of ordinary
 * dice score in about 5ms, and even at twenty-four the pairwise work is under
 * half a millisecond; what cost was the grid mounting one tooltip component per
 * cell, which is n squared of them. That is one shared tooltip now, so the
 * number is free to describe the canvas instead of the machinery.
 *
 * Twenty-four is what the screen can carry: about 57px a column after the name
 * gutter, which holds a percentage, with the name column pinned and the rest
 * scrolling sideways. The cut still happens before the matrix is computed
 * rather than after, because unscored pairs are the cheap ones.
 */
export const MATRIX_ROW_CAP = 24;
/**
 * The picture of that grid stops sooner than the screen does, because the card
 * is a fixed 920px wide and divides it by the row count: every extra roll takes
 * width from every column at once. At sixteen a cell still holds "100.0%" with
 * room to spare and a heading still shows six characters of a name. Past that
 * the figures start touching and the headings stop naming anything.
 *
 * The screen has no such ceiling: it scrolls sideways and keeps the name column
 * pinned. Two numbers because they are two canvases, the same reason
 * SHARE_CARD_ROW_LIMIT is not the chart's number. Each surface states its own
 * cut, so neither can lie about what it drew.
 */
export const MATRIX_CARD_ROW_LIMIT = 16;

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
