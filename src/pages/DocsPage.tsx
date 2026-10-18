import { Heading, Stack, Text } from '@chakra-ui/react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { DocsTabs } from '../components/docs/DocsTabs';
import {
  DOCS_TAB_LABELS,
  docsSectionPath,
  docsTabForPath,
  isDocsTab,
  type DocsTab,
} from '../components/docs/docs-tab';
import { Quickstart } from '../components/docs/Quickstart';
import { quickstartSteps } from '../components/docs/quickstart-data';
import { Glossary } from '../components/docs/Glossary';
import { TheMath } from '../components/docs/TheMath';
import { DiceQuestions } from '../components/docs/DiceQuestions';
import { glossaryEntries } from '../docs/glossary';
import { RECIPE_PAGES, recipePath } from '../presets/recipePages';
import { RouteHead } from '../components/seo/RouteHead';
import { JsonLd } from '../components/seo/JsonLd';
import {
  SITE_ORIGIN,
  buildDefinedTermSetLd,
  buildHowToLd,
  buildItemListLd,
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

const QUESTIONS_ITEMLIST_LD = buildItemListLd(
  'Common dice questions',
  'Common dice questions, each answered with exact odds on its own page.',
  `${SITE_ORIGIN}${docsSectionPath('questions')}`,
  RECIPE_PAGES.map((page) => ({
    name: page.heading,
    url: `${SITE_ORIGIN}${recipePath(page.slug)}`,
  })),
);

function DocsLayout() {
  // Null only on /docs itself, for the frame before its redirect lands.
  const tab = docsTabForPath(useLocation().pathname);
  return (
    <Stack gap={6} maxW="920px" mx="auto">
      <Stack gap={1}>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="wider"
          color="fg.muted"
        >
          Docs
        </Text>
        <Heading as="h1" size={{ base: 'lg', md: 'xl' }} letterSpacing="tight">
          {tab === null ? 'Docs' : DOCS_TAB_LABELS[tab]}
        </Heading>
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

function QuestionsSection() {
  return (
    <>
      <RouteHead
        title="DiceTable Dice Questions: exact odds for common rolls"
        description="Common dice questions answered with exact odds: 4d6 drop lowest, advantage, rerolling 1s and 2s, exploding dice, dice pools, crit range and chance to hit."
        path={docsSectionPath('questions')}
      />
      <JsonLd data={QUESTIONS_ITEMLIST_LD} />
      <DiceQuestions />
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
        <Route path="questions" element={<QuestionsSection />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
