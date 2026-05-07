import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Button, Heading, HStack, Stack, Text } from '@chakra-ui/react';

interface Props {
  storageKey?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  private handleReset = (): void => {
    try {
      const key = this.props.storageKey;
      if (key && typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch {
      /* localStorage access can throw in private mode — fall through to reload */
    }
    window.location.reload();
  };

  private handleBack = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    return (
      <Box
        minH="100dvh"
        bg="bg"
        display="flex"
        alignItems="center"
        justifyContent="center"
        p={{ base: 4, md: 8 }}
      >
        <Box
          maxW="520px"
          w="100%"
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="lg"
          p={{ base: 5, md: 7 }}
        >
          <Stack gap={4}>
            <Heading size="md">Something went wrong.</Heading>
            <Text fontSize="sm" color="fg.muted">
              The app hit an error it couldn&apos;t recover from. You can try
              going back, or reset saved rolls if the problem keeps happening.
            </Text>
            <Box
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              borderRadius="md"
              p={3}
              fontFamily="mono"
              fontSize="xs"
              color="fg.muted"
              overflowX="auto"
            >
              {error.message || String(error)}
            </Box>
            <HStack gap={3} justify="flex-end">
              <Button variant="outline" onClick={this.handleBack}>
                Back
              </Button>
              <Button colorPalette="red" onClick={this.handleReset}>
                Reset saved data
              </Button>
            </HStack>
          </Stack>
        </Box>
      </Box>
    );
  }
}
