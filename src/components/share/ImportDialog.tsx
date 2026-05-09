import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  Alert,
  Box,
  Button,
  CloseButton,
  Dialog,
  HStack,
  Portal,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { FileInput } from 'lucide-react';
import type { Expression } from '../../types';
import { useApp } from '../../state/useApp';
import { detectAndDecode, type DecodeError } from '../../share/decode';
import { Tooltip } from '../ui/tooltip';
import { tipForId } from '../../docs/glossary';
import { toaster } from './toaster-store';

const MAX_FILE_BYTES = 1_000_000;

type Candidate =
  | { kind: 'idle' }
  | { kind: 'ready'; rolls: Expression[] }
  | { kind: 'error'; error: DecodeError };

const ERROR_MESSAGES: Record<DecodeError, string> = {
  empty: 'Paste a share link or JSON, or choose a file.',
  'malformed-json': "That doesn't look like valid JSON or a share link.",
  'not-our-format':
    "That JSON isn't from DiceTable. Expected a 'dicetable-rolls' export.",
  'invalid-shape':
    'The data is from DiceTable but appears corrupted. Try re-exporting.',
  'decompress-failed':
    "This share link couldn't be decoded. It may be truncated or modified.",
};

function rollsLabel(n: number): string {
  return n === 1 ? '1 roll' : `${n} rolls`;
}

export function ImportDialog() {
  const { expressions, replaceExpressions, addExpressions } = useApp();
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const candidate = useMemo<Candidate>(() => {
    if (inputText.trim().length === 0) return { kind: 'idle' };
    const result = detectAndDecode(inputText);
    if (result.ok) return { kind: 'ready', rolls: result.rolls };
    return { kind: 'error', error: result.error };
  }, [inputText]);

  const reset = useCallback(() => {
    setInputText('');
    setFileName(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback(
    (e: { open: boolean }) => {
      setOpen(e.open);
      if (!e.open) reset();
    },
    [reset],
  );

  const onPasteChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(e.target.value);
      setFileName(null);
      setFileError(null);
    },
    [],
  );

  const onPickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError('File too large. Up to 1 MB supported.');
      setFileName(file.name);
      setInputText('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setInputText(text);
      setFileName(file.name);
      setFileError(null);
    };
    reader.onerror = () => {
      setFileError("Couldn't read that file.");
      setFileName(file.name);
      setInputText('');
    };
    reader.readAsText(file);
  }, []);

  const isEmptyTable = expressions.length === 0;
  const hasCandidate = candidate.kind === 'ready';

  const onAdd = useCallback(() => {
    if (candidate.kind !== 'ready') return;
    addExpressions(candidate.rolls);
    toaster.create({
      type: 'success',
      title: `Added ${rollsLabel(candidate.rolls.length)}`,
    });
    close();
  }, [candidate, addExpressions, close]);

  const onReplace = useCallback(() => {
    if (candidate.kind !== 'ready') return;
    replaceExpressions(candidate.rolls);
    toaster.create({
      type: 'success',
      title: `Imported ${rollsLabel(candidate.rolls.length)}`,
    });
    close();
  }, [candidate, replaceExpressions, close]);

  const errorMessage =
    fileError ?? (candidate.kind === 'error' ? ERROR_MESSAGES[candidate.error] : null);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={handleOpenChange}
      lazyMount
      unmountOnExit
      placement="center"
      size={{ mdDown: 'full', md: 'md' }}
    >
      <Tooltip content={tipForId('import')} disabled={open}>
        <Dialog.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            colorPalette="gray"
            aria-label="Import rolls"
          >
            <FileInput size={16} />
            <Box as="span" display={{ base: 'none', md: 'inline' }}>
              Import
            </Box>
          </Button>
        </Dialog.Trigger>
      </Tooltip>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Import rolls</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={4}>
                <Stack gap={2}>
                  <Text textStyle="sm" color="fg.muted">
                    Paste a share link or JSON
                  </Text>
                  <Textarea
                    value={inputText}
                    onChange={onPasteChange}
                    placeholder="Paste here…"
                    rows={6}
                    fontFamily="mono"
                    fontSize="sm"
                    aria-label="Paste a share link or JSON"
                  />
                </Stack>
                <Stack gap={2}>
                  <Text textStyle="sm" color="fg.muted">
                    …or choose a file
                  </Text>
                  <HStack gap={2} flexWrap="wrap">
                    <Button variant="outline" size="sm" onClick={onPickFile}>
                      Choose file…
                    </Button>
                    {fileName !== null && (
                      <Text
                        textStyle="sm"
                        color="fg.muted"
                        truncate
                        maxW="100%"
                      >
                        {fileName}
                      </Text>
                    )}
                  </HStack>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={onFileChange}
                    style={{ display: 'none' }}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                </Stack>
                {errorMessage !== null && (
                  <Alert.Root status="error">
                    <Alert.Indicator />
                    <Alert.Title>{errorMessage}</Alert.Title>
                  </Alert.Root>
                )}
                {candidate.kind === 'ready' && (
                  <Text textStyle="sm" color="fg.muted">
                    {rollsLabel(candidate.rolls.length)} ready to import.
                  </Text>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Stack
                direction={{ base: 'column', sm: 'row' }}
                gap={2}
                w="full"
                justify={{ sm: 'flex-end' }}
              >
                <Dialog.ActionTrigger asChild>
                  <Button
                    variant="outline"
                    w={{ base: 'full', sm: 'auto' }}
                  >
                    Cancel
                  </Button>
                </Dialog.ActionTrigger>
                {isEmptyTable ? (
                  <Button
                    onClick={onReplace}
                    disabled={!hasCandidate}
                    w={{ base: 'full', sm: 'auto' }}
                  >
                    Import
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={onAdd}
                      disabled={!hasCandidate}
                      w={{ base: 'full', sm: 'auto' }}
                    >
                      Add to table
                    </Button>
                    <Button
                      colorPalette="red"
                      onClick={onReplace}
                      disabled={!hasCandidate}
                      w={{ base: 'full', sm: 'auto' }}
                    >
                      Replace table
                    </Button>
                  </>
                )}
              </Stack>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
