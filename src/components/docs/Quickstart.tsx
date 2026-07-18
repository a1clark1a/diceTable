import { Box, Code, HStack, Heading, Stack, Text } from '@chakra-ui/react';
import { quickstartSteps, type QuickstartStep } from './quickstart-data';

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
        {quickstartSteps.map((step, idx) => (
          <Step
            key={step.n}
            step={step}
            isLast={idx === quickstartSteps.length - 1}
          />
        ))}
      </Stack>
    </Stack>
  );
}
