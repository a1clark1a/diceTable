import { Box, Button, Heading, Link, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { Plus, Search } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useApp } from '../../state/useApp';
import { STARTER_PRESETS, STARTER_ROWS } from '../../presets/starterRolls';
import { RECIPE_PAGES, recipePageLabel, recipePath } from '../../presets/recipePages';
import { tapTarget } from '../tapTarget';
import { PresetCardGrid } from './PresetCardGrid';

interface StartExamplesPanelProps {
  onFindRoll: () => void;
}

export function StartExamplesPanel({ onFindRoll }: StartExamplesPanelProps) {
  const { addExpression, addExpressions } = useApp();

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border.subtle"
      borderRadius="lg"
      px={{ base: 4, md: 8 }}
      py={{ base: 6, md: 8 }}
    >
      <Stack gap={1} align="center">
        <Heading as="h2" size="md">
          Start with an example
        </Heading>
        <Text
          fontSize="sm"
          color="fg.muted"
          textAlign="center"
          maxW={{ md: '460px' }}
          css={{ textWrap: 'pretty' }}
        >
          Pick a roll and the table builds itself. Rename it, change the dice,
          or delete it afterwards.
        </Text>
        {/* The eight cards below are only the starter set; the game recipes
            live in the library, and an empty table has no other way in. */}
        <Button
          variant="outline"
          mt={3}
          minH={{ base: '48px', md: '44px' }}
          onClick={onFindRoll}
        >
          <Search size={16} />
          Find a roll
        </Button>
      </Stack>
      <Box mt={{ base: 5, md: 6 }}>
        <PresetCardGrid presets={STARTER_PRESETS} />
      </Box>
      <Stack
        direction={{ base: 'column', md: 'row' }}
        gap={{ base: 2, md: 3 }}
        mt={{ base: 6, md: 7 }}
        justify="center"
        align={{ base: 'stretch', md: 'center' }}
      >
        <Button
          colorPalette="blue"
          minH={{ base: '48px', md: '44px' }}
          onClick={() => addExpressions([...STARTER_ROWS])}
        >
          Load every example
        </Button>
        <Button
          variant="ghost"
          minH={{ base: '48px', md: '44px' }}
          onClick={addExpression}
        >
          <Plus size={16} />
          Start from a blank roll
        </Button>
      </Stack>
      {/* The recipe pages answer searches, and nothing else links to them. An
          empty table on / is what a first visit and a crawler both get, so this
          is the one place a link here is seen by both. */}
      <Box
        as="nav"
        aria-labelledby="common-questions"
        // The card grid's column, so the list lines up with the cards above.
        maxW="760px"
        mx="auto"
        mt={{ base: 6, md: 7 }}
        pt={{ base: 5, md: 6 }}
        borderTopWidth="1px"
        borderColor="border.subtle"
      >
        <Heading id="common-questions" as="h3" size="sm" mb={2}>
          Common dice questions
        </Heading>
        <SimpleGrid as="ul" columns={{ base: 1, md: 2 }} columnGap={6} listStyleType="none">
          {RECIPE_PAGES.map((page) => (
            <Box as="li" key={page.slug}>
              <Link
                asChild
                colorPalette="blue"
                color="colorPalette.fg"
                fontSize="sm"
                minH={tapTarget('32px')}
                // A title that wraps on a phone fills its whole target, so the
                // padding is what keeps it from touching the next link.
                py={1}
                display="flex"
                alignItems="center"
              >
                <RouterLink to={recipePath(page.slug)}>{recipePageLabel(page)}</RouterLink>
              </Link>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  );
}
