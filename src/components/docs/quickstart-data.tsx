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
      'Click + Add roll. A new row appears with the default 1d20. Click its name to rename it, for example "Attack roll".',
    body: (
      <Stack gap={2}>
        <Text>
          Click <strong>+ Add roll</strong>. A new row appears with the default{' '}
          <Code>1d20</Code>. Click the name to rename it (e.g. “Attack roll”).
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
      'DiceTable uses standard tabletop shorthand. Tap any token to edit it inline. For example, 4d6kh3+2 means roll four six-sided dice, keep the highest 3, then add 2. A roll can also count successes instead of adding: switch the Sum / Pool toggle under the dice and the notation reads like 7d10 · count ≥8, meaning "out of seven d10s, how many show 8 or higher".',
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
          Switch the <strong>Sum / Pool</strong> toggle under the dice and the
          notation reads like <Code>7d10 · count ≥8</Code>: out of seven
          d10s, how many show 8 or higher?
        </Text>
      </Stack>
    ),
  },
  {
    n: 3,
    title: 'Read the chart',
    plain:
      'The bottom panel overlays every row. Switch views with the toggle above the chart: PMF shows how often each exact total comes up, CDF shows the chance of at most N, CCDF shows the chance of at least N, and TARGET shows a hit-rate bar per row once a target is set.',
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
            <strong>TARGET</strong>. Appears once you set a target (Step 7);
            shows a hit-rate bar per row.
          </List.Item>
        </List.Root>
        <Text>
          The <strong>Shape</strong> sparkline in each row mirrors the active
          view. Click it (or the Mean / σ values) to open a larger inspector.
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
      'Each die part in the expanded row has its own modifiers: keep the highest or lowest N (kh3, kl1), reroll specific faces once or always, or explode a chosen face to roll again and add.',
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
      </Stack>
    ),
  },
  {
    n: 6,
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
    n: 7,
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
    n: 8,
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
    n: 9,
    title: 'Share and import',
    plain:
      'Use Share in the top bar to copy a link, copy raw JSON, or download a .json file. Opening a link loads the same rolls; importing a file or JSON lets you merge into the current table or replace it.',
    body: (
      <Text>
        Use <strong>Share</strong> in the top bar to copy a link, copy raw
        JSON, or download a <Code>.json</Code> file. Anyone opening the link
        gets the same rolls; importing a file or JSON lets you merge into the
        current table or replace it.
      </Text>
    ),
  },
];
