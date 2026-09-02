import type { ReactNode } from 'react';
import { Code, List, Stack, Text } from '@chakra-ui/react';

export interface QuickstartStep {
  n: number;
  title: string;
  /** Flat-text summary for structured data (HowTo). The JSX `body` is the display. */
  plain: string;
  body: ReactNode;
}

export const quickstartSteps: readonly QuickstartStep[] = [
  {
    n: 1,
    title: 'Add your first roll',
    plain:
      'Click + Add roll. A new row appears with the default 1d20. Click its name to rename it, for example "Attack roll". Prefer a head start? An empty table offers "Start with an example" with ready-made rolls, and the Examples button keeps the same rolls available once your table has rows.',
    body: (
      <Stack gap={2}>
        <Text>
          Click <strong>+ Add roll</strong>. A new row appears with the default{' '}
          <Code>1d20</Code>. Click the name to rename it (e.g. “Attack roll”).
        </Text>
        <Text>
          Prefer a head start? An empty table offers{' '}
          <strong>Start with an example</strong> with ready-made rolls, and the{' '}
          <strong>Examples</strong> button keeps the same rolls available once
          your table has rows.
        </Text>
        <Text color="fg.muted" fontSize="sm">
          The colored swatch on the left of each row matches that row’s color
          in the comparison chart below.
        </Text>
      </Stack>
    ),
  },
  {
    n: 2,
    title: 'Read dice notation',
    plain:
      'DiceTable uses standard tabletop shorthand. Tap any token to edit it inline. For example, 4d6kh3+2 means roll four six-sided dice, keep the highest 3, then add 2. A roll can also count successes instead of adding: switch the Sum / Pool / Check toggle under the dice to Pool and the notation reads like 7d10 · count ≥8, meaning "out of seven d10s, how many show 8 or higher". Check is the third setting, for rolls that decide whether something happens: 1d20 + 7 ≥15 → 1d8 + 4 reads as "roll 1d20+7, succeed on 15 or more, then deal 1d8+4".',
    body: (
      <Stack gap={2}>
        <Text>
          DiceTable uses the standard tabletop shorthand. Tap any token in the
          table to edit it inline. For example, <Code>4d6kh3+2</Code> reads
          as:
        </Text>
        <List.Root pl={5}>
          <List.Item>
            <strong>4d6</strong>. Roll four six-sided dice.
          </List.Item>
          <List.Item>
            <strong>kh3</strong>. Keep the highest 3 of those rolls.
          </List.Item>
          <List.Item>
            <strong>+2</strong>. Add 2 to the kept total.
          </List.Item>
        </List.Root>
        <Text>
          A roll can also <strong>count successes</strong> instead of adding.
          Switch the <strong>Sum / Pool / Check</strong> toggle under the dice
          to <strong>Pool</strong> and the notation reads like{' '}
          <Code>7d10 · count ≥8</Code>: out of seven d10s, how many show 8 or
          higher?
        </Text>
        <Text>
          <strong>Check</strong> is the third setting, for rolls that decide
          whether something happens: <Code>1d20 + 7 ≥15 → 1d8 + 4</Code> reads
          as "roll 1d20+7, succeed on 15 or more, then deal 1d8+4". Step 6
          covers it.
        </Text>
      </Stack>
    ),
  },
  {
    n: 3,
    title: 'Read the chart',
    plain:
      'The bottom panel overlays every row. Switch views with the toggle above the chart: PMF shows how often each exact total comes up, CDF shows the chance of at most N, CCDF shows the chance of at least N, and TARGET shows a hit-rate bar per row once a target is set. A check roll that misses often would pile that chance onto one bar, so on PMF that bar is cut off and labelled with the real number.',
    body: (
      <Stack gap={2}>
        <Text>
          The bottom panel overlays every row. Switch views with the toggle
          above the chart:
        </Text>
        <List.Root pl={5}>
          <List.Item>
            <strong>PMF</strong>. How often each exact total comes up.
          </List.Item>
          <List.Item>
            <strong>CDF</strong>. Chance of rolling at most N.
          </List.Item>
          <List.Item>
            <strong>CCDF</strong>. Chance of rolling at least N (best for
            “beat the DC” questions).
          </List.Item>
          <List.Item>
            <strong>TARGET</strong>. Appears once you set a target (Step 8);
            shows a hit-rate bar per row.
          </List.Item>
        </List.Root>
        <Text>
          The <strong>Shape</strong> sparkline in each row mirrors the active
          view. Click it (or the Mean / σ values) to open a larger inspector.
        </Text>
        <Text color="fg.muted" fontSize="sm">
          A check roll that misses often would pile all of that chance onto one
          bar and flatten everything else. On PMF that bar is cut off and
          labelled with the real number, which is also on the tooltip.
        </Text>
      </Stack>
    ),
  },
  {
    n: 4,
    title: 'Expand a row to edit details',
    plain:
      'Click the chevron on the right of any row to expand it. From there you can add more dice parts and set the roll mode: Normal, Advantage, or Disadvantage.',
    body: (
      <Stack gap={2}>
        <Text>
          Click the chevron on the right of any row to expand it. The
          expanded panel lets you tweak two things:
        </Text>
        <List.Root pl={5}>
          <List.Item>
            <strong>Dice parts</strong>. Add more dice (e.g. a <Code>1d6</Code>{' '}
            sneak attack on top of a <Code>1d8</Code> weapon).
          </List.Item>
          <List.Item>
            <strong>Roll mode</strong>. Normal, Advantage (roll twice, take
            higher), or Disadvantage (roll twice, take lower).
          </List.Item>
        </List.Root>
      </Stack>
    ),
  },
  {
    n: 5,
    title: 'Per-die modifiers: keep, reroll, explode',
    plain:
      'Each die part in the expanded row has its own modifiers: keep the highest or lowest N (kh3, kl1), reroll specific faces once or always, or explode a chosen face to roll again and add. Below the parts, Keep across parts lifts keeping to the whole roll so dice of different sizes can be weighed against each other: 1d8 + 1d6 · keep highest 1 rolls both and counts only the better one, and turning it on switches the per-part Keep chips off.',
    body: (
      <Stack gap={2}>
        <Text>
          Each die part in the expanded row has its own modifiers:
        </Text>
        <List.Root pl={5}>
          <List.Item>
            <strong>Keep</strong> highest or lowest N from the pool
            (<Code>kh3</Code>, <Code>kl1</Code>).
          </List.Item>
          <List.Item>
            <strong>Reroll</strong> specific faces, once or always
            (e.g. great-weapon fighting: reroll 1s and 2s once).
          </List.Item>
          <List.Item>
            <strong>Explode</strong>. When a chosen face comes up, roll again
            and add (open-ended rolls).
          </List.Item>
        </List.Root>
        <Text>
          Below the parts, <strong>Keep across parts</strong> lifts keeping to
          the whole roll, so dice of different sizes can be weighed against
          each other: <Code>1d8 + 1d6 · keep highest 1</Code> rolls both and
          counts only the better one. Turning it on switches the per-part Keep
          chips off, since the two say the same thing twice.
        </Text>
      </Stack>
    ),
  },
  {
    n: 6,
    title: 'Roll a check, then apply an effect',
    plain:
      'Switch a row to Check when the roll decides whether something happens: it rolls against a number you set, then applies an effect scaled by how it went. Fill in the check die and its modifier, the number it has to clear, the effect dice, and what lands on a success and on a failure. Full on a success and nothing on a failure is an attack; half on a success and full on a failure is a save-for-half spell. On a single check die you can also add a critical: pick the faces and whether it doubles the dice, adds one more, or adds the highest the dice can show. The row average then counts the misses too, which is the number worth balancing.',
    body: (
      <Stack gap={2}>
        <Text>
          Some rolls decide whether something happens rather than how much.
          Switch a row to <strong>Check</strong> and it rolls against a number
          first, then applies an effect scaled by how that went. The expanded
          row asks for three things:
        </Text>
        <List.Root pl={5}>
          <List.Item>
            <strong>Check</strong>. The die you roll, its modifier, and the
            number it has to clear. The percentage beside it updates as you
            change either side.
          </List.Item>
          <List.Item>
            <strong>Effect</strong>. The dice that land, with their own
            modifier. Add parts the same way you would on any roll.
          </List.Item>
          <List.Item>
            <strong>Outcomes</strong>. How much of the effect applies on a
            success and on a failure: all of it, half of it, or none.
          </List.Item>
        </List.Root>
        <Text>
          Full on a success and nothing on a failure is an attack:{' '}
          <Code>1d20 + 7 ≥15 → 1d8 + 4</Code>. Half on a success and full on a
          failure is a save-for-half spell. On a check of exactly one die you
          can add a <strong>Critical</strong> as well: pick the faces, then
          whether it rolls double the dice, one extra die, or adds the highest
          the dice can show.
        </Text>
        <Text color="fg.muted" fontSize="sm">
          A check row’s average counts the misses, so it is the average per
          attempt rather than the average when it lands. That is the number to
          balance two mechanics against each other with.
        </Text>
      </Stack>
    ),
  },
  {
    n: 7,
    title: 'Compare rolls',
    plain:
      'Add more rows. Each appears in the chart with its own color, matching its swatch in the table. Hover or tab to a name in the legend to dim the others and focus a single series.',
    body: (
      <Text>
        Add more rows. Each appears in the chart with its own color, matching
        the swatch in the table. Hover (or tab to) a name in the chart legend
        to dim the others and focus a single series.
      </Text>
    ),
  },
  {
    n: 8,
    title: 'Set targets and read Hit %',
    plain:
      'Type one or more targets in the toolbar, for example AC 14 or save DC 16. A Hit % column shows how often each row clears each target, using the comparison you pick: at least, greater than, at most, less than, or exactly.',
    body: (
      <Stack gap={2}>
        <Text>
          Type one or more targets in the toolbar (e.g. AC 14, save DC 16). A
          new <strong>Hit %</strong> column appears showing how often each row
          clears each target.
        </Text>
        <Text>
          The dropdown next to <strong>Target</strong> picks how a roll is
          compared:
        </Text>
        <List.Root pl={5}>
          <List.Item>
            <strong>≥ at least</strong>. Equal or above counts (default; the
            classic “beat the DC” case).
          </List.Item>
          <List.Item>
            <strong>&gt; greater than</strong>. Strictly above; ties miss.
          </List.Item>
          <List.Item>
            <strong>≤ at most</strong> / <strong>&lt; less than</strong>. For
            roll-under systems and damage caps.
          </List.Item>
          <List.Item>
            <strong>= exactly</strong>. Match a specific result.
          </List.Item>
        </List.Root>
        <Text>
          With targets set, switch the chart to <strong>TARGET</strong> to see
          per-row hit-rate bars side by side.
        </Text>
      </Stack>
    ),
  },
  {
    n: 9,
    title: 'Switch workshop views',
    plain:
      'The chips above the table switch between four views of the same rolls. Table & chart is the editable list with the overlay chart. Target hit compares every roll against your targets as a grid, curves, or bars. Roll-off shows each roll’s chance of having the single highest result if every roll rolled once. Head-to-head is a matrix of one-on-one odds: how often the row roll beats the column roll, ignoring everyone else.',
    body: (
      <Stack gap={2}>
        <Text>
          The chips above the table switch between four views of the same
          rolls:
        </Text>
        <List.Root pl={5}>
          <List.Item>
            <strong>Table &amp; chart</strong>. The editable list and overlay
            chart from the steps above.
          </List.Item>
          <List.Item>
            <strong>Target hit</strong>. Every roll against every target at
            once, as a sortable grid, curves, or bars (needs a target from
            Step 8).
          </List.Item>
          <List.Item>
            <strong>Roll-off</strong>. If every roll rolled once, each one’s
            chance of having the single highest result. Ties are counted
            separately; nobody wins those outright.
          </List.Item>
          <List.Item>
            <strong>Head-to-head</strong>. A matrix of one-on-one odds: how
            often the row roll beats the column roll, ignoring everyone
            else. Hover or tap a cell for the full sentence.
          </List.Item>
        </List.Root>
        <Text color="fg.muted" fontSize="sm">
          Roll-off and Head-to-head need at least two rolls with valid dice.
          Pool rows join on their success-count scale, so those match-ups
          are usually lopsided.
        </Text>
      </Stack>
    ),
  },
  {
    n: 10,
    title: 'Roll the dice',
    plain:
      'Click the dice icon on any Sum roll to roll it. The result appears next to the row, and the popover can roll a batch of 1 to 1000 to show the average, the range, and recent history. The roller uses the same odds the chart shows.',
    body: (
      <Text>
        Click the <strong>dice icon</strong> on any Sum roll to actually roll
        it.
        The result appears next to the row, and the popover lets you roll a
        batch of 1 to 1000 to see the average, the range, and recent history.
        The roller uses the same odds the chart shows, so it’s a sanity
        check, not a different source of numbers.
      </Text>
    ),
  },
  {
    n: 11,
    title: 'Share and import',
    plain:
      'Use Share in the top bar to copy a link, copy raw JSON, or download a .json file. Opening a link loads the same rolls; importing a file or JSON lets you merge into the current table or replace it. The Image button above the chart makes a picture of the comparison you can paste into a chat, and copying it puts the link on the clipboard as text at the same time.',
    body: (
      <Stack gap={2}>
        <Text>
          Use <strong>Share</strong> in the top bar to copy a link, copy raw
          JSON, or download a <Code>.json</Code> file. Anyone opening the link
          gets the same rolls; importing a file or JSON lets you merge into the
          current table or replace it.
        </Text>
        <Text>
          The <strong>Image</strong> button above the chart makes a picture of
          the comparison to paste into a chat or a forum thread, with an
          optional title. Copying it puts the link on the clipboard as text at
          the same time, so pasting into a message box gives the picture and
          pasting into a text field gives the link.
        </Text>
      </Stack>
    ),
  },
];
