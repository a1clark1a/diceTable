import { Link, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { findRecipePage, recipePath } from '../../presets/recipePages';

// An unknown slug renders nothing rather than a dead link; recipePages.test.ts
// fails on one. The link runs inline because Chakra's default inline-flex turns
// a heading that wraps into one box that drops below the lead-in. Inside a
// sentence it keeps the line's height (tapTarget.ts explains the WCAG 2.5.8
// inline exemption), and it is underlined because blue beside fg.muted is too
// close to mark a link by colour alone.
export function RecipeLink({ slug }: { slug: string | undefined }) {
  const page = findRecipePage(slug);
  if (page === undefined) return null;
  return (
    <Text fontSize="sm" color="fg.muted">
      See it worked out:{' '}
      <Link asChild variant="underline" colorPalette="blue" display="inline">
        <RouterLink to={recipePath(page.slug)}>{page.heading}</RouterLink>
      </Link>
    </Text>
  );
}
