import {
  useCallback,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  HStack,
  IconButton,
  Input,
  NativeSelect,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { X } from 'lucide-react';
import { useApp } from '../state/useApp';
import { MAX_TARGETS, type TargetRuling } from '../types';
import { HelpTerm } from './ui/help-term';
import { tipForId } from '../docs/glossary';
import {
  RULING_OPTIONS,
  RULING_SYMBOL,
  RulingSymbol,
  isTargetRuling,
} from './targetRuling';

function parseDraft(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

export function TargetToolbar() {
  const { target, setTarget } = useApp();
  const [draft, setDraft] = useState('');

  const isFull = target.values.length >= MAX_TARGETS;

  const commitDraft = useCallback(() => {
    const parsed = parseDraft(draft);
    if (parsed === null) {
      setDraft('');
      return;
    }
    if (target.values.includes(parsed)) {
      setDraft('');
      return;
    }
    if (target.values.length >= MAX_TARGETS) {
      setDraft('');
      return;
    }
    setTarget({ values: [...target.values, parsed] });
    setDraft('');
  }, [draft, target.values, setTarget]);

  const removeValue = useCallback(
    (v: number) => {
      setTarget({ values: target.values.filter((x) => x !== v) });
    },
    [target.values, setTarget],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitDraft();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setDraft('');
        e.currentTarget.blur();
      } else if (
        e.key === 'Backspace' &&
        draft === '' &&
        target.values.length > 0
      ) {
        e.preventDefault();
        const last = target.values[target.values.length - 1]!;
        removeValue(last);
      }
    },
    [commitDraft, draft, target.values, removeValue],
  );

  const hint = isFull
    ? `Up to ${MAX_TARGETS} targets. Remove one to add another.`
    : target.values.length === 0
      ? 'Add a target to show Hit % per row.'
      : 'Add another target or clear to hide Hit %.';

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
      <HelpTerm tip={tipForId('target')}>
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
      <NativeSelect.Root size="sm" maxW="180px">
        <NativeSelect.Field
          value={target.ruling}
          onChange={(e) => {
            if (isTargetRuling(e.target.value)) setTarget({ ruling: e.target.value });
          }}
          aria-label="Target ruling"
          title="How to compare each roll to the target."
        >
          {RULING_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.shortLabel}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      <Wrap gap={1} flexShrink={1}>
        {target.values.map((v) => (
          <WrapItem key={v}>
            <TargetChip
              ruling={target.ruling}
              value={v}
              onRemove={() => removeValue(v)}
            />
          </WrapItem>
        ))}
      </Wrap>
      <Input
        size="sm"
        type="text"
        inputMode="numeric"
        placeholder={isFull ? '—' : 'Add'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
        disabled={isFull}
        maxW="80px"
        textAlign="right"
        fontFamily="mono"
        aria-label="Add target value"
      />
      <Text
        fontSize="xs"
        color="fg.muted"
        ml="auto"
        display={{ base: 'none', md: 'inline' }}
      >
        {hint}
      </Text>
    </HStack>
  );
}

interface TargetChipProps {
  ruling: TargetRuling;
  value: number;
  onRemove: () => void;
}

function TargetChip({ ruling, value, onRemove }: TargetChipProps) {
  const symbol = RULING_SYMBOL[ruling];
  return (
    <HStack
      gap={1}
      bg="bg.subtle"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="full"
      pl={2}
      pr={1}
      py={0.5}
      fontFamily="mono"
      fontSize="xs"
    >
      <RulingSymbol ruling={ruling} color="fg.muted" />
      <Text as="span" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
      <IconButton
        aria-label={`Remove target ${symbol} ${value}`}
        size="2xs"
        variant="ghost"
        onClick={onRemove}
        title="Remove target"
      >
        <X size={12} />
      </IconButton>
    </HStack>
  );
}
