import { Button, Collapsible, Flex, Heading, List, Stack, Text } from '@chakra-ui/react';
import { ArrowRight, ChevronRight } from 'lucide-react';
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
          <Text fontSize="xs" color="fg.muted">
            Adds these rolls to your own table and keeps everything already in it.
          </Text>
        </Flex>
      )}
      {/* Closed by default but always mounted: the page's HowTo data repeats
          these steps, and structured data has to match text the page carries. */}
      <Collapsible.Root>
        <Collapsible.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            minH={{ base: '44px', md: '32px' }}
            px={2}
            ms={-2}
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
