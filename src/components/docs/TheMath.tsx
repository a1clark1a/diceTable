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
        DiceTable computes every number by full enumeration — no Monte Carlo,
        no normal-distribution approximations. Speed comes from input bounds,
        not from giving up exactness.
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
        Each operation below has the same shape: a plain-English description, a
        worked numeric example, and a math-notation snippet of the calculation.
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
        Putting it together: a row like <Code>2d6kh1 + 1d4r1 + 3</Code> is
        built bottom-up — each <em>part</em> produces its own distribution
        (using the math above), parts are convolved together, then the
        modifier shifts the result. Roll mode (advantage / disadvantage) is
        applied last, to the full distribution.
      </Box>
    </Stack>
  );
}
