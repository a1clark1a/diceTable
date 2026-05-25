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
    plain: 'A flat number added to every roll’s total.',
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
      'A simulated dice roller you can run on any row. History stays until you reload the page.',
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
  rollModeNormal: 'Roll once.',
  rollModeAdvantage: 'Roll twice and take the higher result.',
  rollModeDisadvantage: 'Roll twice and take the lower result.',
  inspectDistribution:
    'See the chance of every result. Useful for double-checking the stats above.',
  inspectMean:
    'How the average is built. Each row shows what that result contributes to the mean.',
  inspectMode: 'The results most likely to come up, ordered by chance.',
  inspectSigma:
    'The shaded band is one σ either side of the mean. Most rolls land here.',
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
