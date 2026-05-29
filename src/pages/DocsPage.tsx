import { useCallback } from 'react';
import { Heading, Stack, Text } from '@chakra-ui/react';
import { useSearchParams } from 'react-router-dom';
import { DocsTabs } from '../components/docs/DocsTabs';
import { isDocsTab, type DocsTab } from '../components/docs/docs-tab';
import { Quickstart } from '../components/docs/Quickstart';
import { Glossary } from '../components/docs/Glossary';
import { TheMath } from '../components/docs/TheMath';

const DEFAULT_TAB: DocsTab = 'quickstart';

export default function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: DocsTab = isDocsTab(rawTab) ? rawTab : DEFAULT_TAB;

  const handleChange = useCallback(
    (next: DocsTab) => {
      setSearchParams(
        (prev) => {
          const out = new URLSearchParams(prev);
          out.set('tab', next);
          return out;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  return (
    <Stack gap={6} maxW="920px" mx="auto">
      <Stack gap={1}>
        <Heading as="h1" size={{ base: 'lg', md: 'xl' }} letterSpacing="tight">
          Docs
        </Heading>
        <Text fontSize="md" color="fg.muted">
          How to use DiceTable, what every term means, and the math behind
          every number.
        </Text>
      </Stack>

      <DocsTabs value={activeTab} onChange={handleChange} />

      <Stack gap={6} role="tabpanel" aria-label={activeTab}>
        {activeTab === 'quickstart' && <Quickstart />}
        {activeTab === 'glossary' && <Glossary />}
        {activeTab === 'math' && <TheMath />}
      </Stack>
    </Stack>
  );
}
