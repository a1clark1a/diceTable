import type { ReactNode } from 'react';
import { Box, Code, HStack, Heading, List, Stack, Text } from '@chakra-ui/react';
import { Screenshot } from './Screenshot';

interface Annotation {
  n: number;
  body: ReactNode;
}

interface QuickstartStep {
  n: number;
  title: string;
  body: ReactNode;
  screenshot: { src: string; alt: string; caption?: string };
  annotations?: Annotation[];
}

const STEPS: readonly QuickstartStep[] = [
  {
    n: 1,
    title: 'Add your first roll',
    body: (
      <Text>
        Click <strong>+ Add roll</strong>. A new row appears with the default{' '}
        <Code>1d20</Code>. Click the name to rename it (e.g. “Attack roll”).
      </Text>
    ),
    screenshot: {
      src: '/docs/screenshots/quickstart-01.png',
      alt: 'Empty table with the Add roll button highlighted',
      caption:
        'Empty table → click + Add roll → first row appears with name field focused.',
    },
    annotations: [
      {
        n: 1,
        body: (
          <Text>
            The colored swatch on the left matches the row’s color in the
            chart below.
          </Text>
        ),
      },
    ],
  },
  {
    n: 2,
    title: 'Read dice notation',
    body: (
      <Text>
        DiceTable uses the standard tabletop shorthand. Tap any token in the
        table to edit it inline.
      </Text>
    ),
    screenshot: {
      src: '/docs/screenshots/quickstart-02.png',
      alt: 'Close-up of a 4d6kh3+2 expression with each segment labeled',
      caption:
        'Close-up of “4d6kh3+2” with each segment labeled: count / die / keep / modifier.',
    },
    annotations: [
      {
        n: 1,
        body: (
          <Text>
            <strong>4d6</strong> — roll four six-sided dice.
          </Text>
        ),
      },
      {
        n: 2,
        body: (
          <Text>
            <strong>kh3</strong> — keep the highest 3 of those rolls.
          </Text>
        ),
      },
      {
        n: 3,
        body: (
          <Text>
            <strong>+2</strong> — add 2 to the kept total.
          </Text>
        ),
      },
    ],
  },
  {
    n: 3,
    title: 'Read the chart',
    body: (
      <Stack gap={2}>
        <Text>The bottom panel can show three views of the same data:</Text>
        <List.Root pl={5}>
          <List.Item>
            <strong>PMF</strong> — how often each exact total comes up.
          </List.Item>
          <List.Item>
            <strong>CDF</strong> — chance of rolling at most N.
          </List.Item>
          <List.Item>
            <strong>CCDF</strong> — chance of rolling at least N (best for
            “beat the DC” questions).
          </List.Item>
        </List.Root>
      </Stack>
    ),
    screenshot: {
      src: '/docs/screenshots/quickstart-03.png',
      alt: 'Overlay chart with two rows visible, switching PMF / CDF / CCDF',
      caption:
        'Overlay chart with two rows visible — switching PMF / CDF / CCDF.',
    },
  },
  {
    n: 4,
    title: 'Roll modes — advantage and disadvantage',
    body: (
      <Text>
        Use the <strong>Mode</strong> column to set how the whole roll
        resolves. Advantage rolls twice and takes the higher; disadvantage
        rolls twice and takes the lower.
      </Text>
    ),
    screenshot: {
      src: '/docs/screenshots/quickstart-04.png',
      alt: 'Mode selector open with Normal, Advantage, and Disadvantage options',
      caption: 'Mode selector open with Normal / Advantage / Disadvantage.',
    },
  },
  {
    n: 5,
    title: 'Keep, reroll, and explode',
    body: (
      <Stack gap={2}>
        <Text>
          Each die part can have its own modifiers. Expand a row to access:
        </Text>
        <List.Root pl={5}>
          <List.Item>
            <strong>Keep</strong> highest or lowest N from the pool.
          </List.Item>
          <List.Item>
            <strong>Reroll</strong> specific faces — once or always.
          </List.Item>
          <List.Item>
            <strong>Explode</strong> — re-roll on a chosen face and add.
          </List.Item>
        </List.Root>
      </Stack>
    ),
    screenshot: {
      src: '/docs/screenshots/quickstart-05.png',
      alt: 'Expanded row showing keep, reroll, and explode sub-controls',
      caption: 'Expanded row with keep/reroll/explode sub-controls.',
    },
  },
  {
    n: 6,
    title: 'Compare rolls',
    body: (
      <Text>
        Add more rows. Each appears in the chart with its own color. Toggle
        the visibility checkbox to focus on a subset.
      </Text>
    ),
    screenshot: {
      src: '/docs/screenshots/quickstart-06.png',
      alt: 'Three rows and chart overlay showing three colored series',
      caption: 'Three rows + chart overlay showing three colored series.',
    },
  },
  {
    n: 7,
    title: 'Set targets and read Hit %',
    body: (
      <Text>
        Type one or more targets in the toolbar (e.g. AC 14, save DC 16). A
        new <strong>Hit %</strong> column appears showing how often each row
        beats each target.
      </Text>
    ),
    screenshot: {
      src: '/docs/screenshots/quickstart-07.png',
      alt: 'Target toolbar with chips “14” and “16”, table showing two Hit % bars per row',
      caption:
        'Target toolbar with chips “14” “16” → table shows two Hit % bars per row.',
    },
  },
  {
    n: 8,
    title: 'Share and import',
    body: (
      <Text>
        Export the whole table as a link, JSON, or file. Import lets you bring
        rolls back in and choose to merge or replace.
      </Text>
    ),
    screenshot: {
      src: '/docs/screenshots/quickstart-08.png',
      alt: 'Share menu showing Copy link, Copy JSON, and Download options',
      caption: 'Share menu with Copy link / Copy JSON / Download options.',
    },
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

function AnnotationRow({ annotation }: { annotation: Annotation }) {
  return (
    <HStack
      gap={3}
      align="flex-start"
      bg="bg.subtle"
      borderRadius="md"
      px={3}
      py={2}
      mt={2}
    >
      <Box
        colorPalette="blue"
        bg="colorPalette.solid"
        color="colorPalette.contrast"
        w="20px"
        h="20px"
        borderRadius="full"
        display="flex"
        alignItems="center"
        justifyContent="center"
        fontSize="2xs"
        fontWeight="semibold"
        flexShrink={0}
        mt="2px"
      >
        {annotation.n}
      </Box>
      <Box fontSize="sm" flex="1">
        {annotation.body}
      </Box>
    </HStack>
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
      <Screenshot
        src={step.screenshot.src}
        alt={step.screenshot.alt}
        {...(step.screenshot.caption !== undefined && {
          caption: step.screenshot.caption,
        })}
      />
      {step.annotations?.map((a) => (
        <AnnotationRow key={a.n} annotation={a} />
      ))}
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
