import { Heading, Stack, Text } from '@chakra-ui/react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useSearchParams,
} from 'react-router-dom';
import { DocsTabs } from '../components/docs/DocsTabs';
import {
  docsSectionPath,
  isDocsTab,
  type DocsTab,
} from '../components/docs/docs-tab';
import { Quickstart } from '../components/docs/Quickstart';
import { quickstartSteps } from '../components/docs/quickstart-data';
import { Glossary } from '../components/docs/Glossary';
import { TheMath } from '../components/docs/TheMath';
import { glossaryEntries } from '../docs/glossary';
import { RouteHead } from '../components/seo/RouteHead';
import { JsonLd } from '../components/seo/JsonLd';
import {
  SITE_ORIGIN,
  buildDefinedTermSetLd,
  buildHowToLd,
} from '../components/seo/structuredData';
import NotFoundPage from './NotFoundPage';

const DEFAULT_TAB: DocsTab = 'quickstart';

const QUICKSTART_HOWTO_LD = buildHowToLd(
  'How to use DiceTable',
  'Build dice rolls, compare their probability on one chart, and set targets to read hit rates.',
  quickstartSteps,
);

const GLOSSARY_TERMSET_LD = buildDefinedTermSetLd(
  'DiceTable glossary',
  'Every term DiceTable uses: dice notation, roll modes, statistics, distributions and charts, and app concepts.',
  `${SITE_ORIGIN}${docsSectionPath('glossary')}`,
  glossaryEntries,
);

function DocsLayout() {
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

      <DocsTabs />

      <Stack gap={6}>
        <Outlet />
      </Stack>
    </Stack>
  );
}

function DocsIndexRedirect() {
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: DocsTab = isDocsTab(rawTab) ? rawTab : DEFAULT_TAB;
  return <Navigate to={docsSectionPath(tab)} replace />;
}

function QuickstartSection() {
  return (
    <>
      <RouteHead
        title="DiceTable Quickstart: build and compare your first rolls"
        description="A step-by-step walkthrough of DiceTable: add a roll, read dice notation, compare rolls on one chart, and set targets to read hit rates."
        path={docsSectionPath('quickstart')}
      />
      <JsonLd data={QUICKSTART_HOWTO_LD} />
      <Quickstart />
    </>
  );
}

function GlossarySection() {
  return (
    <>
      <RouteHead
        title="DiceTable Glossary: every term defined in plain language"
        description="Every term DiceTable uses, defined in plain language: dice notation like kh3, stats like standard deviation, and chart names like CCDF."
        path={docsSectionPath('glossary')}
      />
      <JsonLd data={GLOSSARY_TERMSET_LD} />
      <Glossary />
    </>
  );
}

function MathSection() {
  return (
    <>
      <RouteHead
        title="DiceTable Math: how exact dice probabilities are computed"
        description="The exact math behind DiceTable: convolution, keep and reroll rules, exploding dice, dice pools, and roll-off win chances."
        path={docsSectionPath('math')}
      />
      <TheMath />
    </>
  );
}

export default function DocsPage() {
  return (
    <Routes>
      <Route element={<DocsLayout />}>
        <Route index element={<DocsIndexRedirect />} />
        <Route path="quickstart" element={<QuickstartSection />} />
        <Route path="glossary" element={<GlossarySection />} />
        <Route path="math" element={<MathSection />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
