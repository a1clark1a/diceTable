export type GlossaryGroup =
  | 'notation'
  | 'roll-modes'
  | 'statistics'
  | 'distributions'
  | 'app';

export interface GlossaryEntry {
  id: string;
  term: string;
  alt?: string;
  group: GlossaryGroup;
  /** Short, tooltip-friendly definition. Kept to one or two sentences. */
  plain: string;
  /**
   * Optional deeper explanation shown only on the docs page, never in tooltips.
   * Use this to unpack notation, give an example, or say how to read a chart.
   */
  details?: string;
  formal?: string;
}

export const GLOSSARY_GROUP_ORDER: readonly GlossaryGroup[] = [
  'notation',
  'roll-modes',
  'statistics',
  'distributions',
  'app',
];

export const GLOSSARY_GROUP_LABELS: Record<GlossaryGroup, string> = {
  notation: 'Dice notation',
  'roll-modes': 'Roll modes',
  statistics: 'Statistics',
  distributions: 'Distributions and charts',
  app: 'App concepts',
};

export const glossaryEntries: readonly GlossaryEntry[] = [
  {
    id: 'expression',
    term: 'Dice expression',
    alt: 'e.g. 4d6kh3+2',
    group: 'notation',
    plain:
      'The whole formula for one roll: how many dice, what kind, any keep/reroll/explode rules, plus a flat modifier.',
  },
  {
    id: 'count-die',
    term: 'Count and die',
    alt: 'NdS',
    group: 'notation',
    plain: '3d8 means "roll three eight-sided dice and add them."',
  },
  {
    id: 'mod',
    term: 'Modifier',
    alt: '+M / −M',
    group: 'notation',
    plain:
      'A flat number added to every roll’s total. On rolls that count successes, it adds successes instead.',
  },
  {
    id: 'keep',
    term: 'Keep highest / lowest',
    alt: 'khN / klN',
    group: 'notation',
    plain:
      'Keep only the highest or lowest N dice from the pool. For example, 4d6kh3 rolls 4d6 and keeps the 3 highest.',
    details:
      'Read kh / kl as "keep highest" and "keep lowest." The number after the letters is how many dice you keep; the rest are dropped before summing. Keep-highest pulls the average up and shrinks the chance of low rolls; keep-lowest does the opposite. The classic case is 4d6kh3 for D&D ability scores.',
    formal: '4d6kh3 → roll 4d6, drop the lowest, sum 3',
  },
  {
    id: 'reroll',
    term: 'Reroll',
    alt: 'r1, r<3, …',
    group: 'notation',
    plain:
      'Reroll specific faces. "Once" rerolls each die at most once; "always" keeps going until the result is acceptable.',
    details:
      'The number or comparison after r picks which faces trigger a reroll: r1 rerolls only ones, r<3 rerolls anything below three. "Once" replaces each triggering die a single time and accepts whatever comes up next. "Always" keeps rerolling that die until it lands on a face that is not in the trigger set, so the final result can never be one of the rerolled faces.',
  },
  {
    id: 'explode',
    term: 'Explode',
    alt: '!N',
    group: 'notation',
    plain:
      'When a die lands on a chosen face, roll it again and add the result. The chain stops after a few pops to keep the chart readable.',
    details:
      'Each "pop" on the trigger face adds another roll on top, so a single die could in theory stack into very large totals. To keep the chart readable, DiceTable stops the chain after a few pops; any tiny chance left beyond that gets folded into the last rolled face.',
  },
  {
    id: 'pool',
    term: 'Dice pool',
    alt: 'Sum / Pool toggle',
    group: 'notation',
    plain:
      'A roll scored by counting how many dice clear a threshold, instead of adding the faces into one total.',
    details:
      'Switch a roll to Pool in its Dice cell and each die simply succeeds or fails; the result is the number of successes. 7d10 · count ≥8 asks "out of seven d10s, how many show 8 or higher?" Keep and explode only make sense for totals, so they don’t apply while a roll is pooled. Reroll still works, and the per-die odds stay exact.',
  },
  {
    id: 'success',
    term: 'Success',
    group: 'notation',
    plain:
      'One die in a pool that meets the threshold. A pool roll’s result is how many successes came up.',
    details:
      'Successes are all-or-nothing: a die that clears the bar counts as exactly one success, no matter how high it lands. Adding a die to the pool adds at most one success, so pool results grow in small, steady steps compared to totals.',
  },
  {
    id: 'threshold',
    term: 'Success threshold',
    alt: 'count ≥8 / count ≤2',
    group: 'notation',
    plain:
      'Which faces count as a success on each die: at or above (≥) or at or below (≤) the number you pick.',
    details:
      'The threshold applies to every die in the roll, and the direction flips next to the number. Pick ≥ for "high faces are good" systems, like 8 or higher on a d10, and ≤ for roll-under pools. Moving the threshold changes every die’s chance at once, so a one-step nudge can swing the odds more than adding a die.',
  },
  {
    id: 'auto-successes',
    term: 'Auto-successes',
    alt: '+2 auto',
    group: 'notation',
    plain:
      'On a pool roll, the modifier adds or removes successes directly. A roll never drops below zero successes.',
    details:
      'Auto-successes shift the count after the dice are read: +2 auto means two free successes on top of whatever you rolled, and −2 takes two away. They don’t change any die’s chance of succeeding. Penalties can’t push a result below zero; all of that would-be-negative chance lands on exactly zero successes.',
  },

  {
    id: 'advantage',
    term: 'Advantage',
    group: 'roll-modes',
    plain: 'Roll the whole expression twice and take the higher result.',
  },
  {
    id: 'disadvantage',
    term: 'Disadvantage',
    group: 'roll-modes',
    plain: 'Roll the whole expression twice and take the lower result.',
  },

  {
    id: 'mean',
    term: 'Mean',
    alt: 'μ',
    group: 'statistics',
    plain: 'The average result you’d see over many rolls.',
    details:
      'In the formula, k stands for each possible result and P(X = k) is the chance of rolling exactly that result. Multiplying every result by its chance and adding them all up gives the long-run average: the number your actual average creeps toward as you roll more and more times.',
    formal: 'μ = Σ k · P(X = k)',
  },
  {
    id: 'sigma',
    term: 'Standard deviation',
    alt: 'σ',
    group: 'statistics',
    plain:
      'How spread out the results are. Lower σ means more consistent rolls.',
    details:
      'σ has the same units as the result itself, so you can read it as "rolls typically land within about σ of the mean." Two rolls with the same average can have very different σ. A flat 1d20 spreads much wider than 3d6, even though both average around 10.',
    formal: 'σ = √( Σ (k − μ)² · P(X = k) )',
  },
  {
    id: 'variance',
    term: 'Variance',
    alt: 'σ²',
    group: 'statistics',
    plain:
      'Standard deviation squared. Useful because variances of independent rolls add together.',
    details:
      'On its own, variance is awkward to read because the units come out squared. The handy thing about it is that when you combine two independent rolls, their variances simply add together. Standard deviations don’t behave that way, which is why σ² shows up inside the math even when σ is what ends up on the row.',
  },
  {
    id: 'mode',
    term: 'Mode',
    group: 'statistics',
    plain:
      'The result(s) you’ll see most often. When many results are equally likely, only a few are shown. Click to see all of them.',
    details:
      'A flat distribution (like a single d20) has no single mode: every face is equally likely. Sums of multiple dice peak in the middle, so the mode is usually close to the mean. When a few results tie for the top spot, the cell shows the first couple and lets you click through to see the rest.',
  },
  {
    id: 'range',
    term: 'Range',
    group: 'statistics',
    plain: 'The smallest and largest possible results.',
    details:
      'Range only tells you what is possible, not what is likely. An exploding die can push the upper number very high even when those big results are extremely rare; reroll rules can lift the lower number above the smallest face printed on the die.',
  },
  {
    id: 'hit',
    term: 'Hit probability',
    group: 'statistics',
    plain:
      'How often each row meets the target. With multiple targets, you’ll see one row per target.',
    details:
      '"Meets the target" depends on the comparison you pick in the target toolbar (≥, >, ≤, <, =). Hit % just adds up the chance of every result that counts as a hit. A roll with a long stretch of high results will land ≥ targets more often than its average alone would suggest.',
  },

  {
    id: 'distribution',
    term: 'Distribution',
    group: 'distributions',
    plain:
      'The full picture of "what can happen and how likely each outcome is." Every chart in DiceTable is a view of one.',
    details:
      'Wherever you see P in DiceTable, it stands for "probability," a number between 0 and 1 (shown as a percent) that says how likely something is. P(X = k) reads as "the chance that the result X equals the number k." The shorthand "cum" you’ll spot in some labels is short for "cumulative," a running total of those chances as you sweep across the results from low to high. Across the whole distribution, those chances always add up to exactly 1 (100%). The three chart modes are just different ways of looking at the same numbers: PMF shows each chance on its own, CDF shows the running total from the left, and CCDF shows the running total from the right.',
  },
  {
    id: 'pmf',
    term: 'PMF',
    alt: 'probability mass function',
    group: 'distributions',
    plain: 'How likely each exact result is. (Probability Mass Function.)',
    details:
      'On a PMF chart the height of each bar is P(X = k), the chance of rolling exactly k. Bars never overlap and the heights across one row add up to 100%. Read it for shape: where the peak sits (most likely result), how wide the spread is (consistency), and whether the curve leans left or right (skew).',
  },
  {
    id: 'cdf',
    term: 'CDF',
    alt: 'cumulative distribution function',
    group: 'distributions',
    plain:
      'How often you’ll roll at most a given number. (Cumulative Distribution Function.)',
    details:
      'A CDF curve at value k is P(X ≤ k), the chance of rolling k or less. It starts at 0 on the far left, climbs as you sweep right, and ends at 1 (100%). The steeper the climb, the tighter the distribution. Use it to answer "how often do I fail by this much or more?"',
  },
  {
    id: 'ccdf',
    term: 'CCDF',
    alt: 'complementary CDF',
    group: 'distributions',
    plain:
      'How often you’ll roll at least a given number. Useful for "beat the DC" checks. (Complementary CDF.)',
    details:
      'A CCDF curve at value k is P(X ≥ k), the chance of rolling k or more, which is just 1 minus the CDF. It starts at 1 (100%) on the far left and falls toward 0 on the right. To read a target, find your DC on the x-axis and look up: that height is your hit chance against ≥ DC.',
  },
  {
    id: 'convolution',
    term: 'Convolution',
    group: 'distributions',
    plain:
      'The math operation that combines two independent dice into the distribution of their sum. See "The Math" tab for how it works.',
    details:
      'Convolution is why 2d6 peaks at 7 instead of being flat: every way of making 7 (1+6, 2+5, 3+4, 4+3, 5+2, 6+1) adds up, while only one way makes 2 or 12. DiceTable does this combine-step for every extra die and every modifier in your roll. Nothing gets rounded or estimated; the result is the true odds of the sum.',
  },

  {
    id: 'row',
    term: 'Row / Roll',
    group: 'app',
    plain:
      'One named line in the table. Each row is independent and gets its own chart series.',
    details:
      'Rows do not interact. Changing one never affects the math on another. Their order in the table is also their order in the chart legend and the color palette, so dragging a row also moves its chart series.',
  },
  {
    id: 'baseline',
    term: 'Baseline',
    group: 'app',
    plain:
      'The roll you compare the others against. Pin a row to make it the baseline. Every other row then shows how it differs instead of its own totals.',
  },
  {
    id: 'target',
    term: 'Target',
    group: 'app',
    plain:
      'Reference numbers like ACs or save DCs, up to 5. Press Enter to add each; the Hit % column shows how often each row meets each one.',
    details:
      'Targets live in the toolbar above the table and apply to every row at once. Add up to five. That limit keeps the Hit % column readable on mobile. The comparison used (≥, >, ≤, <, =) is set once for all targets in the dropdown to the left of the chips.',
  },
  {
    id: 'target-ruling',
    term: 'Target ruling',
    alt: '≥ / > / ≤ / < / =',
    group: 'app',
    plain:
      'The comparison the target toolbar uses to decide what counts as a hit: ≥ at least, > greater than, ≤ at most, < less than, or = exactly.',
    details:
      'The ruling applies to every target chip at once; you can\'t mix ≥ for one and ≤ for another. Pick ≥ for the usual "beat the DC" reading, ≤ for save-or-suck-style "stay under" checks, and = when you only care about hitting an exact number (for example, a critical face). Switching the ruling instantly recomputes every Hit % cell.',
  },
  {
    id: 'inspect',
    term: 'Inspect',
    group: 'app',
    plain:
      'Click any stat to open an Inspect panel that shows where that number comes from. Useful for double-checking results.',
    details:
      'Each stat has its own Inspect view: the mean panel breaks the average down by what each die contributes, the σ panel highlights the band around the mean where most rolls actually land, and the distribution panel lays out the chance of every result in a table. Inspect is read-only. Close it to get back to editing.',
  },
  {
    id: 'roller',
    term: 'Roller',
    group: 'app',
    plain:
      'A simulated dice roller you can run on any roll that adds up a total. History stays until you reload the page.',
    details:
      'The roller is a sanity check, not where the numbers on each row come from. Those numbers are worked out from the exact odds, not from these sample rolls. Use the roller to feel out variance: rolling 4d6kh3 a dozen times will rarely match the calculated average, and that gap is exactly what the σ value is measuring.',
  },
];

