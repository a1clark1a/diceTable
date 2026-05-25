import { Box, Code, Heading, Stack, Text } from '@chakra-ui/react';
import { mathOps, type MathOp } from '../../docs/math';

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      fontSize="2xs"
      fontWeight="semibold"
      textTransform="uppercase"
      letterSpacing="wider"
      color="fg.muted"
      mb={1.5}
    >
      {children}
    </Text>
  );
}

function MathOpCard({ op }: { op: MathOp }) {
  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="lg"
      p={{ base: 4, md: 5 }}
    >
      <Heading as="h3" size="sm" mb={1}>
        {op.title}
      </Heading>
      <Text
        fontFamily="mono"
        fontSize="xs"
        color="fg.muted"
        mb={3}
      >
        {op.subtitle}
      </Text>
      <Stack gap={3}>
        <Box>
          <SectionLabel>Explanation</SectionLabel>
          <Box
            fontSize="sm"
            css={{ '& code, & em': { fontSize: 'inherit' } }}
          >
            {op.plain}
          </Box>
        </Box>
        <Box>
          <SectionLabel>Worked example</SectionLabel>
          <Box
            bg="bg.subtle"
            px={3}
            py={2}
            borderRadius="md"
            fontSize="sm"
            css={{ '& code': { fontSize: 'inherit' } }}
          >
            {op.example}
          </Box>
        </Box>
        <Box>
          <SectionLabel>Calculation</SectionLabel>
          <Box
            as="pre"
            bg="bg.subtle"
            color="fg"
            px={4}
            py={3}
            borderRadius="md"
            fontFamily="mono"
            fontSize="sm"
            lineHeight="1.6"
            overflowX="auto"
            borderWidth="1px"
            borderColor="border.subtle"
          >
            {op.snippet}
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}

export function TheMath() {
  return (
    <Stack gap={6}>
      <Text fontSize="md" color="fg.muted">
        Every percentage you see on a roll is the real chance, not an
        estimate or a simulation. The walkthroughs below show how each piece
        of dice notation turns into those numbers, in case you ever want to
        peek at why a roll behaves the way it does.
      </Text>
      <Box
        colorPalette="blue"
        bg="colorPalette.subtle"
        color="colorPalette.fg"
        borderLeftWidth="3px"
        borderColor="colorPalette.solid"
        borderTopRightRadius="md"
        borderBottomRightRadius="md"
        px={4}
        py={3}
        fontSize="sm"
      >
        Each step below has the same layout: a short explanation in plain
        words, a small worked example with real numbers, and a formula
        snippet for anyone who wants to read the math directly.
      </Box>
      <Stack gap={4}>
        {mathOps.map((op) => (
          <MathOpCard key={op.id} op={op} />
        ))}
      </Stack>
      <Box
        colorPalette="blue"
        bg="colorPalette.subtle"
        color="colorPalette.fg"
        borderLeftWidth="3px"
        borderColor="colorPalette.solid"
        borderTopRightRadius="md"
        borderBottomRightRadius="md"
        px={4}
        py={3}
        fontSize="sm"
        css={{ '& code, & em': { fontSize: 'inherit' } }}
      >
        Putting it together: a roll like <Code>2d6kh1 + 1d4r1 + 3</Code> is
        built one piece at a time. Each die part gets its own odds first,
        then the parts combine, then the modifier shifts the whole thing up
        or down. Advantage or disadvantage, if you set one, applies last to
        the finished roll.
      </Box>
    </Stack>
  );
}
