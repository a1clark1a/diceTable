import { Box, Heading, Link, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { RECIPE_PAGES, recipePath } from '../../presets/recipePages';
import { tapTarget } from '../tapTarget';

export function DiceQuestions() {
  return (
    <Stack gap={8}>
      <Text fontSize="md" color="fg.muted">
        Common questions about dice, each answered with the exact odds. Open
        one and its rolls are already in a working table, so you can change a
        die or a bonus and watch the answer move. Nothing you do there touches
        your own table.
      </Text>
      <Box
        as="ul"
        listStyleType="none"
        borderTopWidth="1px"
        borderColor="border.subtle"
      >
        {RECIPE_PAGES.map((page, idx) => (
          <Box
            as="li"
            key={page.slug}
            py={{ base: 3, md: 4 }}
            borderBottomWidth={idx === RECIPE_PAGES.length - 1 ? 0 : '1px'}
            borderColor="border.subtle"
          >
            <Heading as="h3" size="md">
              <Link
                asChild
                colorPalette="blue"
                color="colorPalette.fg"
                minH={tapTarget('auto')}
                display="flex"
                alignItems="center"
              >
                <RouterLink to={recipePath(page.slug)}>{page.heading}</RouterLink>
              </Link>
            </Heading>
            <Text fontSize="sm" color="fg.muted" mt={1} css={{ textWrap: 'pretty' }}>
              {page.description}
            </Text>
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
