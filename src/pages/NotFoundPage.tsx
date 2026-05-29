import { Button, Heading, Stack, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <Stack gap={4} maxW="520px" mx="auto" py={{ base: 8, md: 16 }} textAlign="center">
      <Heading as="h1" size={{ base: 'lg', md: 'xl' }} letterSpacing="tight">
        Page not found
      </Heading>
      <Text color="fg.muted">
        That URL does not match any page in DiceTable. The link may be old, or
        the address may have a typo.
      </Text>
      <Stack direction="row" justify="center" gap={3}>
        <Button asChild colorPalette="blue">
          <RouterLink to="/">Back to the table</RouterLink>
        </Button>
        <Button asChild variant="outline">
          <RouterLink to="/docs">Open the docs</RouterLink>
        </Button>
      </Stack>
    </Stack>
  );
}
