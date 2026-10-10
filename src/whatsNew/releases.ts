export interface Release {
  /** Matches a `## [X.Y.Z]` heading in CHANGELOG.md. */
  version: string;
  /** YYYY-MM-DD, the date on that heading. */
  date: string;
  title: string;
  highlights: readonly string[];
}

// Newest first. A release cut adds its entry here in the same edit that dates
// the CHANGELOG section and bumps package.json; releases.test.ts fails until
// all three agree. Write for players, not developers: one plain sentence per
// highlight, what they will see or can now do, no em-dashes.
export const RELEASES: readonly Release[] = [
  {
    version: '2.3.0',
    date: '2026-10-10',
    title: "Find a roll and What's new",
    highlights: [
      'Examples is now Find a roll, a searchable library of ready-made rolls for the games people play, like Blades, Shadowrun and 40k.',
      "Each recipe card says what the roll is also called, why it is built that way, and anything it leaves out of the game's rules.",
      'After an update, What\'s new shows what changed since your last visit, and the version in the footer opens the full list any time.',
      'Find a roll has its own button on a phone too, and an empty table offers it from your first visit.',
      "On a phone, the Target view's Edit buttons no longer run off the right edge of the screen.",
    ],
  },
  {
    version: '2.2.0',
    date: '2026-09-14',
    title: 'Keep-the-best odds, even for exploding dice',
    highlights: [
      'Keeping only some of your dice when they can explode no longer freezes the page.',
      'Big keep-the-best rolls, like the best few of twenty d20s or a hundred d100s, no longer stop at "(too complex)" and show their odds.',
      'Dark mode no longer flashes light for a moment when the page loads.',
      'The warning for endless exploding no longer misfires, so a roll that truly never stops gets a reason instead of a blank row.',
      'A few rolls that pair very large dice with keeping the best, like three d1000 keeping two, now say "(too complex)" instead of showing odds.',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-09-14',
    title: 'A fresh look with room for big tables',
    highlights: [
      'On a wide screen the chart now sits beside the table, so you can edit a roll and watch its curve move without scrolling.',
      'Light and dark mode get a new color palette, and neighboring rolls stay easy to tell apart with red-green color blindness.',
      'Big tables get a comparison chart again, drawn twenty rolls at a time with previous and next buttons to reach the rest.',
      'You can now enlarge a chart on a wide screen to see every roll at once, then pick a name in the legend to light it up.',
      'Target and Pool target are now single buttons that show what you set and open an editor, so the bar stays on one line.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-09-07',
    title: 'Check rolls and shareable pictures',
    highlights: [
      'You can now roll a check against a number you set and apply an effect based on how it went, like attack then damage or save for half.',
      'Keeping the highest dice now works across different sizes, such as the best of a d8 and a d6 for a trait and wild die roll.',
      'A new Image button makes a picture of any view that you can save, or copy together with the share link.',
      'Target hit and Roll-off now remember your Grid, Curves, or Bars choice, filter, and sort order when you leave and come back.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-08-24',
    title: 'Example rolls and a Clear all button',
    highlights: [
      'Your first visit, or any empty table, now shows eight example rolls to pick from, each with its average and range.',
      'Once your table has rolls, a new Examples button opens those same eight rolls so you can add more.',
      'Clear all, a new button beside Add roll, empties your whole table after you confirm.',
      'Every Add roll button now turns off at the 100-roll limit, with a tooltip that tells you why.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-08-22',
    title: 'A new icon and Docs pages you can bookmark',
    highlights: [
      'DiceTable has a new icon (a twenty-sided die under a wooden table) for your browser tab, home screen, and shared links.',
      'Quickstart, Glossary, and The Math each have their own page in the Docs, so you can bookmark or share the one you need.',
      'Docs links you saved earlier still work and now take you straight to the matching section.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-08-16',
    title: 'Roll-off and Head-to-head views',
    highlights: [
      "The new Roll-off view shows each roll's chance of coming out on top if every roll is rolled once.",
      'The new Head-to-head view shows how often each roll beats every other roll one on one.',
      'Each Head-to-head cell shows the full odds, including the chance of a tie, when you hover or tap it.',
      'Both views give exact odds worked out from your dice, never a simulated guess.',
      'The Docs now explain both views, with Glossary entries for Roll-off, Head-to-head, and Tie.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-08-11',
    title: 'Baseline comparisons with plain verdicts',
    highlights: [
      'You can now pin any roll as your baseline, and the other rolls show how they differ from it.',
      "A short verdict under every other roll's name sums up the difference, like how much higher it averages and how much more often it hits.",
      'Green means better and red means worse, while changes in swing stay neutral because more swing is not always better.',
      'The ≥ and ≤ ruling tooltips now give their common names, roll over (as in D&D) and roll under (as in Call of Cthulhu).',
      'Bar labels in the TARGET chart view no longer pile on top of each other.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-02',
    title: 'Hit chances against your targets',
    highlights: [
      'You can now open a Target hit view to see how reliably each roll meets your targets.',
      "Grid shows every roll's hit chance for every target, color-coded from reliable to long shot, and you can sort by any target.",
      "Curves plots each Sum roll's hit chance at every possible target, with dashed markers at the targets you have set.",
      'Bars gives each target its own panel, with your rolls ranked by how likely they are to hit it.',
      'Pool rolls appear in Grid and Bars against your pool target, and a filter lets you show all rolls, just sums, or just pools.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-07-31',
    title: 'Dice pools that count successes',
    highlights: [
      'Any roll can now switch from Sum to Pool, counting how many dice meet a success number instead of adding them up.',
      'On a Pool roll, the modifier adds or removes successes directly, and a result never drops below zero successes.',
      'A new Pool target sets one "at least this many successes" goal, and every Pool roll\'s Hit % reads against it.',
      'Pool rolls get their own chart of success counts, beside the totals chart on desktop and stacked on phones.',
      'Share links and saved files from before still import, with their rolls set to Sum.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-07-27',
    title: 'One roll mode for the whole table',
    highlights: [
      'You can now set every roll to Normal, Advantage, or Disadvantage at once from the header.',
      'When your rolls use different modes, the header control shows "mixed" so you know they differ.',
      'An Add roll button now appears in the header too, so you no longer scroll to the bottom of the table.',
      'A new view picker sits above the table, with Table & chart as its first view.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-07-17',
    title: 'Open source and a clearer front page',
    highlights: [
      'DiceTable is now open source under the MIT license, so you are free to use, copy, or change it.',
      'A short heading and intro above the roll table now explain what DiceTable does the moment you arrive.',
      'Each page now shows its own title in your browser tab, so your open tabs are easier to tell apart.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-03',
    title: 'Your dice rolls, side by side',
    highlights: [
      "You can build a table of named dice rolls and see each one's average, range, and chance to hit a target you set.",
      'One chart draws your rolls on top of each other, so their odds are easy to compare.',
      'The Docs page walks you through a quick start, a glossary of terms, and the math behind every number.',
      'On a phone, each roll becomes its own card that you can read and edit.',
      'Your table saves in your browser, so your rolls are still there when you come back.',
    ],
  },
];