const uiTips: Record<string, string> = {
  meanSigma:
    'The average result, with how spread out rolls land around it. Lower σ means more consistent rolls.',
  targetView:
    'Shows each row’s chances against your targets. Bars left to right go in target order.',
  roll: 'Open the roller. Pick how many times to roll, see recent results. History stays until you reload the page.',
  rollMode:
    'Applies to the whole roll. Advantage rolls twice and takes the higher; disadvantage rolls twice and takes the lower.',
  globalRollMode:
    'Sets one roll mode for every roll in the list. Mixed means rows currently differ, and rolls that count successes ignore it.',
  rollModeNormal: 'Roll once.',
  rollModeAdvantage: 'Roll twice and take the higher result.',
  rollModeDisadvantage: 'Roll twice and take the lower result.',
  explodeDepthCap:
    'How many extra times a single die can keep exploding. A lower cap keeps the chart simple; a higher one captures rare runaway rolls.',
  inspectDistribution:
    'See the chance of every result. Useful for double-checking the stats above.',
  inspectMean:
    'How the average is built. Each row shows what that result contributes to the mean.',
  inspectMode: 'The results most likely to come up, ordered by chance.',
  inspectSigma:
    'The shaded band is one σ either side of the mean. Most rolls land here.',
  sumMode:
    'Add the faces together into one total. The classic damage-roll style.',
  poolMode:
    'Count how many dice meet a threshold instead of adding them into a total. The row then shows successes, not totals.',
  successThreshold:
    'Which faces count as a success on each die. Pick the direction and the number, like 8 or higher on a d10.',
  successDirection:
    'A die succeeds when it lands at or above (≥) or at or below (≤) the number. Click to flip.',
  poolTarget:
    'How many successes count as a hit for every pool row. Sum rows keep using the targets in the toolbar.',
  totalsChart:
    'Sum rolls compare here. The bottom axis shows each possible total.',
  successesChart:
    'Pool rolls compare here. The bottom axis counts successes, not totals.',
  poolAutoSuccess:
    'Added straight to the number of successes. It doesn’t change each die’s chance. A roll never goes below zero successes.',
  keepDisabledInPool:
    'Keep highest or lowest applies when dice add into a total. Switch this roll back to Sum to use it.',
  explodeDisabledInPool:
    'Explode adds bonus rolls into a total. Switch this roll back to Sum to use it.',
  rollModeIgnoredInPool:
    'This roll counts successes, so advantage and disadvantage have no effect on it. The setting is kept for when you switch back to Sum.',
  targetGridName:
    'Shows rolls in table order. Click to clear sorting.',
  targetGridSort:
    'Click to sort rolls by this target. Another click flips the order, one more clears it.',
  targetCurves:
    'Each line shows a roll’s chance to hit for every possible target at once. Dashed lines mark your current targets.',
  targetBars:
    'How often each roll meets this target. Longer, greener bars mean more reliable.',
  deltaAvg:
    'How much this roll’s average is above or below the baseline. Green means higher, red lower.',
  deltaSpread:
    'How much more or less spread out this roll is than the baseline. Neither direction is automatically better.',
  deltaHit:
    'How much more or less often this roll meets the target than the baseline, in percentage points.',
  baselinePin: 'Pin as baseline to compare the other rolls against it.',
  baselinePinActive: 'This is the baseline. Tap again to clear it.',
  share:
    'Copy a link, copy JSON, or download a file of your rolls. Anyone with the link sees the same table.',
  import:
    'Bring rolls in from a share link, JSON, or a file. Choose to add to the table or replace it.',
};

export function getEntry(id: string): GlossaryEntry | undefined {
  return glossaryEntries.find((entry) => entry.id === id);
}

export function tipForId(id: string): string {
  const entry = getEntry(id);
  if (entry) return entry.plain;
  const ui = uiTips[id];
  if (ui !== undefined) return ui;
  return '';
}
