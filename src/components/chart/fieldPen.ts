import type { ChartView } from '../../types';

/**
 * Curves above which a wide canvas switches from drawing every roll in its own
 * pen to drawing them as a field.
 *
 * Thirty rather than the rail's twenty: the calibration render beside
 * `.claude/plans/chart-row-cap.plan.md` reads thirty as still followable and
 * forty as the edge, so fading a table the project's own evidence calls
 * readable would be a regression dressed as a feature.
 */
export const CHART_FIELD_THRESHOLD = 30;

/** Marks the one overlay line that paints the lit roll above the field. */
export const LIT_CLASS = 'dtLitCurve';

/**
 * Recharts paints every Line into its `DefaultZIndexes.line` layer at 400, and
 * each layer is its own portal target, so a lit curve cannot win by being last
 * in the element array. One step up is a different layer, which is what makes
 * it paint over ninety-nine strokes without reordering anything.
 */
export const LIT_Z_INDEX = 401;

/**
 * Capped-bar markers drawn on a field. The description under the chart still
 * names every one, so nothing is hidden, only undrawn.
 */
export const SPIKE_MARKER_DRAW_CAP = 8;

export interface FieldPen {
  /** Stroke opacity while nothing is lit. */
  restOpacity: number;
  /** Stroke opacity for the rest of the field while one roll is lit. */
  dimOpacity: number;
  /** Constant stroke width for every field curve. */
  width: number;
  /** Stroke width for the lit overlay. */
  litWidth: number;
  /** Rules the chart container carries; the field's opacity lives here. */
  css: Record<string, Record<string, number>>;
}

// Chosen off the calibration render beside the plan, not picked as round
// numbers. Below about 0.4 at rest the hundred curves stop being a mass you can
// read the table's shape from, which is the whole thing the field is for, and
// below about 0.2 dimmed there is nothing left for the lit curve to sit among.
const REST = 0.45;
const DIM = 0.25;

/**
 * Two rules, not one plus an override, and `:not()` rather than source order:
 * the second selector carries one extra compound so it beats the first outright
 * and specificity never has to be reasoned about. The lit overlay is excluded
 * from both and keeps its own `strokeOpacity` prop.
 *
 * This rests on two Recharts internals worth naming so a version bump has
 * something to grep for: `Line.js` wraps each series in `recharts-line`, and
 * `Curve.js` renders `<path>` with its stroke opacity as a presentation
 * attribute, which a stylesheet beats. It runs only on the dense path, so a
 * Recharts change cannot reach isolate on the rail or on a phone.
 */
function rules(): Record<string, Record<string, number>> {
  return {
    [`& .recharts-line:not(.${LIT_CLASS}) .recharts-line-curve`]: {
      strokeOpacity: REST,
    },
    [`&[data-lit] .recharts-line:not(.${LIT_CLASS}) .recharts-line-curve`]: {
      strokeOpacity: DIM,
    },
  };
}

// Frozen at module load and handed out by reference. A pen built per call would
// hand emotion a new object on every render, which re-serializes the class and
// throws away the one property the field costs nothing for: that a focus change
// touches no series prop at all.
const FIELD_PEN_STEP: FieldPen = {
  restOpacity: REST,
  dimOpacity: DIM,
  width: 1,
  litWidth: 2.5,
  css: rules(),
};

const FIELD_PEN_MONOTONE: FieldPen = {
  restOpacity: REST,
  dimOpacity: DIM,
  width: 1.25,
  litWidth: 3,
  css: rules(),
};

/**
 * The pen a panel draws with, or null to keep the per-series one it has always
 * used. Null is the signal to leave the existing code path alone rather than a
 * pen with neutral values: the sparse path dims through props and composites
 * its dots against that, and routing it through a field it does not need would
 * change what a twenty-curve rail looks like.
 */
export function fieldPen(drawn: number, view: ChartView): FieldPen | null {
  if (drawn <= CHART_FIELD_THRESHOLD) return null;
  return view === 'pmf' ? FIELD_PEN_STEP : FIELD_PEN_MONOTONE;
}
