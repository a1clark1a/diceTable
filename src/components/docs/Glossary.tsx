import { Fragment } from 'react';
import { Box, Grid, HStack, Heading, Stack, Text } from '@chakra-ui/react';
import {
  GLOSSARY_GROUP_LABELS,
  GLOSSARY_GROUP_ORDER,
  glossaryEntries,
  type GlossaryEntry,
  type GlossaryGroup,
} from '../../docs/glossary';
import { RulingSymbol } from '../targetRuling';
import { RULING_OPTIONS } from '../targetRulingMeta';

function GlossaryAlt({ entry }: { entry: GlossaryEntry }) {
  if (entry.id === 'target-ruling') {
    return (
      <HStack
        as="span"
        gap={1.5}
        mt={0.5}
        fontFamily="mono"
        fontSize="sm"
        color="fg.muted"
      >
        {RULING_OPTIONS.map((r, i) => (
          <Fragment key={r.value}>
            {i > 0 && (
              <Text as="span" aria-hidden="true">
                /
              </Text>
            )}
            <RulingSymbol ruling={r.value} />
          </Fragment>
        ))}
      </HStack>
    );
  }
  if (entry.alt === undefined) return null;
  return (
    <Text fontFamily="mono" fontSize="sm" color="fg.muted" mt={0.5}>
      {entry.alt}
    </Text>
  );
}

function GlossaryRow({ entry, isLast }: { entry: GlossaryEntry; isLast: boolean }) {
  return (
    <Grid
      templateColumns={{ base: '1fr', md: '200px 1fr' }}
      gap={{ base: 1, md: 4 }}
      py={{ base: 3, md: 4 }}
      borderBottomWidth={isLast ? 0 : '1px'}
      borderColor="border.subtle"
    >
      <Box>
        <Text fontSize="sm" fontWeight="semibold">
          {entry.term}
        </Text>
        <GlossaryAlt entry={entry} />
      </Box>
      <Stack gap={2}>
        <Text fontSize="sm">{entry.plain}</Text>
        {entry.details !== undefined && (
          <Text fontSize="sm" color="fg.muted" lineHeight="tall">
            {entry.details}
          </Text>
        )}
        {entry.formal !== undefined && (
          <Box
            fontFamily="mono"
            fontSize="sm"
            color="fg.muted"
            bg="bg.subtle"
            px={2}
            py={1}
            borderRadius="sm"
            w="fit-content"
            maxW="100%"
            overflowX="auto"
          >
            {entry.formal}
          </Box>
        )}
      </Stack>
    </Grid>
  );
}

function GlossaryGroupBlock({ group }: { group: GlossaryGroup }) {
  const entries = glossaryEntries.filter((e) => e.group === group);
  if (entries.length === 0) return null;
  return (
    <Stack gap={2}>
      <Heading
        as="h3"
        size="xs"
        textTransform="uppercase"
        letterSpacing="wider"
        color="fg.muted"
      >
        {GLOSSARY_GROUP_LABELS[group]}
      </Heading>
      <Box borderTopWidth="1px" borderColor="border.subtle">
        {entries.map((entry, idx) => (
          <GlossaryRow
            key={entry.id}
            entry={entry}
            isLast={idx === entries.length - 1}
          />
        ))}
      </Box>
    </Stack>
  );
}

export function Glossary() {
  return (
    <Stack gap={8}>
      <Text fontSize="md" color="fg.muted">
        A quick reference for every term DiceTable uses. Stats like σ, dice
        shorthand like kh3, chart names like CCDF: if you see it somewhere
        and aren’t sure what it means, the answer is here.
      </Text>
      <Stack gap={8}>
        {GLOSSARY_GROUP_ORDER.map((group) => (
          <GlossaryGroupBlock key={group} group={group} />
        ))}
      </Stack>
    </Stack>
  );
}
