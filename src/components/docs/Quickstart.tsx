import type { ReactNode } from 'react';
import { Box, Code, HStack, Heading, List, Stack, Text } from '@chakra-ui/react';

interface QuickstartStep {
  n: number;
  title: string;
  body: ReactNode;
}

const STEPS: readonly QuickstartStep[] = [
  {
    n: 1,
    title: 'Add your first roll',
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
      </Stack>
    ),
  },
  {
    n: 3,
    title: 'Read the chart',
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
    body: (
      <Text>
        Click the <strong>dice icon</strong> on any row to actually roll it.
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

function StepNum({ n }: { n: number }) {
  return (
    <Box
      colorPalette="blue"
      bg="colorPalette.solid"
      color="colorPalette.contrast"
      w="26px"
      h="26px"
      borderRadius="full"
      display="flex"
      alignItems="center"
      justifyContent="center"
      fontSize="xs"
      fontWeight="semibold"
      flexShrink={0}
    >
      {n}
    </Box>
  );
}

function Step({ step, isLast }: { step: QuickstartStep; isLast: boolean }) {
  return (
    <Box
      pb={isLast ? 0 : 8}
      borderBottomWidth={isLast ? 0 : '1px'}
      borderColor="border.subtle"
    >
      <HStack gap={3} align="center" mb={2}>
        <StepNum n={step.n} />
        <Heading as="h3" size="md">
          {step.title}
        </Heading>
      </HStack>
      <Box fontSize="sm" color="fg">
        {step.body}
      </Box>
    </Box>
  );
}

export function Quickstart() {
  return (
    <Stack gap={8}>
      <Text fontSize="md" color="fg.muted">
        DiceTable is one table of named rolls. Each row is a dice expression
        like <Code>4d6kh3+2</Code>. The chart at the bottom overlays every row
        so you can compare them at a glance.
      </Text>
      <Stack gap={8}>
        {STEPS.map((step, idx) => (
          <Step key={step.n} step={step} isLast={idx === STEPS.length - 1} />
        ))}
      </Stack>
    </Stack>
  );
}
