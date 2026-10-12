import { Button, Collapsible, Flex, Heading, List, Stack, Text } from '@chakra-ui/react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { tapTarget } from '../tapTarget';
import { docsSectionPath } from '../docs/docs-tab';
import type { RecipePage } from '../../presets/recipePages';

interface RecipeHeroProps {
  page: RecipePage;
  /** Null while the page's table is empty, when there is nothing to carry over. */
  onOpen: (() => void) | null;
}

export function RecipeHero({ page, onOpen }: RecipeHeroProps) {
  return (
    <Stack gap={2} maxW="720px">
      <Heading as="h1" size={{ base: 'md', md: 'xl' }} letterSpacing="tight">
        {page.heading}
      </Heading>
      <Text
        fontSize={{ base: 'sm', md: 'md' }}
        color="fg.muted"
        css={{ textWrap: 'pretty' }}
      >
        {page.intro}
      </Text>
      {onOpen !== null && (
        <Flex gap={3} rowGap={1} align="center" wrap="wrap" mt={1}>
          <Button
            colorPalette="blue"
            minH={{ base: '48px', md: '40px' }}
            onClick={onOpen}
          >
            Open this in my table
            <ArrowRight size={16} />
          </Button>
          {/* On a phone the toast after the press says the same, and the
              height this line takes comes out of the rolls below. */}
          <Text fontSize="xs" color="fg.muted" display={{ base: 'none', md: 'block' }}>
            Adds them after the rolls you already have.
          </Text>
        </Flex>
      )}
      {/* Closed by default but always mounted: the page's HowTo data repeats
          these steps, and structured data has to match text the page carries. */}
      <Collapsible.Root>
        {/* The way back to every other question shares this row, so a phone,
            where the hero's height comes out of the rolls, gives it none. */}
        <Flex gap={1} align="center" wrap="wrap">
          <Collapsible.Trigger asChild>
            <Button
              variant="ghost"
              size="sm"
              minH={tapTarget('32px')}
              px={2}
              // Optical alignment with the heading, short of the page padding so
              // the focus ring never meets the screen edge.
              ms={-1}
              color="fg.muted"
              _hover={{ color: 'fg', bg: 'bg.muted' }}
            >
              <Collapsible.Indicator
                transition="transform 0.2s"
                _open={{ transform: 'rotate(90deg)' }}
              >
                <ChevronRight size={16} />
              </Collapsible.Indicator>
              Build it yourself
            </Button>
          </Collapsible.Trigger>
          <Button
            asChild
            variant="ghost"
            size="sm"
            minH={tapTarget('32px')}
            px={2}
            color="fg.muted"
            _hover={{ color: 'fg', bg: 'bg.muted' }}
          >
            <RouterLink to={docsSectionPath('questions')}>More dice questions</RouterLink>
          </Button>
        </Flex>
        <Collapsible.Content>
          <List.Root as="ol" gap={2} ps={5} pt={1} fontSize="sm">
            {page.steps.map((step) => (
              <List.Item key={step.title}>
                <Text as="span" fontWeight="medium">
                  {step.title}.
                </Text>{' '}
                <Text as="span" color="fg.muted">
                  {step.plain}
                </Text>
              </List.Item>
            ))}
          </List.Root>
        </Collapsible.Content>
      </Collapsible.Root>
    </Stack>
  );
}
