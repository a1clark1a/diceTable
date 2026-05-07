import { useCallback } from 'react';
import {
  HStack,
  Input,
  NativeSelect,
  Text,
} from '@chakra-ui/react';
import { useApp } from '../state/useApp';
import { useBufferedValue } from '../hooks/useBufferedValue';
import type { TargetRuling } from '../types';
import { HelpTerm } from './ui/help-term';
import { TIPS } from './ui/tips';

const RULING_OPTIONS: { value: TargetRuling; label: string }[] = [
  { value: 'gte', label: '≥ at least' },
  { value: 'gt', label: '> greater than' },
  { value: 'lte', label: '≤ at most' },
  { value: 'lt', label: '< less than' },
  { value: 'eq', label: '= exactly' },
];

function isRuling(value: string): value is TargetRuling {
  return RULING_OPTIONS.some((r) => r.value === value);
}

function parseTargetValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function formatTargetValue(v: number | null): string {
  return v === null ? '' : String(v);
}

export function TargetToolbar() {
  const { target, setTarget } = useApp();

  const commitTargetValue = useCallback(
    (v: number | null) => {
      setTarget({ value: v });
    },
    [setTarget],
  );

  const valueBuf = useBufferedValue<number | null>({
    committed: target.value,
    commit: commitTargetValue,
    parse: parseTargetValue,
    format: formatTargetValue,
  });

  return (
    <HStack
      gap={2}
      px={3}
      py={2}
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="md"
      flexWrap="wrap"
    >
      <HelpTerm tip={TIPS.target}>
        <Text
          as="span"
          fontSize="xs"
          fontWeight="semibold"
          color="fg.muted"
          textTransform="uppercase"
          letterSpacing="wider"
        >
          Target
        </Text>
      </HelpTerm>
      <Input
        size="sm"
        type="text"
        inputMode="numeric"
        placeholder="—"
        value={valueBuf.value}
        onChange={(e) => valueBuf.setValue(e.target.value)}
        onBlur={valueBuf.onBlur}
        onKeyDown={valueBuf.onKeyDown}
        maxW="96px"
        textAlign="right"
        fontFamily="mono"
        aria-label="Target value"
      />
      <NativeSelect.Root size="sm" maxW="180px">
        <NativeSelect.Field
          value={target.ruling}
          onChange={(e) => {
            if (isRuling(e.target.value)) setTarget({ ruling: e.target.value });
          }}
          aria-label="Target ruling"
          title="How to compare each roll to the target."
        >
          {RULING_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      <Text
        fontSize="xs"
        color="fg.muted"
        ml="auto"
        display={{ base: 'none', md: 'inline' }}
      >
        {target.value === null
          ? 'Set a target to show Hit % per row.'
          : 'Clear to hide the Hit % column.'}
      </Text>
    </HStack>
  );
}
